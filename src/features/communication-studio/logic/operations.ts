import { z } from 'zod';
import { documentSchema, type StudioDocument } from './document';
import { studioDocumentV3Schema, type StudioDocumentV3 } from './document-v3';

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
const valueSchema = z.object({ exists: z.boolean(), value: z.json().optional() });
export const studioChangeSchema = z.object({
  path: z
    .array(
      z
        .string()
        .min(1)
        .refine(p => !['__proto__', 'prototype', 'constructor'].includes(p))
    )
    .min(1)
    .max(32),
  before: valueSchema,
  after: valueSchema,
});
export const studioOperationSchema = z.object({
  projectId: z.string().uuid(),
  operationId: z.string().uuid(),
  generation: z.string().uuid().optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  changes: z.array(studioChangeSchema).min(1).max(20000),
});
export type StudioChange = z.infer<typeof studioChangeSchema>;
export interface StudioConflict {
  path: string[];
  base: unknown;
  local: unknown;
  remote: unknown;
}
export function isStudioValidationError(error: unknown): boolean {
  if (error instanceof z.ZodError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /"code"\s*:\s*"invalid_(?:union|type|value)"/.test(message);
}
/** Zod's JSON schema rejects explicitly undefined optional object properties.
 * They are absent on the wire, but array holes must remain an error. */
function operationJson(value: unknown, ancestors = new Set<object>()): unknown {
  if (!value || typeof value !== 'object') return value;
  if (ancestors.has(value)) throw new Error('Studio operation contains a circular value');
  ancestors.add(value);
  try {
    if (Array.isArray(value))
      return Array.from(value, item => {
        if (item === undefined)
          throw new Error('Studio operation contains an undefined array item');
        return operationJson(item, ancestors);
      });
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new Error('Studio operation contains a non-JSON object');
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, operationJson(item, ancestors)])
    );
  } finally {
    ancestors.delete(value);
  }
}
const entry = (value: unknown) =>
  valueSchema.parse(
    value === undefined ? { exists: false } : { exists: true, value: operationJson(value) }
  );
const idArray = (a: unknown[]): a is { id: string }[] =>
  a.every(v => v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string');
const geometryKeys = [
  'x',
  'y',
  'width',
  'height',
  'angle',
  'rotation',
  'points',
  'startBinding',
  'endBinding',
  'frameId',
  'groupIds',
] as const;
function geometry(value: Record<string, unknown>) {
  return Object.fromEntries(
    geometryKeys.filter(k => value[k] !== undefined).map(k => [k, value[k]])
  );
}
export function diffStudio(before: unknown, after: unknown, path: string[] = []): StudioChange[] {
  // Legacy Studio pages have no native scene yet. Treat that missing scene as
  // empty so two first drawings remain independent element operations.
  if (
    before === undefined &&
    after &&
    path.length === 3 &&
    path[0] === 'pages' &&
    path[2] === 'canvas'
  )
    before = { version: 1, elements: [], files: {} };
  if (stableJson(before) === stableJson(after)) return [];
  if (Array.isArray(before) && Array.isArray(after) && idArray(before) && idArray(after)) {
    const edits = [...new Set([...before, ...after].map(v => v.id))].flatMap(id =>
      diffStudio(
        before.find(v => v.id === id),
        after.find(v => v.id === id),
        [...path, `#${id}`]
      )
    );
    // Paragraph and table order is structural: concurrent structural changes conflict,
    // while independent paragraph/cell content edits remain mergeable.
    if (
      !['pages', 'elements', 'posts', 'nodes', 'deliverables'].includes(path.at(-1) ?? '') &&
      stableJson(before.map(v => v.id)) !== stableJson(after.map(v => v.id))
    )
      edits.push({
        path: [...path, '@order'],
        before: entry(before.map(v => v.id)),
        after: entry(after.map(v => v.id)),
      });
    return edits;
  }
  if (
    before &&
    after &&
    !Array.isArray(before) &&
    !Array.isArray(after) &&
    typeof before === 'object' &&
    typeof after === 'object'
  ) {
    const a = before as Record<string, unknown>,
      b = after as Record<string, unknown>;
    const isElement =
      typeof a.id === 'string' && typeof a.type === 'string' && 'x' in a && 'y' in a;
    const isNode =
      typeof a.id === 'string' &&
      typeof a.type === 'string' &&
      a.transform !== null &&
      typeof a.transform === 'object';
    const atomic =
      isElement && stableJson(geometry(a)) !== stableJson(geometry(b))
        ? [{ path: [...path, '@geometry'], before: entry(geometry(a)), after: entry(geometry(b)) }]
        : isNode && stableJson(a.transform) !== stableJson(b.transform)
          ? [
              {
                path: [...path, '@transform'],
                before: entry(a.transform),
                after: entry(b.transform),
              },
            ]
          : [];
    return [
      ...atomic,
      ...[...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter(
          k =>
            (!isElement || !geometryKeys.includes(k as (typeof geometryKeys)[number])) &&
            (!isNode || k !== 'transform')
        )
        .flatMap(k => diffStudio(a[k], b[k], [...path, k])),
    ];
  }
  return [{ path, before: entry(before), after: entry(after) }];
}
export function studioValueAtPath(root: unknown, path: string[]): unknown {
  let value = root;
  for (const key of path) {
    if (key === '@geometry')
      value =
        value && typeof value === 'object' ? geometry(value as Record<string, unknown>) : undefined;
    else if (key === '@transform')
      value =
        value && typeof value === 'object'
          ? (value as Record<string, unknown>).transform
          : undefined;
    else if (key === '@order') value = Array.isArray(value) ? value.map(v => v.id) : undefined;
    else if (key.startsWith('#'))
      value = Array.isArray(value) ? value.find(v => v?.id === key.slice(1)) : undefined;
    else
      value =
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  }
  return value;
}
function mergeChanges<T>(
  current: T,
  changes: StudioChange[],
  parse: (value: unknown) => T,
  normalize: (value: T) => void
): { value: T; conflicts: StudioConflict[] } {
  const source = current;
  const conflicts: StudioConflict[] = [];
  for (const change of changes) {
    const actual = entry(studioValueAtPath(current, change.path));
    if (
      stableJson(actual) !== stableJson(change.before) &&
      stableJson(actual) !== stableJson(change.after)
    )
      conflicts.push({
        path: change.path,
        base: change.before.value,
        local: change.after.value,
        remote: actual.value,
      });
    // A changed/deleted ancestor cannot be silently recreated by a leaf edit.
    if (
      change.path.length > 1 &&
      studioValueAtPath(current, change.path.slice(0, -1)) === undefined
    )
      conflicts.push({
        path: change.path,
        base: change.before.value,
        local: change.after.value,
        remote: undefined,
      });
  }
  if (conflicts.length) return { value: source, conflicts };
  const next = structuredClone(current);
  for (const { path, after } of changes) {
    const parent = studioValueAtPath(next, path.slice(0, -1)) as
      Record<string, unknown> | unknown[];
    const key = path[path.length - 1];
    if (key === '@geometry' && parent && !Array.isArray(parent)) {
      for (const field of geometryKeys) Reflect.deleteProperty(parent, field);
      Object.assign(parent, after.value);
    } else if (key === '@transform' && parent && !Array.isArray(parent)) {
      parent.transform = structuredClone(after.value);
    } else if (key === '@order' && Array.isArray(parent)) {
      const ids = after.value as string[];
      parent.sort(
        (a, b) => ids.indexOf((a as { id: string }).id) - ids.indexOf((b as { id: string }).id)
      );
    } else if (key.startsWith('#') && Array.isArray(parent)) {
      const index = parent.findIndex(v => (v as { id: string }).id === key.slice(1));
      if (!after.exists) {
        if (index >= 0) parent.splice(index, 1);
      } else if (index >= 0) parent[index] = structuredClone(after.value);
      else parent.push(structuredClone(after.value));
    } else {
      if (!parent || Array.isArray(parent)) throw new Error('Invalid Studio property path');
      if (after.exists) parent[key] = structuredClone(after.value);
      else Reflect.deleteProperty(parent, key);
    }
  }
  normalize(next);
  return { value: parse(next), conflicts: [] };
}

export function mergeStudio(
  current: StudioDocument,
  changes: StudioChange[]
): { value: StudioDocument; conflicts: StudioConflict[] } {
  const initialize = changes
    .filter(c => c.path.length > 3 && c.path[0] === 'pages' && c.path[2] === 'canvas')
    .map(c => c.path[1].slice(1));
  if (current.pages.some(p => initialize.includes(p.id) && !p.canvas)) {
    current = structuredClone(current);
    for (const page of current.pages)
      if (initialize.includes(page.id) && !page.canvas)
        page.canvas = { version: 1, elements: [], files: {} };
  }
  return mergeChanges(current, changes, documentSchema.parse, next => {
    next.pages.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    next.pages.forEach(p =>
      p.elements.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    );
  });
}

export function mergeStudioV3(
  current: StudioDocumentV3,
  changes: StudioChange[]
): { value: StudioDocumentV3; conflicts: StudioConflict[] } {
  return mergeChanges(current, changes, studioDocumentV3Schema.parse, next => {
    next.nodes.sort(
      (a, b) =>
        String(a.parentFrameId).localeCompare(String(b.parentFrameId)) ||
        a.zIndex - b.zIndex ||
        a.id.localeCompare(b.id)
    );
    next.deliverables.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  });
}
export function inverseChanges(changes: StudioChange[]): StudioChange[] {
  return changes.map(c => ({ ...c, before: c.after, after: c.before }));
}

import { z } from 'zod';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import { canvasElementSchema, canvasSceneSchema } from './canvas-schema';
import { elementSchema, type StudioElement } from './document';
import {
  deliverableSchema,
  descendantsOf,
  studioDocumentV3Schema,
  studioNodeSchema,
  type StudioDocumentV3,
  type StudioNode,
} from './document-v3';

export const STUDIO_CLIPBOARD_TYPE = 'polity/studio-clipboard' as const;

const studioClipboardV1Schema = z.object({
  type: z.literal(STUDIO_CLIPBOARD_TYPE),
  version: z.literal(1),
  projectId: z.string().min(1),
  elements: z.array(canvasElementSchema).max(10_000),
  semanticElements: z.array(elementSchema).max(100),
  files: canvasSceneSchema.shape.files,
});

const studioClipboardV2Schema = z.object({
  type: z.literal(STUDIO_CLIPBOARD_TYPE),
  version: z.literal(2),
  projectId: z.string().min(1),
  rootNodeIds: z.array(z.string().uuid()).min(1).max(1_000),
  nodes: z.array(studioNodeSchema).min(1).max(50_000),
  deliverables: z
    .array(
      z.object({
        deliverable: deliverableSchema,
        framePositions: z
          .array(
            z.object({
              frameId: z.string().uuid(),
              index: z.number().int().nonnegative(),
            })
          )
          .min(1)
          .max(100),
      })
    )
    .max(1_000),
});

const studioClipboardSchema = z.discriminatedUnion('version', [
  studioClipboardV1Schema,
  studioClipboardV2Schema,
]);

export type StudioClipboardV1Payload = z.infer<typeof studioClipboardV1Schema>;
export type StudioClipboardV2Payload = z.infer<typeof studioClipboardV2Schema>;
export type StudioClipboardPayload = z.infer<typeof studioClipboardSchema>;

const projectClipboards = new Map<string, StudioClipboardPayload>();

const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function customData(element: Record<string, unknown>) {
  const value = element.customData;
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function referencedElementIds(element: Record<string, unknown>) {
  const ids: string[] = [];
  if (Array.isArray(element.boundElements))
    for (const binding of element.boundElements)
      if (
        typeof binding === 'object' &&
        binding !== null &&
        'id' in binding &&
        typeof binding.id === 'string'
      )
        ids.push(binding.id);
  if (typeof element.containerId === 'string') ids.push(element.containerId);
  return ids;
}

function isCopyable(element: Record<string, unknown>, frameIds: ReadonlySet<string>) {
  return !element.isDeleted && !frameIds.has(String(element.id));
}

export function createStudioClipboardPayload(input: {
  projectId: string;
  selectedIds: readonly string[];
  elements: readonly ExcalidrawElement[];
  semanticElements: readonly StudioElement[];
  files: BinaryFiles;
  frameIds?: ReadonlySet<string>;
  activeFrame?: ExcalidrawElement;
}): StudioClipboardV1Payload | null {
  const frameIds = input.frameIds ?? new Set<string>();
  const byId = new Map(input.elements.map(element => [element.id, element]));
  const selected = new Set(input.selectedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...selected]) {
      const element = byId.get(id);
      if (!element) continue;
      for (const referencedId of referencedElementIds(
        element as unknown as Record<string, unknown>
      ))
        if (!selected.has(referencedId) && byId.has(referencedId)) {
          selected.add(referencedId);
          changed = true;
        }
    }
  }
  const chosen = input.elements.filter(
    element =>
      selected.has(element.id) &&
      isCopyable(element as unknown as Record<string, unknown>, frameIds)
  );
  if (!chosen.length) return null;
  const activeFrame = input.activeFrame;
  const normalized = chosen.map(element => {
    const record = jsonClone(element) as unknown as Record<string, unknown>;
    if (activeFrame && record.frameId === activeFrame.id) {
      record.x = Number(record.x) - activeFrame.x;
      record.y = Number(record.y) - activeFrame.y;
      record.frameId = null;
    }
    return record;
  });
  const semanticIds = new Set(
    normalized.flatMap(element => {
      const source = customData(element).polityElement;
      return typeof source === 'string' ? [source] : [];
    })
  );
  const fileIds = new Set(
    normalized.flatMap(element =>
      element.type === 'image' && typeof element.fileId === 'string' ? [element.fileId] : []
    )
  );
  return studioClipboardV1Schema.parse({
    type: STUDIO_CLIPBOARD_TYPE,
    version: 1,
    projectId: input.projectId,
    elements: normalized,
    semanticElements: input.semanticElements.filter(element => semanticIds.has(element.id)),
    files: Object.fromEntries(Object.entries(input.files).filter(([id]) => fileIds.has(id))),
  });
}

export function createStudioV3ClipboardPayload(input: {
  projectId: string;
  selectedNodeIds: readonly string[];
  document: StudioDocumentV3;
}): StudioClipboardV2Payload | null {
  const selected = new Set(input.selectedNodeIds);
  const chosen = new Set(selected);
  for (const nodeId of selected) {
    const node = input.document.nodes.find(candidate => candidate.id === nodeId);
    if (!node) continue;
    if (node.type === 'frame')
      for (const descendant of descendantsOf(input.document, node.id)) chosen.add(descendant.id);
  }
  const nodes = input.document.nodes.filter(node => chosen.has(node.id));
  if (!nodes.length) return null;
  const chosenById = new Map(nodes.map(node => [node.id, node]));
  const rootNodeIds = [...selected].filter(nodeId => {
    let parentId = chosenById.get(nodeId)?.parentFrameId ?? null;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = chosenById.get(parentId)?.parentFrameId ?? null;
    }
    return chosenById.has(nodeId);
  });
  if (!rootNodeIds.length) return null;
  const deliverables = input.document.deliverables.flatMap(deliverable => {
    const framePositions = deliverable.frameIds.flatMap((frameId, index) =>
      chosen.has(frameId) ? [{ frameId, index }] : []
    );
    return framePositions.length ? [{ deliverable: jsonClone(deliverable), framePositions }] : [];
  });
  return studioClipboardV2Schema.parse({
    type: STUDIO_CLIPBOARD_TYPE,
    version: 2,
    projectId: input.projectId,
    rootNodeIds,
    nodes: jsonClone(nodes),
    deliverables,
  });
}

function remapBinding(
  binding: unknown,
  ids: ReadonlyMap<string, string>
): Record<string, unknown> | null {
  if (typeof binding !== 'object' || binding === null || Array.isArray(binding)) return null;
  const record = binding as Record<string, unknown>;
  const elementId = typeof record.elementId === 'string' ? ids.get(record.elementId) : undefined;
  return elementId ? { ...record, elementId } : null;
}

export function duplicateStudioClipboard(
  payload: StudioClipboardV1Payload,
  projectId: string,
  targetFrame?: ExcalidrawElement
) {
  if (payload.projectId !== projectId)
    throw new Error('Studio clipboard belongs to another project');
  const elementIds = new Map(payload.elements.map(element => [element.id, crypto.randomUUID()]));
  const semanticIds = new Map(
    payload.semanticElements.map(element => [
      element.id,
      elementIds.get(element.id) ?? crypto.randomUUID(),
    ])
  );
  const groupIds = new Map<string, string>();
  const remapGroup = (id: string) => {
    const existing = groupIds.get(id);
    if (existing) return existing;
    const replacement = crypto.randomUUID();
    groupIds.set(id, replacement);
    return replacement;
  };
  const elements = payload.elements.map(element => {
    const record = jsonClone(element) as Record<string, unknown>;
    const data = { ...customData(record) };
    const source = typeof data.polityElement === 'string' ? data.polityElement : undefined;
    if (source) data.polityElement = semanticIds.get(source) ?? elementIds.get(source) ?? source;
    delete data.polityNode;
    delete data.polityRoot;
    delete data.polityFrame;
    delete data.polityFrameBackground;
    delete data.polityMaster;
    delete data.polityMasterFrame;
    delete data.polityTargetFrame;
    const boundElements = Array.isArray(record.boundElements)
      ? record.boundElements.flatMap(binding => {
          if (typeof binding !== 'object' || binding === null || !('id' in binding)) return [];
          const id = elementIds.get(String(binding.id));
          return id ? [{ ...binding, id }] : [];
        })
      : null;
    const containerId =
      typeof record.containerId === 'string' ? (elementIds.get(record.containerId) ?? null) : null;
    return {
      ...record,
      id: elementIds.get(element.id),
      x: Number(record.x) + (targetFrame?.x ?? 0) + 24,
      y: Number(record.y) + (targetFrame?.y ?? 0) + 24,
      frameId: targetFrame?.id ?? null,
      groupIds: Array.isArray(record.groupIds)
        ? record.groupIds.map(id => remapGroup(String(id)))
        : [],
      boundElements,
      ...('containerId' in record ? { containerId } : {}),
      ...('startBinding' in record
        ? {
            startBinding: remapBinding(record.startBinding, elementIds),
            endBinding: remapBinding(record.endBinding, elementIds),
          }
        : {}),
      customData: data,
      locked: false,
      isDeleted: false,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
      seed: Math.floor(Math.random() * 2 ** 31),
    } as unknown as ExcalidrawElement;
  });
  const semanticElements = payload.semanticElements.map(element => ({
    ...jsonClone(element),
    id: semanticIds.get(element.id) ?? crypto.randomUUID(),
    x: element.x + 24,
    y: element.y + 24,
    group: element.group ? remapGroup(element.group) : null,
  }));
  return {
    elements,
    semanticElements,
    selectedIds: elements.map(element => element.id),
    files: jsonClone(payload.files) as BinaryFiles,
  };
}

function remapNestedContentIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(remapNestedContentIds);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      key === 'id' && typeof nested === 'string'
        ? crypto.randomUUID()
        : remapNestedContentIds(nested),
    ])
  );
}

function remapNativeElement(
  raw: Record<string, unknown>,
  sceneIds: ReadonlyMap<string, string>,
  groupIds: ReadonlyMap<string, string>,
  nodeIds: ReadonlyMap<string, string>,
  nodeId: string
) {
  const remapSceneId = (value: unknown) =>
    typeof value === 'string' ? (sceneIds.get(value) ?? value) : value;
  raw.id = remapSceneId(raw.id);
  if ('frameId' in raw) raw.frameId = remapSceneId(raw.frameId);
  if (Array.isArray(raw.groupIds))
    raw.groupIds = raw.groupIds.map(id => groupIds.get(String(id)) ?? id);
  if (Array.isArray(raw.boundElements))
    raw.boundElements = raw.boundElements.flatMap(binding => {
      if (typeof binding !== 'object' || binding === null || !('id' in binding)) return [];
      const id = sceneIds.get(String(binding.id));
      return id ? [{ ...binding, id }] : [];
    });
  if ('containerId' in raw) raw.containerId = remapSceneId(raw.containerId);
  for (const key of ['startBinding', 'endBinding'] as const) {
    const binding = raw[key];
    if (typeof binding !== 'object' || binding === null || Array.isArray(binding)) {
      raw[key] = null;
      continue;
    }
    const elementId = sceneIds.get(String((binding as Record<string, unknown>).elementId));
    raw[key] = elementId ? { ...binding, elementId } : null;
  }
  const data: Record<string, unknown> = { ...customData(raw), polityNode: nodeId };
  for (const key of ['polityElement', 'polityFrame', 'polityMasterFrame', 'polityTargetFrame']) {
    const current = (data as Record<string, unknown>)[key];
    if (typeof current === 'string')
      (data as Record<string, unknown>)[key] = nodeIds.get(current) ?? current;
  }
  raw.customData = data;
}

export function pasteStudioV3Clipboard(input: {
  document: StudioDocumentV3;
  payload: StudioClipboardV2Payload;
  projectId: string;
  targetFrameId?: string | null;
}): { document: StudioDocumentV3; selectedNodeIds: string[] } {
  if (input.payload.projectId !== input.projectId)
    throw new Error('Studio clipboard belongs to another project');
  const document = structuredClone(input.document);
  const sourceById = new Map(input.payload.nodes.map(node => [node.id, node]));
  const roots = input.payload.rootNodeIds.flatMap(id => {
    const node = sourceById.get(id);
    return node ? [node] : [];
  });
  if (!roots.length) throw new Error('Studio clipboard has no root nodes');
  const nodeIds = new Map(input.payload.nodes.map(node => [node.id, crypto.randomUUID()]));
  const sceneIds = new Map(
    input.payload.nodes.flatMap(node => {
      const id = node.excalidraw?.id;
      return typeof id === 'string' ? [[id, crypto.randomUUID()] as const] : [];
    })
  );
  const groupIds = new Map<string, string>();
  for (const node of input.payload.nodes)
    for (const groupId of node.groupIds)
      if (!groupIds.has(groupId)) groupIds.set(groupId, crypto.randomUUID());

  const targetFrame = input.targetFrameId
    ? document.nodes.find(node => node.id === input.targetFrameId && node.type === 'frame')
    : undefined;
  const sharedSourceParent = new Set(roots.map(node => node.parentFrameId)).size === 1;
  const rootIds = new Set(input.payload.rootNodeIds);
  const clones = input.payload.nodes.map(source => {
    const copy = jsonClone(source) as StudioNode;
    const copyId = nodeIds.get(source.id);
    if (!copyId) throw new Error('Clipboard node id mapping is incomplete.');
    copy.id = copyId;
    copy.parentFrameId = source.parentFrameId
      ? (nodeIds.get(source.parentFrameId) ?? source.parentFrameId)
      : null;
    copy.groupIds = source.groupIds.map(id => groupIds.get(id) ?? id);
    copy.locked = false;
    if (rootIds.has(source.id)) {
      const rootFrame = source.type === 'frame' && source.parentFrameId === null;
      copy.parentFrameId = rootFrame
        ? null
        : sharedSourceParent && targetFrame
          ? targetFrame.id
          : copy.parentFrameId;
      copy.transform.x += 24;
      copy.transform.y += 24;
      const siblings = document.nodes.filter(
        node =>
          node.parentFrameId === copy.parentFrameId &&
          (copy.parentFrameId !== null || (node.type === 'frame') === (copy.type === 'frame'))
      );
      copy.zIndex = Math.max(-1, ...siblings.map(node => node.zIndex)) + 1;
    }
    if (copy.type === 'shape') {
      copy.startBindingId = copy.startBindingId ? (nodeIds.get(copy.startBindingId) ?? null) : null;
      copy.endBindingId = copy.endBindingId ? (nodeIds.get(copy.endBindingId) ?? null) : null;
    } else if (copy.type === 'richText') {
      copy.content = remapNestedContentIds(copy.content) as typeof copy.content;
    } else if (copy.type === 'table') {
      copy.data = remapNestedContentIds(copy.data) as typeof copy.data;
    } else if (copy.type === 'chart') {
      copy.data = {
        ...copy.data,
        series: copy.data.series.map(series => ({ ...series, id: crypto.randomUUID() })),
      };
    }
    if (copy.excalidraw) remapNativeElement(copy.excalidraw, sceneIds, groupIds, nodeIds, copy.id);
    return copy;
  });
  document.nodes.push(...clones);

  for (const membership of input.payload.deliverables) {
    const copiedFrames = membership.framePositions.flatMap(position => {
      const frameId = nodeIds.get(position.frameId);
      return frameId ? [{ ...position, frameId }] : [];
    });
    if (!copiedFrames.length) continue;
    const existing = document.deliverables.find(
      deliverable => deliverable.id === membership.deliverable.id
    );
    if (existing) {
      for (const copied of copiedFrames.sort((a, b) => a.index - b.index)) {
        const originalFrameId = membership.framePositions.find(
          position => position.index === copied.index
        )?.frameId;
        const originalIndex = originalFrameId ? existing.frameIds.indexOf(originalFrameId) : -1;
        const index =
          originalIndex >= 0 ? originalIndex + 1 : Math.min(existing.frameIds.length, copied.index);
        existing.frameIds.splice(index, 0, copied.frameId);
      }
    } else {
      document.deliverables.push({
        ...jsonClone(membership.deliverable),
        frameIds: copiedFrames.sort((a, b) => a.index - b.index).map(item => item.frameId),
      });
    }
  }
  return {
    document: studioDocumentV3Schema.parse(document),
    selectedNodeIds: input.payload.rootNodeIds.flatMap(id => {
      const nodeId = nodeIds.get(id);
      return nodeId ? [nodeId] : [];
    }),
  };
}

export function stringifyStudioClipboard(payload: StudioClipboardPayload) {
  return JSON.stringify(payload);
}

export function parseStudioClipboard(value: string): StudioClipboardPayload | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.type !== STUDIO_CLIPBOARD_TYPE) return null;
    return studioClipboardSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function setProjectStudioClipboard(payload: StudioClipboardPayload) {
  projectClipboards.set(payload.projectId, payload);
}

export function getProjectStudioClipboard(projectId: string) {
  const payload = projectClipboards.get(projectId);
  return payload ? jsonClone(payload) : null;
}

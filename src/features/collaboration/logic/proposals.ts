import type { Value } from 'platejs';
import { applySuggestionToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { stableJson } from './codec';
import { CollaborationError } from './types';

export function suggestionIds(value: unknown): Set<string> {
  const result = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const [key, item] of Object.entries(node)) {
      if (
        (key === 'suggestion' || key.startsWith('suggestion_')) &&
        item &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string'
      )
        result.add((item as { id: string }).id);
      if (key === 'children') visit(item);
    }
  };
  visit(value);
  return result;
}
export function normalized(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const nodes: Record<string, unknown>[] = [];
  for (const item of value as Record<string, unknown>[]) {
    const node = { ...item };
    // Removing the last suggested text leaf leaves an empty children array.
    // Slate represents that same empty block with one empty text leaf.
    if (Array.isArray(node.children))
      node.children = node.children.length ? normalized(node.children) : [{ text: '' }];
    const previous = nodes.at(-1);
    if (
      typeof node.text === 'string' &&
      previous &&
      typeof previous.text === 'string' &&
      stableJson({ ...node, text: undefined }) === stableJson({ ...previous, text: undefined })
    )
      previous.text += node.text;
    else nodes.push(node);
  }
  return nodes;
}

/** Produce a view of exactly one proposal. Other private proposals never travel
 * with its submitted document, even when they share a draft. */
export function isolateProposal(draft: Value, id: string, accept = false): Value {
  let value = draft;
  for (const other of suggestionIds(draft)) {
    if (other !== id) value = applySuggestionToContent(value, other, 'reject');
  }
  return (accept ? normalized(applySuggestionToContent(value, id, 'accept')) : value) as Value;
}

/** Three-way application of immutable content. Arrays without stable identities
 * are atomic unless their structure is unchanged; ambiguity is an explicit conflict. */
export function mergeProposal(base: unknown, proposed: unknown, current: unknown): unknown {
  const equal = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);
  if (equal(base, proposed)) return current;
  if (equal(base, current) || equal(proposed, current)) return proposed;
  if (Array.isArray(base) && Array.isArray(proposed) && Array.isArray(current)) {
    const ids = (list: unknown[]) =>
      list.every(n => n && typeof n === 'object' && typeof (n as { id?: unknown }).id === 'string');
    if (ids(base) && ids(proposed) && ids(current)) {
      const key = (n: unknown) => (n as { id: string }).id;
      const before = new Map(base.map(n => [key(n), n]));
      const after = new Map(proposed.map(n => [key(n), n]));
      const now = new Map(current.map(n => [key(n), n]));
      const b = base.map(key),
        p = proposed.map(key),
        c = current.map(key);
      for (const id of b) {
        if (!after.has(id) && now.has(id) && !equal(before.get(id), now.get(id)))
          throw new CollaborationError('proposal_deleted_target_conflict');
        if (!now.has(id) && after.has(id) && !equal(before.get(id), after.get(id)))
          throw new CollaborationError('proposal_deleted_target_conflict');
      }
      if (!equal(b, p) && !equal(b, c) && !equal(p, c))
        throw new CollaborationError('proposal_order_conflict');
      const order = equal(b, p) ? c : p;
      return order
        .map(id => mergeProposal(before.get(id), after.get(id), now.get(id)))
        .filter(n => n !== undefined);
    }
    if (base.length === proposed.length && base.length === current.length)
      return base.map((n, i) => mergeProposal(n, proposed[i], current[i]));
  } else if (
    typeof base === 'string' &&
    typeof proposed === 'string' &&
    typeof current === 'string'
  ) {
    const span = (next: string) => {
      let start = 0,
        end = base.length,
        nextEnd = next.length;
      while (start < end && start < nextEnd && base[start] === next[start]) start++;
      while (end > start && nextEnd > start && base[end - 1] === next[nextEnd - 1]) {
        end--;
        nextEnd--;
      }
      return { start, end, text: next.slice(start, nextEnd) };
    };
    const a = span(proposed),
      b = span(current);
    if (a.end < b.start || b.end < a.start) {
      let result = base;
      for (const edit of [a, b].sort((l, r) => r.start - l.start))
        result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
      return result;
    }
  } else if (
    base &&
    proposed &&
    current &&
    typeof base === 'object' &&
    typeof proposed === 'object' &&
    typeof current === 'object'
  ) {
    const a = base as Record<string, unknown>,
      b = proposed as Record<string, unknown>,
      c = current as Record<string, unknown>;
    return Object.fromEntries(
      [...new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(c)])]
        .map(k => [k, mergeProposal(a[k], b[k], c[k])])
        .filter(([, v]) => v !== undefined)
    );
  }
  throw new CollaborationError('proposal_content_conflict');
}
/** A suggestion-only actor may submit marked changes, never an unmarked rewrite. */
export function validateTextProposal(base: Value, draft: Value) {
  const oldIds = suggestionIds(base),
    newIds = [...suggestionIds(draft)].filter(id => !oldIds.has(id));
  if (!newIds.length) throw new CollaborationError('proposal_has_no_changes', 422);
  let original = draft;
  for (const id of newIds) original = applySuggestionToContent(original, id, 'reject');
  if (stableJson(normalized(original)) !== stableJson(normalized(base)))
    throw new CollaborationError('unmarked_proposal_changes', 422);
  return newIds;
}

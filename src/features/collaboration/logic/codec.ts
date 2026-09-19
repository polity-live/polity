import * as Y from 'yjs';
import { slateNodesToInsertDelta, yTextToSlateElement } from '@slate-yjs/core';
import type { Descendant } from 'slate';
import { initialize, readDocument } from '@/features/communication-studio/logic/collaboration';
import { documentSchema } from '@/features/communication-studio/logic/document';
import { CollaborationError, type DocumentKind } from './types';
import { cityProjectionSchema } from './city-schema';
import { patchCityObject } from './city-object';

export const MAX_STATE_BYTES = 12_000_000;
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export function textValue(value: unknown): Descendant[] {
  if (typeof value === 'string') return [{ type: 'p', children: [{ text: value }] } as Descendant];
  if (value == null || (Array.isArray(value) && !value.length))
    return [{ type: 'p', children: [{ text: '' }] } as Descendant];
  if (!Array.isArray(value) || !value.length) throw new CollaborationError('invalid_text', 422);
  let count = 0;
  const visit = (node: unknown, depth: number): void => {
    if (++count > 100_000 || depth > 64 || !node || typeof node !== 'object' || Array.isArray(node))
      throw new CollaborationError('invalid_text', 422);
    const n = node as Record<string, unknown>;
    if (typeof n.text === 'string') return;
    if (!Array.isArray(n.children)) throw new CollaborationError('invalid_text', 422);
    n.children.forEach(child => visit(child, depth + 1));
  };
  value.forEach(node => visit(node, 0));
  return value as Descendant[];
}
function objectMap(value: Record<string, unknown>) {
  const map = new Y.Map<unknown>();
  patchCityObject(map, undefined, value);
  return map;
}
export function seedDocument(kind: DocumentKind, value: unknown, doc = new Y.Doc()): Y.Doc {
  doc.transact(() => {
    if (kind === 'studio') initialize(doc, documentSchema.parse(value));
    else if (kind === 'city') {
      const data = value as Record<string, unknown>;
      if (!data || !Array.isArray(data.objects)) throw new CollaborationError('invalid_city', 422);
      const { objects, ...scene } = data;
      for (const [key, item] of Object.entries(scene)) doc.getMap('scene').set(key, item);
      const ids: string[] = [];
      for (const obj of objects as Record<string, unknown>[]) {
        if (typeof obj.id !== 'string' || ids.includes(obj.id))
          throw new CollaborationError('invalid_object_id', 422);
        ids.push(obj.id);
        doc.getMap('objects').set(obj.id, objectMap(obj));
      }
      doc.getArray<string>('order').push(ids);
    } else doc.get('content', Y.XmlText).applyDelta(slateNodesToInsertDelta(textValue(value)));
  }, 'bootstrap');
  return doc;
}
export function projectDocument(kind: DocumentKind, doc: Y.Doc): unknown {
  const allowed =
    kind === 'studio'
      ? ['meta', 'pages', 'posts']
      : kind === 'city'
        ? ['scene', 'objects', 'order']
        : ['content'];
  if ([...doc.share.keys()].some(key => !allowed.includes(key)))
    throw new CollaborationError('invalid_shared_type', 422);
  if (kind === 'studio') return readDocument(doc);
  if (kind === 'city') {
    const objects = doc.getMap<Y.Map<unknown>>('objects');
    const order = [...new Set(doc.getArray<string>('order').toArray())];
    const ids = [
      ...order.filter(id => objects.has(id)),
      ...[...objects.keys()].filter(id => !order.includes(id)).sort(),
    ];
    const value = {
      ...doc.getMap('scene').toJSON(),
      objects: ids.map(id => {
        const object = objects.get(id);
        if (!(object instanceof Y.Map) || object.get('id') !== id)
          throw new CollaborationError('invalid_object_id', 422);
        return object.toJSON();
      }),
    };
    if (ids.length > 50_000) throw new CollaborationError('document_too_large', 413);
    if (!cityProjectionSchema.safeParse(value).success)
      throw new CollaborationError('invalid_city', 422);
    return value;
  }
  return textValue(yTextToSlateElement(doc.get('content', Y.XmlText)).children);
}
/** Updates are validated in an isolated document; rejected data never enters a live room. */
export function candidateDocument(kind: DocumentKind, state: Uint8Array, update: Uint8Array) {
  if (state.length > MAX_STATE_BYTES || update.length > MAX_STATE_BYTES)
    throw new CollaborationError('document_too_large', 413);
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    Y.applyUpdate(doc, update);
    // An incomplete update could otherwise activate unchecked data on a later message.
    if (doc.store.pendingStructs || doc.store.pendingDs)
      throw new CollaborationError('incomplete_update');
    const projection = projectDocument(kind, doc);
    const encoded = Y.encodeStateAsUpdate(doc);
    if (encoded.length > MAX_STATE_BYTES) throw new CollaborationError('document_too_large', 413);
    return { state: encoded, projection };
  } finally {
    doc.destroy();
  }
}

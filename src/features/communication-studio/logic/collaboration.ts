import * as Y from 'yjs';
import {
  documentSchema,
  sorted,
  type StudioDocument,
  type StudioElement,
  type StudioPage,
  type StudioPost,
} from './document';
type AnyMap = Y.Map<unknown>;
function map(values: Record<string, unknown>): AnyMap {
  const m = new Y.Map();
  for (const [k, v] of Object.entries(values)) {
    if (k === 'captions') {
      const captions = new Y.Map();
      for (const [channel, text] of Object.entries(v as Record<string, string>))
        captions.set(channel, new Y.Text(text));
      m.set(k, captions);
    } else m.set(k, k === 'text' ? new Y.Text(String(v)) : v);
  }
  return m;
}
export function initialize(doc: Y.Doc, value: StudioDocument) {
  if (doc.getMap('meta').has('version')) return;
  doc.transact(() => {
    const { pages, posts, ...meta } = value;
    for (const [k, v] of Object.entries(meta)) doc.getMap('meta').set(k, v);
    for (const p of pages) addPage(doc, p);
    for (const post of posts) doc.getMap('posts').set(post.id, map(post));
  }, 'initialize');
}
export function addPage(doc: Y.Doc, page: StudioPage) {
  const { elements, ...props } = page;
  const m = map(props);
  const children = new Y.Map();
  for (const e of elements) children.set(e.id, map(e));
  m.set('elements', children);
  doc.getMap('pages').set(page.id, m);
}
export function readDocument(doc: Y.Doc): StudioDocument {
  const pages = Array.from(doc.getMap<AnyMap>('pages').values()).map(p => ({
    ...p.toJSON(),
    elements: sorted(
      Array.from((p.get('elements') as Y.Map<AnyMap>).values()).map(
        e => e.toJSON() as StudioElement
      )
    ),
  })) as StudioPage[];
  return documentSchema.parse({
    ...doc.getMap('meta').toJSON(),
    pages: sorted(pages),
    posts: Array.from(doc.getMap<AnyMap>('posts').values()).map(p => p.toJSON()),
  });
}
export function patchElement(
  doc: Y.Doc,
  pageId: string,
  id: string,
  patch: Partial<StudioElement>,
  origin: unknown
) {
  doc.transact(() => {
    const elements = doc.getMap<AnyMap>('pages').get(pageId)?.get('elements') as
      Y.Map<AnyMap> | undefined;
    const e = elements?.get(id);
    if (!e) return;
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'id') continue;
      if (key === 'text') {
        const text = e.get('text') as Y.Text;
        replaceText(text, String(value));
      } else e.set(key, value);
    }
  }, origin);
}
export function replaceText(text: Y.Text, value: string) {
  const old = text.toString();
  let start = 0;
  while (start < old.length && start < value.length && old[start] === value[start]) start++;
  let end = 0;
  while (
    end < old.length - start &&
    end < value.length - start &&
    old[old.length - end - 1] === value[value.length - end - 1]
  )
    end++;
  if (old.length - start - end) text.delete(start, old.length - start - end);
  if (value.length - start - end) text.insert(start, value.slice(start, value.length - end));
}
export function insertElement(doc: Y.Doc, pageId: string, value: StudioElement) {
  const page = doc.getMap<AnyMap>('pages').get(pageId);
  (page?.get('elements') as Y.Map<AnyMap>)?.set(value.id, map(value));
}
export function removeElement(doc: Y.Doc, pageId: string, id: string) {
  (doc.getMap<AnyMap>('pages').get(pageId)?.get('elements') as Y.Map<AnyMap>)?.delete(id);
}
export function patchPage(
  doc: Y.Doc,
  pageId: string,
  patch: Partial<Omit<StudioPage, 'elements'>>
) {
  const page = doc.getMap<AnyMap>('pages').get(pageId);
  for (const [k, v] of Object.entries(patch)) page?.set(k, v);
}
export type PostPatch = Partial<Omit<StudioPost, 'captions'>> & {
  captions?: Partial<StudioPost['captions']>;
};
export function patchPost(doc: Y.Doc, id: string, patch: PostPatch) {
  const p = doc.getMap<AnyMap>('posts').get(id);
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'captions') {
      const captions = p?.get(k) as Y.Map<Y.Text>;
      for (const [channel, text] of Object.entries(v as Record<string, string>)) {
        const current = captions?.get(channel);
        if (current) replaceText(current, text);
      }
    } else p?.set(k, v);
  }
}

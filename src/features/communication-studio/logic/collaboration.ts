import { applyStudioCommand, studioCommandSchemas } from './commands';
import type {
  StudioDocument,
  StudioPage,
  StudioElement,
  StudioPost,
  StudioBrand,
} from './document';
export type PostPatch = Partial<Omit<StudioPost, 'captions'>> & {
  captions?: Partial<StudioPost['captions']>;
};
export function addPage(doc: StudioDocument, page: StudioPage) {
  doc.pages.push(structuredClone(page));
}
export function patchPage(doc: StudioDocument, id: string, patch: Partial<StudioPage>) {
  const page = doc.pages.find(p => p.id === id);
  if (patch.id && patch.id !== id) throw new Error('Stable page ID cannot change');
  if (page) Object.assign(page, patch);
}
export function patchElement(
  doc: StudioDocument,
  pageId: string,
  id: string,
  patch: Partial<StudioElement>,
  _origin?: unknown
) {
  if (patch.id && patch.id !== id) throw new Error('Stable element ID cannot change');
  const e = doc.pages.find(p => p.id === pageId)?.elements.find(e => e.id === id);
  if (e && (!e.locked || Object.keys(patch).every(k => k === 'locked'))) {
    if (e.type === 'text' && patch.richText === undefined) {
      const formatting = studioCommandSchemas.studio_format_text.shape.patch.parse(patch);
      if (Object.keys(formatting).length) {
        const next = applyStudioCommand(doc, 'studio_format_text', {
          pageId,
          elementIds: [id],
          patch: formatting,
        });
        const text = next.pages.find(p => p.id === pageId)?.elements.find(e => e.id === id);
        // Formatting retains the selected element and its stable ID.
        Object.assign(e, text);
      }
    }
    Object.assign(e, patch);
    if (patch.text !== undefined && patch.richText === undefined) e.richText = [];
  }
}
export function patchPost(doc: StudioDocument, id: string, patch: PostPatch) {
  const p = doc.posts.find(p => p.id === id);
  if (p) {
    const { captions, ...rest } = patch;
    Object.assign(p, rest);
    if (captions) Object.assign(p.captions, captions);
  }
}
export function insertElement(doc: StudioDocument, pageId: string, e: StudioElement) {
  doc.pages.find(p => p.id === pageId)?.elements.push(structuredClone(e));
}
export function removeElement(doc: StudioDocument, pageId: string, id: string) {
  const p = doc.pages.find(p => p.id === pageId);
  if (p) p.elements = p.elements.filter(e => e.id !== id || e.locked);
}

export function applyBrand(doc: StudioDocument, brand: StudioBrand) {
  const old = doc.brand;
  doc.brand = structuredClone(brand);
  for (const p of doc.pages) {
    p.background =
      p.background === old.background
        ? brand.background
        : p.background === old.foreground
          ? brand.foreground
          : p.background;
    for (const e of p.elements)
      patchElement(doc, p.id, e.id, {
        fill:
          e.fill === old.background
            ? brand.background
            : e.fill === old.foreground
              ? brand.foreground
              : e.fill === old.accent
                ? brand.accent
                : e.fill,
        font: e.font === old.font ? brand.font : e.font === old.bodyFont ? brand.bodyFont : e.font,
      });
  }
}

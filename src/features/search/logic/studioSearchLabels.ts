import type { SearchDocument } from '../types/search-document.types';

const STUDIO_KINDS = new Set([
  'single',
  'event',
  'carousel',
  'story',
  'video',
  'campaign',
  'presentation',
]);

export function studioSearchKindLabel(
  document: Pick<SearchDocument, 'entity_type' | 'subtitle'>,
  translate: (key: string) => string
): string | null {
  if (document.entity_type !== 'studio' || !document.subtitle) return null;
  return STUDIO_KINDS.has(document.subtitle)
    ? translate(`features.studio.${document.subtitle}`)
    : document.subtitle;
}

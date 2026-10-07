import type { StudioElement } from './document';

export function studioProjectionFileId(
  element: Pick<StudioElement, 'id' | 'type' | 'assetId'>,
  mediaReady: boolean
) {
  if (element.type !== 'image' && element.type !== 'video') return `polity-${element.id}`;
  return `polity-${element.id}-${element.assetId ?? 'missing'}-${mediaReady ? 'ready' : 'pending'}`;
}

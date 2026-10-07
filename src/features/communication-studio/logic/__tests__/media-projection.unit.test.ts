import { describe, expect, it } from 'vitest';
import type { StudioElement } from '../document';
import { studioProjectionFileId } from '../media-projection';

const element = (type: StudioElement['type'], assetId: string | null = null) =>
  ({ id: 'element-id', type, assetId }) as StudioElement;

describe('studioProjectionFileId', () => {
  it('replaces a pending media placeholder when the protected media is ready', () => {
    const image = element('image', 'asset-id');

    expect(studioProjectionFileId(image, false)).toBe('polity-element-id-asset-id-pending');
    expect(studioProjectionFileId(image, true)).toBe('polity-element-id-asset-id-ready');
    expect(studioProjectionFileId(element('video', 'clip-id'), true)).toBe(
      'polity-element-id-clip-id-ready'
    );
  });

  it('keeps non-media projections stable', () => {
    expect(studioProjectionFileId(element('rect'), false)).toBe('polity-element-id');
    expect(studioProjectionFileId(element('rect'), true)).toBe('polity-element-id');
  });
});

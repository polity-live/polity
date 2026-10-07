import { describe, expect, it } from 'vitest';
import { element } from '../document';
import { mediaDrawGeometry } from '../media-geometry';

describe('mediaDrawGeometry', () => {
  it('keeps an Excalidraw crop at its original scale instead of fitting the full image again', () => {
    const image = element('image', {
      width: 100,
      height: 80,
      fit: 'contain',
      crop: {
        x: 50,
        y: 10,
        width: 100,
        height: 80,
        naturalWidth: 200,
        naturalHeight: 100,
      },
    });

    expect(mediaDrawGeometry(image, 200, 100)).toEqual({
      x: -50,
      y: -10,
      width: 200,
      height: 100,
    });
  });

  it('retains the existing contain and cover placement without a native crop', () => {
    expect(
      mediaDrawGeometry(element('image', { width: 100, height: 100, fit: 'contain' }), 200, 100)
    ).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(
      mediaDrawGeometry(element('image', { width: 100, height: 100, fit: 'cover' }), 200, 100)
    ).toEqual({ x: -50, y: 0, width: 200, height: 100 });
  });
});

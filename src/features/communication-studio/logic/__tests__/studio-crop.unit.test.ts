import { describe, expect, it } from 'vitest';
import {
  initialMediaCrop,
  panMediaCrop,
  resizeMediaCrop,
  studioMediaGeometry,
  zoomMediaCrop,
} from '../studio-crop';
import { mediaDrawGeometry } from '../media-geometry';

const frame = { x: 20, y: 30, width: 100, height: 100, rotation: 0, flipX: false, flipY: false };
const focus = { x: 0.5, y: 0.5 };

describe('Studio media crop', () => {
  it('resizes each side of a doubly reflected crop at the original source scale and pans in its reflected direction', () => {
    const state = initialMediaCrop(
      { ...frame, flipX: true, flipY: true },
      'cover',
      focus,
      {
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        naturalWidth: 200,
        naturalHeight: 200,
      },
      200,
      200
    );
    const panned = panMediaCrop(state, 10, 20);
    expect(panned.crop).toMatchObject({ x: 60, y: 70 });
    const topLeft = resizeMediaCrop(state, 'top-left', 10, 20);
    expect(topLeft.crop).toMatchObject({ x: 50, y: 50, width: 90, height: 80 });
    const bottomRight = resizeMediaCrop(state, 'bottom-right', 10, 20);
    expect(bottomRight.crop).toMatchObject({ x: 40, y: 30, width: 110, height: 120 });
    expect(state.crop).toMatchObject({ x: 50, y: 50, width: 100, height: 100 });
    const entry = initialMediaCrop(
      { ...frame, flipY: true },
      'cover',
      { x: 0.5, y: 0.25 },
      null,
      100,
      200
    );
    expect(entry.crop).toMatchObject({ y: 75, height: 100 });
    expect(studioMediaGeometry(entry, 100, 200)).toEqual(
      mediaDrawGeometry(
        {
          width: 100,
          height: 100,
          fit: 'cover',
          cropX: 0.5,
          cropY: 0.25,
          crop: null,
          flipX: false,
          flipY: true,
        },
        100,
        200
      )
    );
  });
  it('keeps invalid source dimensions finite and clamps all edge handles at the smallest frame size', () => {
    const state = initialMediaCrop(
      { ...frame, width: 2, height: 2 },
      'contain',
      focus,
      null,
      0,
      -1
    );
    expect(state.crop).toMatchObject({ naturalWidth: 1, naturalHeight: 1 });
    for (const handle of ['left', 'right', 'top', 'bottom'] as const) {
      const resized = resizeMediaCrop(state, handle, 1000, 1000);
      expect(resized.frame.width).toBeGreaterThanOrEqual(2);
      expect(resized.frame.height).toBeGreaterThanOrEqual(2);
      expect(resized.crop.width).toBeGreaterThan(0);
      expect(resized.crop.height).toBeGreaterThan(0);
    }
  });
  it('opens a cover crop without moving the existing pixels and clamps pan and zoom', () => {
    const state = initialMediaCrop(frame, 'cover', focus, null, 200, 100);
    expect(state.crop).toEqual({
      x: 50,
      y: 0,
      width: 100,
      height: 100,
      naturalWidth: 200,
      naturalHeight: 100,
    });
    expect(studioMediaGeometry(state, 200, 100)).toEqual(
      mediaDrawGeometry(
        {
          width: 100,
          height: 100,
          fit: 'cover',
          cropX: 0.5,
          cropY: 0.5,
          crop: null,
          flipX: false,
          flipY: false,
        },
        200,
        100
      )
    );
    expect(panMediaCrop(state, -500, 0).crop.x).toBe(100);
    expect(panMediaCrop(state, 500, 0).crop.x).toBe(0);
    const zoomed = zoomMediaCrop(state, 2);
    expect(zoomed.crop).toMatchObject({ x: 75, y: 25, width: 50, height: 50 });
    expect(zoomMediaCrop(zoomed, 0.01).crop).toMatchObject({ width: 200, height: 100 });
  });

  it('keeps a contain image unchanged on entry and preserves an existing native crop', () => {
    const contain = initialMediaCrop(frame, 'contain', focus, null, 200, 100);
    expect(contain.crop).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
    expect(studioMediaGeometry(contain, 200, 100)).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    const old = { x: 10, y: 10, width: 50, height: 50, naturalWidth: 100, naturalHeight: 100 };
    expect(initialMediaCrop(frame, 'cover', focus, old, 200, 200).crop).toMatchObject({
      x: 20,
      y: 20,
      width: 100,
      height: 100,
    });
  });

  it('moves clip edges and corners at fixed source scale and keeps them inside the source', () => {
    const state = initialMediaCrop(frame, 'cover', focus, null, 200, 100);
    const left = resizeMediaCrop(state, 'left', 20, 0);
    expect(left.frame).toMatchObject({ x: 40, width: 80 });
    expect(left.crop).toMatchObject({ x: 70, width: 80 });
    expect(studioMediaGeometry(left, 200, 100)).toMatchObject({ x: -70, width: 200 });
    const corner = resizeMediaCrop(state, 'bottom-right', 20, -20);
    expect(corner.frame).toMatchObject({ width: 120, height: 80 });
    expect(corner.crop.x + corner.crop.width).toBeLessThanOrEqual(200);
    expect(corner.crop.y + corner.crop.height).toBeLessThanOrEqual(100);
    const bounded = resizeMediaCrop(state, 'left', 1000, 0);
    expect(bounded.frame.width).toBeGreaterThanOrEqual(4);
    expect(bounded.crop.width).toBeGreaterThan(0);
  });

  it('retains pixels on a flipped entry and moves a rotated edge along the local axis', () => {
    const flipped = { ...frame, flipX: true };
    const state = initialMediaCrop(flipped, 'cover', { x: 0.25, y: 0.5 }, null, 200, 100);
    expect(studioMediaGeometry(state, 200, 100)).toEqual(
      mediaDrawGeometry(
        {
          width: 100,
          height: 100,
          fit: 'cover',
          cropX: 0.25,
          cropY: 0.5,
          crop: null,
          flipX: true,
          flipY: false,
        },
        200,
        100
      )
    );
    const rotated = initialMediaCrop({ ...frame, rotation: 90 }, 'cover', focus, null, 200, 100);
    const left = resizeMediaCrop(rotated, 'left', 20, 0);
    expect(left.frame.width).toBe(80);
    expect(left.frame.x).toBeCloseTo(30);
    expect(left.frame.y).toBeCloseTo(40);
  });
});

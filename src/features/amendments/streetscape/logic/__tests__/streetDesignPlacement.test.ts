import { describe, expect, it } from 'vitest';
import {
  createCorridorGeometry,
  createCorridorPreview,
  createCorridorStreetDesignObject,
  createPointStreetDesignObject,
} from '../streetDesignPlacement';

describe('streetDesignPlacement', () => {
  it('creates point objects for single-click placement', () => {
    const object = createPointStreetDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 4, z: 8 },
    });

    expect(object.geometry).toEqual({
      kind: 'point',
      point: { x: 4, z: 8 },
      rotation: 0,
    });
    expect(object.cost.rule).toBe('per_item');
  });

  it('creates a corridor band from click-drag-click points', () => {
    const geometry = createCorridorGeometry({ x: 0, z: 0 }, { x: 10, z: 0 }, 2);

    expect(geometry.kind).toBe('corridor');
    expect(geometry.length).toBe(10);
    expect(geometry.area).toBe(20);
    expect(geometry.width).toBe(2);
    expect(geometry.polygon).toEqual([
      { x: 0, z: 1 },
      { x: 10, z: 1 },
      { x: 10, z: -1 },
      { x: 0, z: -1 },
    ]);
  });

  it('creates live previews with the same corridor geometry rules', () => {
    const preview = createCorridorPreview({ x: 2, z: 2 }, { x: 2, z: 8 }, 3);

    expect(preview.length).toBe(6);
    expect(preview.area).toBe(18);
    expect(preview.polygon).toHaveLength(4);
  });

  it('uses registry default widths when creating corridor objects', () => {
    const object = createCorridorStreetDesignObject({
      id: 'bike-1',
      type: 'bike_lane',
      start: { x: 0, z: 0 },
      end: { x: 0, z: 12 },
    });

    expect(object.geometry.kind).toBe('corridor');
    if (object.geometry.kind === 'corridor') {
      expect(object.geometry.width).toBe(2);
      expect(object.geometry.area).toBe(24);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  createCorridorGeometry,
  createCorridorPreview,
  createCorridorStreetDesignObject,
  createPathCorridorGeometry,
  createPathCorridorStreetDesignObject,
  createPointStreetDesignObject,
  isPathCorridorObjectType,
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

  it('creates a straight path corridor from two points', () => {
    const geometry = createPathCorridorGeometry(
      [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
      ],
      2
    );

    expect(geometry.kind).toBe('path_corridor');
    expect(geometry.length).toBe(10);
    expect(geometry.area).toBe(20);
    expect(geometry.polygon).toEqual([
      { x: 0, z: 1 },
      { x: 10, z: 1 },
      { x: 10, z: -1 },
      { x: 0, z: -1 },
    ]);
  });

  it('rounds corners for three-point path corridors', () => {
    const geometry = createPathCorridorGeometry(
      [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
      ],
      2
    );

    expect(geometry.kind).toBe('path_corridor');
    expect(geometry.points).toHaveLength(3);
    expect(geometry.roundedCenterline.length).toBeGreaterThan(3);
    expect(geometry.polygon.length).toBeGreaterThan(6);
    expect(geometry.length).toBeGreaterThan(0);
    expect(geometry.area).toBeGreaterThan(0);
  });

  it('uses registry default widths when creating corridor objects', () => {
    const object = createCorridorStreetDesignObject({
      id: 'parking-1',
      type: 'parking_area',
      start: { x: 0, z: 0 },
      end: { x: 0, z: 12 },
    });

    expect(object.geometry.kind).toBe('corridor');
    if (object.geometry.kind === 'corridor') {
      expect(object.geometry.width).toBe(2.5);
      expect(object.geometry.area).toBe(30);
    }
  });

  it('creates building footprints as corridor objects with building defaults', () => {
    const object = createCorridorStreetDesignObject({
      id: 'building-1',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 12, z: 0 },
    });

    expect(object.type).toBe('building');
    expect(object.geometry.kind).toBe('corridor');
    if (object.geometry.kind === 'corridor') {
      expect(object.geometry.width).toBe(10);
      expect(object.geometry.area).toBe(120);
    }
    expect(object.properties.height).toBe(9);
    expect(object.properties.color).toBe('#b6aa9b');
  });

  it('creates street paths as path corridor objects', () => {
    const object = createPathCorridorStreetDesignObject({
      id: 'street-1',
      type: 'street',
      points: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
      ],
    });

    expect(object.geometry.kind).toBe('path_corridor');
    if (object.geometry.kind === 'path_corridor') {
      expect(object.geometry.area).toBeGreaterThan(0);
    }
    expect(object.cost.rule).toBe('per_square_meter');
  });

  it('creates water surfaces and planting rows as path corridor objects', () => {
    const water = createPathCorridorStreetDesignObject({
      id: 'water-1',
      type: 'water_area',
      points: [
        { x: 0, z: 0 },
        { x: 8, z: 0 },
      ],
    });
    const treeRow = createPathCorridorStreetDesignObject({
      id: 'tree-row-1',
      type: 'tree',
      points: [
        { x: 0, z: 0 },
        { x: 12, z: 0 },
      ],
    });

    expect(water.geometry.kind).toBe('path_corridor');
    if (water.geometry.kind === 'path_corridor') {
      expect(water.geometry.width).toBe(4);
    }
    expect(water.cost.rule).toBe('per_square_meter');

    expect(treeRow.geometry.kind).toBe('path_corridor');
    expect(treeRow.properties.spacing).toBe(6);
    expect(treeRow.cost.rule).toBe('per_item');
  });

  it('treats OSM-compatible line and area tools as path corridor placements', () => {
    expect(isPathCorridorObjectType('bicycle_parking')).toBe(true);
    expect(isPathCorridorObjectType('rail_track')).toBe(true);
    expect(isPathCorridorObjectType('station_platform')).toBe(true);
    expect(isPathCorridorObjectType('construction_area')).toBe(true);
    expect(isPathCorridorObjectType('landuse_context_area')).toBe(true);
    expect(isPathCorridorObjectType('civic_area')).toBe(true);
    expect(isPathCorridorObjectType('loading_zone')).toBe(false);
  });
});

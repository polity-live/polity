import { describe, expect, it } from 'vitest';
import type { CityDesignObject } from '../../types';
import {
  createCorridorCityDesignObject,
  createPathCorridorCityDesignObject,
  createPathCorridorGeometry,
  createPointCityDesignObject,
  createPolygonGeometry,
  getCityDesignGeometryCenter,
  getCityDesignGeometryRotationDeg,
  movePointObject,
  rotateCityDesignObject,
  updateCorridorWidth,
} from '../cityDesignPlacement';

describe('cityDesignPlacement A04 alternatives', () => {
  it('handles empty, one-point, closed, and ordinary polygons and paths', () => {
    const emptyPath = createPathCorridorGeometry([], 2);
    expect(emptyPath.points).toEqual([
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ]);
    expect(emptyPath.roundedCenterline).toHaveLength(1);
    expect(emptyPath.polygon).toEqual([]);
    expect(createPathCorridorGeometry([{ x: 1, z: 2 }], 2).roundedCenterline).toHaveLength(1);

    expect(createPolygonGeometry([]).area).toBe(0);
    expect(
      createPolygonGeometry([
        { x: 1, z: 1 },
        { x: 2, z: 2 },
      ]).area
    ).toBe(0);
    const closed = createPolygonGeometry([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 2 },
      { x: 0, z: 0 },
    ]);
    expect(closed.points).toHaveLength(3);
    expect(
      createPolygonGeometry([
        { x: 0, z: 0 },
        { x: 2, z: 0 },
        { x: 0, z: 2 },
      ]).area
    ).toBe(2);
  });

  it('finds centers and rotations for every geometry kind and degenerate input', () => {
    const emptyPolygon = createPolygonGeometry([]);
    expect(getCityDesignGeometryCenter(emptyPolygon)).toEqual({ x: 0, z: 0 });
    expect(
      getCityDesignGeometryCenter({ kind: 'point', point: { x: 4, z: 5 }, rotation: 0 })
    ).toEqual({ x: 4, z: 5 });
    expect(
      getCityDesignGeometryCenter({
        kind: 'corridor',
        start: { x: 0, z: 0 },
        end: { x: 4, z: 2 },
        width: 1,
        polygon: [],
        length: 5,
        area: 5,
        rotation: 0,
      })
    ).toEqual({ x: 2, z: 1 });
    expect(getCityDesignGeometryRotationDeg(emptyPolygon)).toBe(0);
    expect(
      getCityDesignGeometryRotationDeg({
        kind: 'path_corridor',
        points: [{ x: 1, z: 1 }],
        roundedCenterline: [],
        width: 1,
        polygon: [],
        length: 0,
        area: 0,
        cornerRadius: 0,
      })
    ).toBe(0);
  });

  it('rotates point, corridor, path, and polygon objects including negative angles', () => {
    const point = createPointCityDesignObject({
      id: 'point',
      type: 'street_lamp',
      point: { x: 1, z: 2 },
    });
    expect(getCityDesignGeometryRotationDeg(rotateCityDesignObject(point, -90).geometry)).toBe(270);

    const corridor = createCorridorCityDesignObject({
      id: 'corridor',
      type: 'parking_area',
      start: { x: 0, z: 0 },
      end: { x: 4, z: 0 },
      width: 3,
      overrides: { rotationDeg: 45, customUnitCostMinor: 500, currency: 'USD' },
    });
    expect(getCityDesignGeometryRotationDeg(corridor.geometry)).toBeCloseTo(45, 1);
    expect(corridor.cost.customUnitCostMinor).toBe(500);
    expect(corridor.cost.currency).toBe('USD');

    const path = createPathCorridorCityDesignObject({
      id: 'path',
      type: 'sidewalk',
      points: [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
      ],
      width: 3,
      overrides: { rotationDeg: 90, properties: { custom: true } },
    });
    expect(getCityDesignGeometryRotationDeg(path.geometry)).toBeCloseTo(90);
    expect(path.properties.custom).toBe(true);

    const polygonObject: CityDesignObject = {
      ...point,
      id: 'polygon',
      geometry: createPolygonGeometry([
        { x: 0, z: 0 },
        { x: 2, z: 0 },
        { x: 0, z: 2 },
      ]),
    };
    expect(rotateCityDesignObject(polygonObject, 90).geometry.kind).toBe('polygon');
  });

  it('rejects incompatible object factories', () => {
    expect(() =>
      createPointCityDesignObject({ id: 'bad-point', type: 'building', point: { x: 0, z: 0 } })
    ).toThrow(/not a point/);
    expect(() =>
      createCorridorCityDesignObject({
        id: 'bad-corridor',
        type: 'street_lamp',
        start: { x: 0, z: 0 },
        end: { x: 1, z: 1 },
      })
    ).toThrow(/not a corridor/);
    expect(() =>
      createPathCorridorCityDesignObject({
        id: 'bad-path',
        type: 'street_lamp',
        points: [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
      })
    ).toThrow(/not a path corridor/);
  });

  it('updates both corridor widths and leaves unrelated geometry untouched', () => {
    const corridor = createCorridorCityDesignObject({
      id: 'corridor',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 5, z: 0 },
    });
    const path = createPathCorridorCityDesignObject({
      id: 'path',
      type: 'sidewalk',
      points: [
        { x: 0, z: 0 },
        { x: 5, z: 0 },
      ],
    });
    const point = createPointCityDesignObject({
      id: 'point',
      type: 'street_lamp',
      point: { x: 0, z: 0 },
    });
    expect(updateCorridorWidth(corridor, 7).geometry).toMatchObject({ width: 7 });
    expect(updateCorridorWidth(path, 6).geometry).toMatchObject({ width: 6 });
    expect(updateCorridorWidth(point, 5)).toBe(point);
    expect(movePointObject(point, { x: 9, z: 8 }).geometry).toMatchObject({
      point: { x: 9, z: 8 },
    });
    expect(movePointObject(corridor, { x: 1, z: 1 })).toBe(corridor);
  });
});

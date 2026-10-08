import { describe, expect, it } from 'vitest';
import type { CityDesignObject } from '../../types';
import {
  createPointCityDesignObject,
  createCorridorCityDesignObject,
  createPathCorridorCityDesignObject,
  createPolygonGeometry,
  getCityDesignGeometryCenter,
  getCityDesignGeometryRotationDeg,
  rotateCityDesignObject,
  updateCityDesignObjectPosition,
  updateCorridorLength,
  updateCorridorWidth,
  createSampledCorridorGeometry,
} from '../cityDesignPlacement';
import {
  cityDesignReducer,
  createEmptyCityDesignState,
  createInitialCityDesignEditorState,
  parseStoredCityDesignState,
} from '../../state/cityDesignReducer';
import { getCityDesignCostLine } from '../cityDesignCosting';
import { cityDesignObjectRegistry } from '../cityDesignObjectRegistry';

const point = createPointCityDesignObject({ id: 'tree', type: 'tree', point: { x: 3, z: 4 } });
const corridor = createCorridorCityDesignObject({
  id: 'road',
  type: 'street',
  start: { x: 0, z: 0 },
  end: { x: 0, z: 20 },
  width: 3,
});
const path = createPathCorridorCityDesignObject({
  id: 'curve',
  type: 'street',
  points: [
    { x: 0, z: 0 },
    { x: 0, z: 20 },
    { x: 20, z: 20 },
  ],
  width: 3,
});
const polygon: CityDesignObject = {
  ...corridor,
  id: 'building',
  type: 'building',
  geometry: createPolygonGeometry([
    { x: 0, z: 0 },
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 7 },
    { x: 3, z: 10 },
    { x: 0, z: 0 },
  ]),
};
const state = (object: CityDesignObject) =>
  createInitialCityDesignEditorState({ ...createEmptyCityDesignState(), objects: [object] });

describe('live City Design properties', () => {
  it('honors schema maximums and preserves nullable stored costs on unchanged edits', () => {
    const field = cityDesignObjectRegistry.street.propertySchema.find(
      field => field.key === 'lanes'
    )!;
    const max = field.max;
    try {
      field.max = 16;
      const initial = state(corridor);
      expect(
        cityDesignReducer(initial, {
          type: 'update_object_property',
          objectId: corridor.id,
          key: 'lanes',
          value: 17,
        })
      ).toBe(initial);
    } finally {
      field.max = max;
    }
    // Older serialized objects may retain a null override instead of omitting it.
    const initial = state({
      ...corridor,
      cost: { ...corridor.cost, customUnitCostMinor: null },
    } as unknown as CityDesignObject);
    expect(
      cityDesignReducer(initial, {
        type: 'update_object_unit_cost',
        objectId: corridor.id,
        unitCostMinor: null,
      })
    ).toBe(initial);
  });
  it('preserves unsupported and degenerate geometries while editing valid lengths and widths', () => {
    expect(updateCorridorLength(point, 5)).toBe(point);
    expect(updateCorridorLength(path, 0)).toBe(path);
    expect(updateCorridorLength(corridor, 20)).toBe(corridor);
    const short = { ...path, geometry: createSampledCorridorGeometry([{ x: 0, z: 0 }], 3) };
    expect(updateCorridorLength(short, 10)).toBe(short);
    const duplicates = {
      ...path,
      geometry: {
        ...createSampledCorridorGeometry(
          [
            { x: 0, z: 0 },
            { x: 0, z: 10 },
          ],
          3
        ),
        roundedCenterline: [
          { x: 0, z: 0 },
          { x: 0, z: 0 },
          { x: 0, z: 10 },
        ],
      },
    };
    expect(updateCorridorLength(duplicates, 5).geometry).toMatchObject({ length: 5 });
    const collapsed = {
      ...duplicates,
      geometry: {
        ...duplicates.geometry,
        roundedCenterline: [
          { x: 0, z: 0 },
          { x: 0, z: 0 },
        ],
      },
    };
    expect(updateCorridorLength(collapsed, 5)).toBe(collapsed);
    expect(updateCorridorLength(corridor, 25).geometry).toMatchObject({ length: 25 });
    expect(
      updateCorridorWidth({ ...path, properties: { ...path.properties, widthSource: 'osm' } }, 4)
    ).toMatchObject({ properties: { widthSource: 'user' } });
    expect(
      cityDesignReducer(state(point), {
        type: 'update_object_length',
        objectId: point.id,
        length: 10,
      })
    ).toEqual(state(point));
    expect(
      cityDesignReducer(state(corridor), {
        type: 'update_object_length',
        objectId: corridor.id,
        length: 5,
      }).design.objects[0].geometry
    ).toMatchObject({ length: 5 });
    expect(
      cityDesignReducer(state(corridor), {
        type: 'update_object_property',
        objectId: corridor.id,
        key: 'lanes',
        value: Infinity,
      })
    ).toEqual(state(corridor));
    expect(
      cityDesignReducer(state(point), {
        type: 'update_object_unit_cost',
        objectId: point.id,
        unitCostMinor: null,
      }).isDirty
    ).toBe(false);
  });
  it.each([point, corridor, path, polygon])(
    'translates $geometry.kind completely and preserves dimensions and cost',
    object => {
      const before = getCityDesignGeometryCenter(object.geometry);
      const after = updateCityDesignObjectPosition(object, { x: -12, z: 8 });
      expect(getCityDesignGeometryCenter(after.geometry)).toEqual({ x: -12, z: 8 });
      expect(getCityDesignCostLine(after)).toEqual(getCityDesignCostLine(object));
      const geometry = after.geometry;
      const original = object.geometry;
      const translate = (points: { x: number; z: number }[]) =>
        points.map(p => ({
          x: expect.closeTo(p.x - 12 - before.x, 8),
          z: expect.closeTo(p.z + 8 - before.z, 8),
        }));
      if (geometry.kind === 'point' && original.kind === 'point')
        expect(geometry.rotation).toBe(original.rotation);
      if (geometry.kind === 'corridor' && original.kind === 'corridor') {
        expect([geometry.start, geometry.end]).toEqual(translate([original.start, original.end]));
        expect(geometry.polygon).toEqual(translate(original.polygon));
        expect(geometry.length).toBe(original.length);
        expect(geometry.area).toBe(original.area);
      }
      if (geometry.kind === 'path_corridor' && original.kind === 'path_corridor') {
        expect(geometry.points).toEqual(translate(original.points));
        expect(geometry.roundedCenterline).toEqual(translate(original.roundedCenterline));
        expect(geometry.polygon).toEqual(translate(original.polygon));
        expect(geometry.length).toBe(original.length);
        expect(geometry.area).toBe(original.area);
      }
      if (geometry.kind === 'polygon' && original.kind === 'polygon') {
        expect(geometry.points).toEqual(translate(original.points));
        expect(geometry.area).toBe(original.area);
      }
      expect(updateCityDesignObjectPosition(after, { x: -12, z: 8 })).toBe(after);
      expect(updateCityDesignObjectPosition(object, { x: NaN, z: 0 })).toBe(object);
    }
  );

  it('rotates closed polygons repeatedly around the same center and retains sampled curves', () => {
    const first = rotateCityDesignObject(polygon, 25);
    const second = rotateCityDesignObject(first, -40);
    expect(getCityDesignGeometryRotationDeg(first.geometry)).toBeCloseTo(25, 2);
    expect(getCityDesignGeometryRotationDeg(second.geometry)).toBeCloseTo(320, 1);
    expect(getCityDesignGeometryCenter(second.geometry)).toEqual({
      x: expect.closeTo(getCityDesignGeometryCenter(polygon.geometry).x, 2),
      z: expect.closeTo(getCityDesignGeometryCenter(polygon.geometry).z, 2),
    });
    if (second.geometry.kind === 'polygon' && polygon.geometry.kind === 'polygon')
      expect(second.geometry.area).toBeCloseTo(polygon.geometry.area, 1);
    const rotated = rotateCityDesignObject(path, 75);
    if (rotated.geometry.kind === 'path_corridor' && path.geometry.kind === 'path_corridor') {
      expect(rotated.geometry.length).toBe(path.geometry.length);
      expect(rotated.geometry.roundedCenterline).toHaveLength(
        path.geometry.roundedCenterline.length
      );
    }
  });

  it('reports the actual rotation of a closed path after successive edits', () => {
    const ring = createPathCorridorCityDesignObject({
      id: 'ring',
      type: 'street',
      width: 3,
      points: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
        { x: 0, z: 0 },
      ],
    });
    const first = rotateCityDesignObject(ring, 30);
    const second = rotateCityDesignObject(first, 75);
    expect(getCityDesignGeometryRotationDeg(first.geometry)).toBeCloseTo(30, 1);
    expect(getCityDesignGeometryRotationDeg(second.geometry)).toBeCloseTo(75, 1);
  });

  it('shortens and restores a curved path from the edit baseline without losing its bends', () => {
    const initial = state(path);
    const shortened = cityDesignReducer(initial, {
      type: 'update_object_length',
      objectId: path.id,
      length: 5,
      sourceGeometry: path.geometry,
    });
    const restored = cityDesignReducer(shortened, {
      type: 'update_object_length',
      objectId: path.id,
      length: path.geometry.kind === 'path_corridor' ? path.geometry.length : 0,
      sourceGeometry: path.geometry,
    });
    expect(restored.design.objects[0].geometry).toEqual(path.geometry);
    const extended = cityDesignReducer(shortened, {
      type: 'update_object_length',
      objectId: path.id,
      length: 60,
      sourceGeometry: path.geometry,
    });
    const geometry = extended.design.objects[0].geometry;
    if (geometry.kind !== 'path_corridor' || path.geometry.kind !== 'path_corridor')
      throw new Error('Expected path');
    expect(geometry.points[0]).toEqual(path.geometry.points[0]);
    expect(geometry.roundedCenterline).toContainEqual(path.geometry.roundedCenterline[10]);
    expect(geometry.length).toBeCloseTo(60, 2);
    expect(geometry.area).toBeCloseTo(180, 2);
    expect(extended.isDirty).toBe(true);
  });

  it('rejects invalid values and treats unchanged or missing objects as no-ops', () => {
    const initial = state(corridor);
    const id = corridor.id;
    const actions = [
      {
        type: 'update_object_position',
        objectId: id,
        position: getCityDesignGeometryCenter(corridor.geometry),
      },
      { type: 'update_object_position', objectId: id, position: { x: Infinity, z: 0 } },
      { type: 'update_object_width', objectId: id, width: 3 },
      { type: 'update_object_width', objectId: id, width: 0 },
      { type: 'update_object_length', objectId: id, length: 20 },
      { type: 'update_object_length', objectId: id, length: NaN },
      { type: 'rotate_object', objectId: id, rotationDeg: 0 },
      { type: 'rotate_object', objectId: id, rotationDeg: Infinity },
      { type: 'update_object_unit_cost', objectId: id, unitCostMinor: null },
      { type: 'update_object_unit_cost', objectId: id, unitCostMinor: -1 },
      { type: 'update_object_unit_cost', objectId: id, unitCostMinor: NaN },
      {
        type: 'update_object_property',
        objectId: id,
        key: 'lanes',
        value: corridor.properties.lanes,
      },
      { type: 'update_object_property', objectId: id, key: 'lanes', value: -1 },
      { type: 'update_object_position', objectId: 'missing', position: { x: 5, z: 5 } },
    ] as const;
    for (const action of actions) expect(cityDesignReducer(initial, action)).toBe(initial);
  });

  it('round-trips edited geometry, properties and minor-unit cost through the existing stored format', () => {
    let edited = cityDesignReducer(state(polygon), {
      type: 'update_object_position',
      objectId: polygon.id,
      position: { x: -10, z: 15 },
    });
    edited = cityDesignReducer(edited, {
      type: 'rotate_object',
      objectId: polygon.id,
      rotationDeg: 30,
    });
    edited = cityDesignReducer(edited, {
      type: 'update_object_property',
      objectId: polygon.id,
      key: 'height',
      value: 12.5,
    });
    edited = cityDesignReducer(edited, {
      type: 'update_object_unit_cost',
      objectId: polygon.id,
      unitCostMinor: 12345,
    });
    const reloaded = parseStoredCityDesignState(JSON.parse(JSON.stringify(edited.design)));
    expect(reloaded?.objects).toEqual(edited.design.objects);
    expect(reloaded?.objects[0].cost.customUnitCostMinor).toBe(12345);
  });
});

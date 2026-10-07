import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import * as registry from '@/features/amendments/city-design/logic/cityDesignObjectRegistry';
import { createPolygonGeometry } from '@/features/amendments/city-design/logic/cityDesignPlacement';
import { applyCityDesignOsmSemanticMapping } from '@/features/amendments/city-design/logic/cityDesignOsmMapping';
import type {
  CityDesignObject,
  CityDesignPropertyValue,
  CityDesignStateV1,
} from '@/features/amendments/city-design/types';
import { cityActionSchema, type CityAction } from '../contracts';
import { applyCityActions, cityCatalog, validateCityProperties } from '../city-actions';

const objectId = '00000000-0000-4000-a000-000000000001';
const generatedId = '00000000-0000-4000-a000-000000000002';
const point = { kind: 'point', point: { x: 2, z: 3 }, rotationDeg: 0 } as const;
const corridor = {
  kind: 'corridor',
  start: { x: 0, z: 0 },
  end: { x: 10, z: 0 },
  widthMeters: 2,
} as const;
const path = {
  kind: 'path_corridor',
  points: [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
  ],
  widthMeters: 3,
} as const;
const polygon = {
  kind: 'polygon',
  points: [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 5 },
    { x: 0, z: 5 },
  ],
} as const;
const add = (
  objectType: string,
  geometry: unknown,
  properties: Record<string, CityDesignPropertyValue> = {}
): CityAction =>
  cityActionSchema.parse({ type: 'object.add', ref: 'created', objectType, geometry, properties });
const state = () => createEmptyCityDesignState();
const create = (objectType = 'tree', geometry: unknown = point) =>
  applyCityActions(state(), [add(objectType, geometry)], () => objectId).value;

afterEach(() => vi.restoreAllMocks());

describe('project chat city action safety and geometry', () => {
  it.each([
    ['tree', 'point', point],
    ['street', 'corridor', corridor],
    ['street', 'path_corridor', path],
    ['building', 'polygon', polygon],
  ])(
    'creates a %s with %s geometry, local references and recalculated costs',
    (type, kind, geometry) => {
      const before = state();
      const original = structuredClone(before);
      const result = applyCityActions(before, [add(type as string, geometry)], () => generatedId);
      expect(result.createdRefs).toEqual({ created: generatedId });
      expect(Object.getPrototypeOf(result.createdRefs)).toBeNull();
      expect(result.value.objects[0]).toMatchObject({
        id: generatedId,
        type,
        geometry: { kind },
        cost: { currency: before.currency },
      });
      expect(result.costs.totalCostMinor).toBeGreaterThan(0);
      expect(before).toEqual(original);
      if (kind === 'polygon') expect(result.value.objects[0].geometry).toMatchObject({ area: 20 });
    }
  );

  it.each([
    ['tree', point],
    ['street', corridor],
    ['street', path],
    ['building', polygon],
  ])('translates a %s geometry %j without changing its area or input', (type, geometry) => {
    const before = create(type as string, geometry);
    const original = structuredClone(before);
    const result = applyCityActions(before, [
      { type: 'object.translate', object: { id: objectId }, dxMeters: 7, dzMeters: -2 },
    ]);
    const translated = result.value.objects[0].geometry;
    if (translated.kind === 'point') expect(translated.point).toEqual({ x: 9, z: 1 });
    else if (translated.kind === 'corridor')
      expect(translated).toMatchObject({
        start: { x: 7, z: -2 },
        end: { x: 17, z: -2 },
        length: 10,
        width: 2,
      });
    else expect(translated.points[0]).toEqual({ x: 7, z: -2 });
    expect(result.costs.totalCostMinor).toBe(applyCityActions(before, []).costs.totalCostMinor);
    expect(before).toEqual(original);
  });

  it('patches registered properties and changes geometry and rotation in one atomic batch', () => {
    const before = create();
    const result = applyCityActions(before, [
      { type: 'object.patch', object: { id: objectId }, properties: { height: 8, species: 'oak' } },
      {
        type: 'object.set_geometry',
        object: { id: objectId },
        geometry: { ...point, point: { x: 9, z: 10 } },
      },
      { type: 'object.rotate', object: { id: objectId }, rotationDeg: 90 },
    ]);
    expect(result.value.objects[0]).toMatchObject({
      properties: { height: 8, species: 'oak' },
      geometry: { kind: 'point', point: { x: 9, z: 10 }, rotation: Math.PI / 2 },
    });
    expect(before.objects[0].properties.height).toBe(4);
  });

  it.each([corridor, path])(
    'resizes only corridor widths and recalculates quantities for %j',
    geometry => {
      const before = create('street', geometry);
      const result = applyCityActions(before, [
        { type: 'object.set_width', object: { id: objectId }, widthMeters: 6 },
      ]);
      expect(result.value.objects[0].geometry).toMatchObject({ width: 6 });
      expect(before.objects[0].geometry).toMatchObject({ width: geometry.widthMeters });
      expect(result.costs.totalCostMinor).toBeGreaterThan(
        applyCityActions(before, []).costs.totalCostMinor
      );
    }
  );

  it('rejects width changes on point and polygon objects', () => {
    for (const before of [create(), create('building', polygon)])
      expect(() =>
        applyCityActions(before, [
          { type: 'object.set_width', object: { id: objectId }, widthMeters: 4 },
        ])
      ).toThrow('unsupported_operation');
  });

  it('sets and removes a custom unit cost, then removes the object through its local reference', () => {
    const result = applyCityActions(
      state(),
      [
        add('tree', point),
        { type: 'object.set_unit_cost', object: { localRef: 'created' }, unitCostMinor: 123 },
      ],
      () => objectId
    );
    expect(result.costs.totalCostMinor).toBe(123);
    const cleared = applyCityActions(result.value, [
      { type: 'object.set_unit_cost', object: { id: objectId }, unitCostMinor: null },
    ]);
    expect(cleared.value.objects[0].cost).not.toHaveProperty('customUnitCostMinor');
    expect(cleared.costs.totalCostMinor).toBeGreaterThan(123);
    const removed = applyCityActions(
      state(),
      [add('tree', point), { type: 'object.remove', object: { localRef: 'created' } }],
      () => objectId
    );
    expect(removed.value.objects).toEqual([]);
    expect(removed.costs.totalCostMinor).toBe(0);
  });

  it('rejects missing objects, missing local references and duplicate creation references atomically', () => {
    const before = create();
    const original = structuredClone(before);
    expect(() =>
      applyCityActions(before, [{ type: 'object.remove', object: { id: generatedId } }])
    ).toThrow('invalid_reference');
    expect(() =>
      applyCityActions(before, [{ type: 'object.remove', object: { localRef: 'missing' } }])
    ).toThrow('invalid_reference');
    expect(() => applyCityActions(before, [add('tree', point), add('tree', point)])).toThrow(
      'invalid_reference'
    );
    expect(() =>
      applyCityActions(before, [
        { type: 'object.patch', object: { id: objectId }, properties: { height: 8 } },
        { type: 'object.remove', object: { id: generatedId } },
      ])
    ).toThrow('invalid_reference');
    expect(before).toEqual(original);
  });

  it('rejects unsupported or degenerate polygon creation without leaking a created object', () => {
    expect(() => applyCityActions(state(), [add('tree', polygon)])).toThrow(
      'unsupported_operation'
    );
    expect(() =>
      applyCityActions(state(), [
        add('building', {
          kind: 'polygon',
          points: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 2, z: 0 },
          ],
        }),
      ])
    ).toThrow('Degenerate polygon');
  });

  it('translates an imported editable polygon using its persisted geometry', () => {
    const before = create('building', polygon);
    before.objects[0].geometry = createPolygonGeometry(polygon.points.map(p => ({ ...p })));
    const result = applyCityActions(before, [
      { type: 'object.translate', object: { id: objectId }, dxMeters: -4, dzMeters: 3 },
    ]);
    expect(result.value.objects[0].geometry).toMatchObject({
      area: 20,
      points: [
        { x: -4, z: 3 },
        { x: 0, z: 3 },
        { x: 0, z: 8 },
        { x: -4, z: 8 },
      ],
    });
  });

  it.each([
    ['unknown', 1, 'Unsupported property'],
    ['height', null, 'Unsupported property'],
    ['height', 'tall', 'Invalid number'],
    ['height', Number.NaN, 'Invalid number'],
    ['height', Number.POSITIVE_INFINITY, 'Invalid number'],
    ['height', 0.5, 'Invalid number'],
    ['species', true, 'Invalid text'],
  ])('rejects malformed tree property %s=%s', (key, value, message) => {
    expect(() =>
      validateCityProperties('tree', { [key as string]: value as CityDesignPropertyValue })
    ).toThrow(message as string);
  });

  it('validates numeric minimum boundaries, booleans, select options and unrestricted text', () => {
    expect(() =>
      validateCityProperties('tree', { height: 1, species: 'custom species' })
    ).not.toThrow();
    expect(() =>
      validateCityProperties('street', {
        layerIndex: -2,
        deckElevationMeters: 0,
        laneMarkings: false,
      })
    ).not.toThrow();
    expect(() => validateCityProperties('street', { laneMarkings: 'yes' })).toThrow(
      'Invalid boolean'
    );
    const selectDefinition = Object.values(registry.cityDesignObjectRegistry)
      .map(def => registry.getCityDesignObjectDefinition(def.type))
      .find(def => def.propertySchema.some(field => field.fieldType === 'select'))!;
    const field = selectDefinition.propertySchema.find(
      candidate => candidate.fieldType === 'select'
    )!;
    expect(() =>
      validateCityProperties(selectDefinition.type, { [field.key]: field.options![0].value })
    ).not.toThrow();
    expect(() =>
      validateCityProperties(selectDefinition.type, { [field.key]: 'missing option' })
    ).toThrow('Invalid option');
    expect(() => validateCityProperties(selectDefinition.type, { [field.key]: 123 })).toThrow(
      'Invalid text'
    );
  });

  it('honors an optional numeric upper bound and fails closed for a select without options', () => {
    const definition = registry.getCityDesignObjectDefinition('tree');
    vi.spyOn(registry, 'getCityDesignObjectDefinition').mockReturnValue({
      ...definition,
      propertySchema: [
        { key: 'height', labelKey: 'height', fieldType: 'number', min: 1, max: 20 },
        { key: 'label', labelKey: 'label', fieldType: 'text' },
        { key: 'choice', labelKey: 'choice', fieldType: 'select' },
      ],
    });
    expect(() => validateCityProperties('tree', { height: 20, label: 'Tree' })).not.toThrow();
    expect(() => validateCityProperties('tree', { height: 21 })).toThrow('Invalid number');
    expect(() => validateCityProperties('tree', { label: false })).toThrow('Invalid text');
    expect(() => validateCityProperties('tree', { choice: 'unregistered' })).toThrow(
      'Invalid option'
    );
  });

  it('returns the complete catalog or an exact type subset without mutating the registry', () => {
    const all = cityCatalog();
    expect(all).toEqual(Object.values(registry.cityDesignObjectRegistry));
    expect(cityCatalog([])).toEqual(all);
    expect(cityCatalog(['tree', 'street'])).toEqual([
      registry.cityDesignObjectRegistry.tree,
      registry.cityDesignObjectRegistry.street,
    ]);
    expect(cityCatalog(['missing'])).toEqual([]);
  });

  it('imports a real mapped OpenStreetMap feature with provenance and rejects repeat imports', () => {
    const before = state();
    const feature = applyCityDesignOsmSemanticMapping({
      id: 'charger',
      kind: 'utility',
      geometryKind: 'point',
      point: before.origin,
      tags: { amenity: 'charging_station', capacity: '4' },
      subkind: 'charging_station',
      source: 'osm',
    });
    before.osmSnapshot = {
      fetchedAt: 1,
      bbox: { south: 0, north: 1, west: 0, east: 1 },
      features: [feature],
    };
    const original = structuredClone(before);
    const result = applyCityActions(
      before,
      [{ type: 'osm.import_feature', featureId: 'charger' }],
      () => generatedId
    );
    expect(result.value.objects[0]).toMatchObject({
      id: generatedId,
      type: 'charging_station',
      properties: { capacity: 4 },
      provenance: { source: 'osm', featureId: 'charger', confidence: 'exact' },
    });
    expect(result.costs.totalCostMinor).toBeGreaterThan(0);
    expect(() =>
      applyCityActions(result.value, [{ type: 'osm.import_feature', featureId: 'charger' }])
    ).toThrow('Feature already imported');
    expect(before).toEqual(original);
  });

  it('rejects absent and unconvertible OpenStreetMap features without changing the design', () => {
    const before = state();
    expect(() =>
      applyCityActions(before, [{ type: 'osm.import_feature', featureId: 'missing' }])
    ).toThrow('invalid_reference');
    before.osmSnapshot = {
      fetchedAt: 1,
      bbox: { south: 0, north: 1, west: 0, east: 1 },
      features: [
        {
          id: 'generic',
          kind: 'utility',
          geometryKind: 'point',
          point: before.origin,
          mappingConfidence: 'generic',
          source: 'osm',
        },
      ],
    };
    expect(() =>
      applyCityActions(before, [{ type: 'osm.import_feature', featureId: 'generic' }])
    ).toThrow('Feature cannot be converted');
    expect(before.objects).toEqual([]);
  });

  it('validates the entire resulting projection and rejects invalid persisted input', () => {
    const before: CityDesignStateV1 = state();
    before.objects = [
      {
        ...create().objects[0],
        geometry: { kind: 'point', point: { x: Number.NaN, z: 0 }, rotation: 0 },
      } satisfies CityDesignObject,
    ];
    expect(() => applyCityActions(before, [])).toThrow();
    expect(before.objects[0].geometry.kind).toBe('point');
  });
});

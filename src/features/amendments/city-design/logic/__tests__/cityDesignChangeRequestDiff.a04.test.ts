import { describe, expect, it } from 'vitest';
import type { CityDesignObject, CityDesignStateV1 } from '../../types';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  applyCityDesignChangeRequestToDesign,
  cityDesignChangeRequestDiffInternals,
  createCityDesignPersistenceSnapshot,
  getCityDesignCostChange,
  getCityDesignDesignContext,
  getCityDesignObjectSnapshot,
  getCityDesignSceneSnapshot,
  resolveCityDesignBaseState,
} from '../cityDesignChangeRequestDiff';

const object = (id = 'object'): CityDesignObject => ({
  id,
  type: 'street_lamp',
  geometry: { kind: 'point', point: { x: 1, z: 2 }, rotation: 0 },
  properties: { keep: true, remove: 'old' },
  cost: { rule: 'per_item', currency: 'EUR', suggestedUnitCostMinor: 100 },
});

const state = (objects: CityDesignObject[] = []): CityDesignStateV1 => ({
  ...createEmptyCityDesignState(),
  objects,
});

describe('cityDesignChangeRequestDiff A04 alternatives', () => {
  it('applies valid and invalid scene requests', () => {
    const base = state([object()]);
    const sceneRequest = {
      id: 'scene-request',
      source_type: 'city_design_scene',
      new_properties: {
        scene: {
          origin: { lat: 1, lon: 2 },
          comparisonMode: 'split',
          currency: 'USD',
          costCatalogVersion: 'v2',
        },
      },
    };
    expect(applyCityDesignChangeRequestToDesign(base, sceneRequest).currency).toBe('USD');
    expect(
      applyCityDesignChangeRequestToDesign(base, {
        id: 'invalid-scene-request',
        source_type: 'city_design_scene',
        new_properties: null,
      })
    ).toEqual(base);
  });

  it('handles missing IDs, invalid types, missing snapshots, inserts, and direct updates', () => {
    const baseObject = object();
    const base = state([baseObject]);
    expect(
      applyCityDesignChangeRequestToDesign(base, {
        id: 'unknown-object-request',
        source_type: 'city_design_object',
        change_type: 'unknown',
      })
    ).toEqual(base);
    expect(
      applyCityDesignChangeRequestToDesign(base, {
        id: 'missing-snapshot-request',
        source_type: 'city_design_object',
        source_id: 'object',
        change_type: 'update',
        new_properties: null,
      })
    ).toEqual(base);

    const inserted = object('inserted');
    expect(
      applyCityDesignChangeRequestToDesign(base, {
        id: 'insert-request',
        source_type: 'city_design_object',
        change_type: 'add',
        new_properties: inserted,
      }).objects
    ).toHaveLength(2);

    const direct = { ...baseObject, properties: { direct: true } };
    expect(
      applyCityDesignChangeRequestToDesign(base, {
        id: 'direct-update-request',
        source_type: 'city_design_object',
        change_type: 'update',
        new_properties: direct,
      }).objects[0].properties
    ).toEqual({ direct: true });
    expect(
      applyCityDesignChangeRequestToDesign(base, {
        id: 'remove-request',
        source_type: 'city_design_object',
        change_type: 'remove',
        original_properties: baseObject,
      }).objects
    ).toEqual([]);

    const withUnchangedNeighbor = applyCityDesignChangeRequestToDesign(
      state([baseObject, object('neighbor')]),
      {
        id: 'neighbor-update-request',
        source_type: 'city_design_object',
        source_id: 'object',
        change_type: 'update',
        new_properties: direct,
      }
    );
    expect(withUnchangedNeighbor.objects[1].id).toBe('neighbor');
  });

  it('reports every before/after cost combination', () => {
    const before = object('before');
    const after = { ...object('after'), cost: { ...object().cost, customUnitCostMinor: 250 } };
    expect(getCityDesignCostChange(null, null)).toBeNull();
    expect(getCityDesignCostChange(before, null)).toMatchObject({
      beforeUnitCostMinor: 100,
      afterUnitCostMinor: null,
      afterTotalCostMinor: null,
    });
    expect(getCityDesignCostChange(null, after)).toMatchObject({
      beforeUnitCostMinor: null,
      afterUnitCostMinor: 250,
      beforeTotalCostMinor: null,
    });
    expect(getCityDesignCostChange(before, after)).toMatchObject({
      beforeUnitCostMinor: 100,
      afterUnitCostMinor: 250,
    });
  });

  it('creates persistence snapshots with catalog and currency defaults', () => {
    const base = state();
    const snapshot = createCityDesignPersistenceSnapshot({
      ...base,
      currency: '',
      costCatalogVersion: '',
      osmSnapshot: null,
    });
    expect(snapshot.currency).toBe('EUR');
    expect(snapshot.bbox).toBeNull();
    expect(snapshot.cost_catalog_version).toBeTruthy();
    expect(createCityDesignPersistenceSnapshot(base).currency).toBe('EUR');
  });

  it('resolves stored, explicit fallback, and design-context base states', () => {
    const fallback = state([object()]);
    expect(resolveCityDesignBaseState(null, fallback)).toBe(fallback);
    expect(resolveCityDesignBaseState(fallback).objects).toHaveLength(1);
    const resolved = resolveCityDesignBaseState({
      designContext: { origin: { lat: 8, lon: 9 }, comparisonMode: 'overlay' },
    });
    expect(resolved.origin).toEqual({ lat: 8, lon: 9 });
  });

  it('parses wrapped, direct, invalid object and rich/default scene snapshots', () => {
    const lamp = object();
    expect(getCityDesignObjectSnapshot({ object: lamp })).toEqual(lamp);
    expect(getCityDesignObjectSnapshot(lamp)).toEqual(lamp);
    expect(getCityDesignObjectSnapshot(null)).toBeNull();
    expect(getCityDesignObjectSnapshot({ id: 'bad', type: 'tree' })).toBeNull();
    expect(getCityDesignObjectSnapshot({ id: 1, type: 'tree', geometry: {} })).toBeNull();

    expect(getCityDesignSceneSnapshot(null)).toBeNull();
    const defaults = getCityDesignSceneSnapshot({
      scene: {
        hiddenOsmWayIds: ['one', 2],
        hiddenOsmFeatureIds: 'bad',
        showStreetMarkings: 'bad',
        comparisonMode: 'bad',
        currency: 1,
        costCatalogVersion: 2,
      },
    });
    expect(defaults).toMatchObject({
      hiddenOsmWayIds: ['one'],
      hiddenOsmFeatureIds: undefined,
      showStreetMarkings: undefined,
      comparisonMode: 'overlay',
      currency: 'EUR',
    });
    for (const comparisonMode of ['original', 'new_design', 'overlay', 'split'] as const) {
      expect(getCityDesignSceneSnapshot({ scene: { comparisonMode } })?.comparisonMode).toBe(
        comparisonMode
      );
    }
    expect(
      getCityDesignDesignContext({ designContext: { comparisonMode: 'split', currency: 'USD' } })
        ?.currency
    ).toBe('USD');
    expect(getCityDesignDesignContext([])).toBeNull();
  });

  it('exercises semantic recursion, deletion, array handling, and normalizers', () => {
    const {
      applySemanticChangePatch,
      asRecord,
      asStringArray,
      countChangedValueCharacters,
      flattenKeys,
      isPlainRecord,
      normalizeCityDesignChangeType,
      stableJson,
    } = cityDesignChangeRequestDiffInternals;
    expect(
      ['add', 'remove', 'insert', 'update', 'delete', 'other'].map(normalizeCityDesignChangeType)
    ).toEqual(['insert', 'delete', 'insert', 'update', 'delete', null]);
    expect(countChangedValueCharacters({ a: 1 }, { a: 1 })).toBe(0);
    expect(countChangedValueCharacters({ a: 1 }, { a: 2 })).toBeGreaterThan(0);
    expect(countChangedValueCharacters([1], [2])).toBeGreaterThan(0);
    expect(
      applySemanticChangePatch(
        { keep: 1, remove: 2, currentOnly: 3 },
        { keep: 1, remove: 2, absent: 4 },
        { keep: 5 }
      )
    ).toEqual({ keep: 5, currentOnly: 3 });
    expect(applySemanticChangePatch(1, 1, 1)).toBe(1);
    expect(applySemanticChangePatch(null, { nested: 1 }, { nested: 2 })).toEqual({ nested: 2 });
    expect(asRecord([])).toBeNull();
    expect(asRecord({})).toEqual({});
    expect(asStringArray(['a', 1])).toEqual(['a']);
    expect(asStringArray(null)).toBeUndefined();
    expect(isPlainRecord({})).toBe(true);
    expect(isPlainRecord([])).toBe(false);
    expect(flattenKeys([{ nested: 1 }, null])).toMatchObject({ nested: true });
    expect(flattenKeys(1)).toEqual({});
    expect(stableJson(undefined)).toBe('undefined');

    const emptyPayload = cityDesignChangeRequestDiffInternals.createObjectPayload({
      id: 'empty',
      amendmentId: 'amendment',
      cityDesignId: null,
      changeType: 'update',
      previous: null,
      next: null,
      designContext: getCityDesignSceneSnapshot({ scene: {} })!,
    });
    expect(emptyPayload).toMatchObject({ source_id: null, source_title: expect.any(String) });
  });
});

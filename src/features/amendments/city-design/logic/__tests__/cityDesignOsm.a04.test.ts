import { describe, expect, it } from 'vitest';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  getCityDesignHiddenOsmFeatureIds,
  getCityDesignOsmFeatureLayer,
  getCityDesignOsmFeaturePoints,
  getCityDesignOsmFeatures,
  getCityDesignOsmLayerVisibility,
  isCityDesignFallbackSnapshot,
  normalizeCityDesignOsmFeature,
  normalizeCityDesignOsmSnapshot,
} from '../cityDesignOsm';

const bbox = { south: 0, west: 0, north: 1, east: 1 };
const line = {
  id: 'line',
  kind: 'road' as const,
  geometryKind: 'line' as const,
  points: [
    { lat: 0, lon: 0 },
    { lat: 1, lon: 1 },
  ],
};

describe('cityDesignOsm A04 alternatives', () => {
  it('maps special feature layers and merges visibility defaults', () => {
    expect(getCityDesignOsmFeatureLayer('tree')).toBe('trees');
    expect(getCityDesignOsmFeatureLayer('tree_row')).toBe('trees');
    expect(getCityDesignOsmFeatureLayer('utility')).toBe('street_furniture');
    expect(getCityDesignOsmFeatureLayer('playground')).toBe('sports');
    expect(getCityDesignOsmFeatureLayer('civic_area')).toBe('landuse_context');
    expect(getCityDesignOsmFeatureLayer('road')).toBe('road');
    expect(getCityDesignOsmLayerVisibility(null).road).toBe(true);
    expect(getCityDesignOsmLayerVisibility({ road: false }).road).toBe(false);
  });

  it('extracts point, missing-point, line, and missing-line coordinates', () => {
    expect(
      getCityDesignOsmFeaturePoints({
        id: 'point',
        kind: 'tree',
        geometryKind: 'point',
        point: { lat: 1, lon: 2 },
      })
    ).toEqual([{ lat: 1, lon: 2 }]);
    expect(
      getCityDesignOsmFeaturePoints({ id: 'point', kind: 'tree', geometryKind: 'point' })
    ).toEqual([]);
    expect(getCityDesignOsmFeaturePoints(line)).toHaveLength(2);
    expect(
      getCityDesignOsmFeaturePoints({ id: 'empty', kind: 'road', geometryKind: 'line' })
    ).toEqual([]);
  });

  it('rejects malformed features and infers point, polygon, and line geometry', () => {
    expect(normalizeCityDesignOsmFeature({ kind: 'road' })).toBeNull();
    expect(normalizeCityDesignOsmFeature({ id: 'missing-kind' })).toBeNull();
    expect(
      normalizeCityDesignOsmFeature({ id: 'point-missing', kind: 'tree', geometryKind: 'point' })
    ).toBeNull();
    expect(
      normalizeCityDesignOsmFeature({ id: 'line-short', kind: 'road', points: [] })
    ).toBeNull();
    expect(normalizeCityDesignOsmFeature({ id: 'line-missing-points', kind: 'road' })).toBeNull();
    expect(
      normalizeCityDesignOsmFeature({ id: 'point', kind: 'tree', point: { lat: 1, lon: 2 } })
        ?.geometryKind
    ).toBe('point');
    expect(
      normalizeCityDesignOsmFeature({
        id: 'closed',
        kind: 'road',
        points: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 0, lon: 0 },
        ],
      })?.geometryKind
    ).toBe('polygon');
    expect(normalizeCityDesignOsmFeature({ ...line, geometryKind: undefined })?.geometryKind).toBe(
      'line'
    );
    expect(normalizeCityDesignOsmFeature({ ...line, source: 'sample' })?.source).toBe('sample');
    expect(normalizeCityDesignOsmFeature(line)?.source).toBe('osm');
    expect(normalizeCityDesignOsmFeature({ id: 'empty-building', kind: 'building' })).toBeNull();
  });

  it('normalizes feature and legacy-way snapshots and filters invalid entries', () => {
    expect(normalizeCityDesignOsmSnapshot(null)).toBeNull();
    expect(
      normalizeCityDesignOsmSnapshot({
        fetchedAt: 1,
        bbox,
        features: [line, { id: '', kind: 'road', geometryKind: 'line', points: [] }],
      })?.features
    ).toHaveLength(1);
    expect(
      normalizeCityDesignOsmSnapshot({ fetchedAt: 2, bbox, ways: [line] })?.features
    ).toHaveLength(1);
    expect(getCityDesignOsmFeatures(undefined)).toEqual([]);
  });

  it('detects only non-empty all-fallback snapshots', () => {
    expect(isCityDesignFallbackSnapshot({ fetchedAt: 1, bbox, features: [] })).toBe(false);
    expect(
      isCityDesignFallbackSnapshot({
        fetchedAt: 1,
        bbox,
        features: [{ ...line, source: 'fallback' }],
      })
    ).toBe(true);
    expect(
      isCityDesignFallbackSnapshot({
        fetchedAt: 1,
        bbox,
        features: [
          { ...line, source: 'fallback' },
          { ...line, id: 'osm', source: 'osm' },
        ],
      })
    ).toBe(false);
  });

  it('combines legacy, current, and imported-object hidden feature IDs', () => {
    const design = createEmptyCityDesignState();
    const hidden = getCityDesignHiddenOsmFeatureIds({
      ...design,
      hiddenOsmWayIds: ['legacy'],
      hiddenOsmFeatureIds: ['current'],
      objects: [
        {
          id: 'imported',
          type: 'street_lamp',
          geometry: { kind: 'point', point: { x: 0, z: 0 }, rotation: 0 },
          properties: {},
          cost: { rule: 'per_item', currency: 'EUR', suggestedUnitCostMinor: 1 },
          provenance: { source: 'osm', featureId: 'provenance', confidence: 'exact' },
        },
        {
          id: 'local',
          type: 'street_lamp',
          geometry: { kind: 'point', point: { x: 0, z: 0 }, rotation: 0 },
          properties: {},
          cost: { rule: 'per_item', currency: 'EUR', suggestedUnitCostMinor: 1 },
        },
      ],
    });
    expect([...hidden].sort()).toEqual(['current', 'legacy', 'provenance']);
    expect(getCityDesignHiddenOsmFeatureIds(design).size).toBe(0);
    expect(
      getCityDesignHiddenOsmFeatureIds({
        ...design,
        hiddenOsmWayIds: undefined,
        hiddenOsmFeatureIds: undefined,
      }).size
    ).toBe(0);
  });
});

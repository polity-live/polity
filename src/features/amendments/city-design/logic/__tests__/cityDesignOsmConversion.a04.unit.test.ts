import { describe, expect, it } from 'vitest';
import type { CityDesignOsmFeature } from '../../types';
import {
  cityDesignOsmConversionInternals,
  convertCityDesignOsmFeature,
} from '../cityDesignOsmConversion';

const origin = { lat: 52.52, lon: 13.405 };
let nextId = 0;
const feature = (overrides: Partial<CityDesignOsmFeature> = {}): CityDesignOsmFeature => ({
  id: 'osm-feature',
  kind: 'sidewalk',
  geometryKind: 'line',
  points: [origin, { lat: origin.lat + 0.0001, lon: origin.lon }],
  mappedObjectType: 'sidewalk',
  mappedProperties: {},
  mappingConfidence: 'exact',
  source: 'osm',
  ...overrides,
});

const convert = (osmFeature: CityDesignOsmFeature) =>
  convertCityDesignOsmFeature({
    feature: osmFeature,
    origin,
    createId: () => `converted-${++nextId}`,
  });

describe('cityDesignOsmConversion A04 alternatives', () => {
  it('offsets paths, centers empty sets, samples short and degenerate paths, and defaults provenance', () => {
    const { center, offsetLocalPoints, samplePath, withProvenance } =
      cityDesignOsmConversionInternals;
    const points = [
      { x: 0, z: 0 },
      { x: 0, z: 10 },
    ];
    expect(offsetLocalPoints(points)).toBe(points);
    expect(offsetLocalPoints([{ x: 1, z: 1 }], 2)).toEqual([{ x: 1, z: 1 }]);
    expect(offsetLocalPoints(points, 2)).toEqual([
      { x: -2, z: 0 },
      { x: -2, z: 10 },
    ]);
    expect(
      offsetLocalPoints(
        [
          { x: 1, z: 1 },
          { x: 1, z: 1 },
        ],
        2
      )
    ).toHaveLength(2);
    expect(center([])).toEqual({ x: 0, z: 0 });
    expect(center(points)).toEqual({ x: 0, z: 5 });
    expect(samplePath([{ x: 1, z: 1 }], 2)).toEqual([{ x: 1, z: 1 }]);
    expect(
      samplePath(
        [
          { x: 0, z: 0 },
          { x: 0, z: 0 },
          { x: 0, z: 10 },
        ],
        2
      )
    ).toHaveLength(6);
    expect(
      samplePath(
        [
          { x: 0, z: 0 },
          { x: 100, z: 0 },
        ],
        0.5
      )
    ).toHaveLength(90);
    const bareObject = {
      id: 'object',
      type: 'street_lamp' as const,
      geometry: { kind: 'point' as const, point: { x: 0, z: 0 }, rotation: 0 },
      properties: {},
      cost: { rule: 'per_item' as const, currency: 'EUR', suggestedUnitCostMinor: 1 },
    };
    expect(
      withProvenance(bareObject, feature({ mappingConfidence: undefined })).provenance.confidence
    ).toBe('generic');
  });

  it('rejects unmapped, generic, and empty features', () => {
    expect(convert(feature({ mappedObjectType: undefined }))).toEqual([]);
    expect(convert(feature({ mappingConfidence: 'generic' }))).toEqual([]);
    expect(
      convert(feature({ geometryKind: 'point', points: undefined, point: undefined }))
    ).toEqual([]);
  });

  it('uses default tree spacing when metadata is not numeric', () => {
    const objects = convert(
      feature({
        kind: 'tree_row',
        mappedObjectType: 'tree',
        mappedProperties: { spacing: 'wide' },
      })
    );
    expect(objects.length).toBeGreaterThan(1);
    expect(objects.every(object => object.type === 'tree')).toBe(true);
  });

  it('centers point definitions and merges absent mapped properties', () => {
    const objects = convert(
      feature({
        kind: 'street_furniture',
        mappedObjectType: 'street_lamp',
        mappedProperties: undefined,
      })
    );
    expect(objects[0]).toMatchObject({ type: 'street_lamp', properties: { height: 5 } });
  });

  it('converts short polygons and single-point lines into safe corridors', () => {
    const shortPolygon = convert(
      feature({
        geometryKind: 'polygon',
        points: [origin, { lat: origin.lat + 0.0001, lon: origin.lon }],
        widthMeters: 3,
      })
    );
    expect(shortPolygon[0].geometry).toMatchObject({ kind: 'path_corridor', width: 3 });

    const singlePoint = convert(
      feature({
        geometryKind: 'point',
        points: undefined,
        point: origin,
      })
    );
    expect(singlePoint[0].geometry).toMatchObject({ kind: 'path_corridor' });
  });

  it('converts parking and loading corridors with explicit and default widths', () => {
    const parking = convert(
      feature({ mappedObjectType: 'parking_area', kind: 'parking', widthMeters: 4 })
    );
    const loading = convert(
      feature({ mappedObjectType: 'loading_zone', kind: 'parking', widthMeters: undefined })
    );
    expect(parking[0].geometry).toMatchObject({ kind: 'path_corridor', width: 4 });
    expect(loading[0].geometry).toMatchObject({ kind: 'path_corridor' });
  });

  it('uses definition and explicit widths for ordinary path objects', () => {
    const defaultWidth = convert(feature({ widthMeters: undefined }));
    const explicitWidth = convert(feature({ widthMeters: 5 }));
    expect(defaultWidth[0].geometry).toMatchObject({ kind: 'path_corridor' });
    expect(explicitWidth[0].geometry).toMatchObject({ kind: 'path_corridor', width: 5 });
  });
});

import { describe, expect, it } from 'vitest';
import { applyCityDesignOsmSemanticMapping } from '../cityDesignOsmMapping';
import { convertCityDesignOsmFeature } from '../cityDesignOsmConversion';

const origin = { lat: 52.52, lon: 13.405 };

describe('convertCityDesignOsmFeature', () => {
  it('converts a mapped OSM point with provenance', () => {
    const feature = applyCityDesignOsmSemanticMapping({
      id: 'charger-1',
      kind: 'utility',
      geometryKind: 'point',
      point: origin,
      tags: { amenity: 'charging_station', capacity: '4' },
      subkind: 'charging_station',
      source: 'osm',
    });

    const objects = convertCityDesignOsmFeature({
      feature,
      origin,
      currency: 'USD',
      createId: () => 'new-1',
    });

    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      id: 'new-1',
      type: 'charging_station',
      properties: { capacity: 4 },
      provenance: { source: 'osm', featureId: 'charger-1', confidence: 'exact' },
      cost: { currency: 'USD' },
    });
  });

  it('keeps OSM area geometry as an editable polygon', () => {
    const feature = applyCityDesignOsmSemanticMapping({
      id: 'square-1',
      kind: 'landuse_context',
      geometryKind: 'polygon',
      points: [
        origin,
        { lat: origin.lat, lon: origin.lon + 0.0001 },
        { lat: origin.lat + 0.0001, lon: origin.lon + 0.0001 },
        origin,
      ],
      tags: { place: 'square', surface: 'paving_stones' },
      source: 'osm',
    });

    const objects = convertCityDesignOsmFeature({ feature, origin, createId: () => 'new-2' });

    expect(objects[0]?.type).toBe('public_space');
    expect(objects[0]?.geometry.kind).toBe('polygon');
    expect(objects[0]?.geometry.kind === 'polygon' ? objects[0].geometry.area : 0).toBeGreaterThan(
      0
    );
  });

  it('expands a tree row into spaced editable trees', () => {
    let id = 0;
    const feature = applyCityDesignOsmSemanticMapping({
      id: 'trees-1',
      kind: 'tree_row',
      geometryKind: 'line',
      points: [origin, { lat: origin.lat + 0.00025, lon: origin.lon }],
      tags: { natural: 'tree_row', spacing: '6' },
      source: 'osm',
    });

    const objects = convertCityDesignOsmFeature({
      feature,
      origin,
      createId: () => `tree-${++id}`,
    });

    expect(objects.length).toBeGreaterThan(3);
    expect(
      objects.every(object => object.type === 'tree' && object.geometry.kind === 'point')
    ).toBe(true);
  });
});

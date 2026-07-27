import { describe, expect, it } from 'vitest';
import {
  applyCityDesignOsmSemanticMapping,
  getCityDesignOsmRoadWidthMeters,
  getCityDesignOsmSemanticMapping,
  getCityDesignOsmSideWidthMeters,
} from '../cityDesignOsmMapping';

describe('cityDesignOsmMapping', () => {
  it('maps lane metadata and explicit carriageway width to a street', () => {
    const tags = {
      highway: 'primary',
      lanes: '3',
      oneway: 'yes',
      surface: 'asphalt',
      maxspeed: '50',
      'turn:lanes': 'left|through|right',
      'lanes:bus': '1',
      'width:carriageway': '10.5',
    };
    const mapping = getCityDesignOsmSemanticMapping({
      kind: 'road',
      geometryKind: 'line',
      tags,
      source: 'osm',
    });

    expect(getCityDesignOsmRoadWidthMeters(tags)).toBe(10.5);
    expect(mapping).toMatchObject({
      objectType: 'street',
      confidence: 'exact',
      renderProfile: 'road',
      properties: {
        lanes: 3,
        direction: 'one_way',
        maxspeed: 50,
        turnLanes: 'left|through|right',
        busLanes: 1,
      },
    });
  });

  it('derives side widths from detailed sidewalk, cycleway, and parking tags', () => {
    const tags = {
      'sidewalk:right:width': '3',
      'cycleway:right': 'track',
      'cycleway:right:width': '2.6',
      'parking:right': 'street_side',
      'parking:right:orientation': 'perpendicular',
    };

    expect(getCityDesignOsmSideWidthMeters({ tags, kind: 'sidewalk', side: 'right' })).toBe(3);
    expect(getCityDesignOsmSideWidthMeters({ tags, kind: 'bike_lane', side: 'right' })).toBe(2.6);
    expect(getCityDesignOsmSideWidthMeters({ tags, kind: 'parking', side: 'right' })).toBe(4.8);
  });

  it.each([
    [{ kind: 'barrier', subkind: 'kerb', tags: { barrier: 'kerb', kerb: 'lowered' } }, 'kerb'],
    [{ kind: 'traffic', subkind: 'stop', tags: { highway: 'stop' } }, 'traffic_sign'],
    [
      { kind: 'utility', subkind: 'charging_station', tags: { amenity: 'charging_station' } },
      'charging_station',
    ],
    [{ kind: 'landuse_context', tags: { place: 'square' } }, 'public_space'],
  ] as const)('maps common planning features to editable types', (input, objectType) => {
    const feature = applyCityDesignOsmSemanticMapping({
      id: `osm-${objectType}`,
      geometryKind:
        objectType === 'charging_station' || objectType === 'traffic_sign' ? 'point' : 'line',
      point:
        objectType === 'charging_station' || objectType === 'traffic_sign'
          ? { lat: 0, lon: 0 }
          : undefined,
      points:
        objectType === 'charging_station' || objectType === 'traffic_sign'
          ? undefined
          : [
              { lat: 0, lon: 0 },
              { lat: 0, lon: 0.001 },
            ],
      source: 'osm',
      ...input,
    });

    expect(feature.mappedObjectType).toBe(objectType);
    expect(feature.mappingConfidence).toBe('exact');
  });
});

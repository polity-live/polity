import { describe, expect, it } from 'vitest';
import type { CityDesignOsmFeature, CityDesignOsmFeatureKind } from '../../types';
import {
  applyCityDesignOsmSemanticMapping,
  cityDesignOsmMappingInternals,
  getCityDesignOsmRoadWidthMeters,
  getCityDesignOsmSemanticMapping,
  getCityDesignOsmSideWidthMeters,
} from '../cityDesignOsmMapping';

function mapping(kind: CityDesignOsmFeatureKind, overrides: Partial<CityDesignOsmFeature> = {}) {
  return getCityDesignOsmSemanticMapping({ kind, geometryKind: 'line', ...overrides });
}

describe('cityDesignOsmMapping A04 alternatives', () => {
  it('parses invalid, rounded, empty, side-specific, and compact property values', () => {
    const { compactProperties, finiteNumber, integer, sidePropertyTag, sideTag, stringValue } =
      cityDesignOsmMappingInternals;
    expect(finiteNumber(undefined)).toBeUndefined();
    expect(finiteNumber('not-a-number')).toBeUndefined();
    expect(finiteNumber('1,25')).toBe(1.25);
    expect(integer(undefined)).toBeUndefined();
    expect(integer('-2.6')).toBe(0);
    expect(stringValue('')).toBeUndefined();
    expect(stringValue('value')).toBe('value');
    expect(compactProperties({ present: 0, absent: undefined })).toEqual({ present: 0 });
    expect(sideTag({ cycleway: 'lane' }, 'cycleway')).toBe('lane');
    expect(sideTag({ 'cycleway:both': 'track' }, 'cycleway', 'left')).toBe('track');
    expect(sideTag({ cycleway: 'lane' }, 'cycleway', 'right')).toBe('lane');
    expect(sidePropertyTag({ 'parking:width': '2' }, 'parking', 'width')).toBe('2');
    expect(sidePropertyTag({ 'parking:both:width': '3' }, 'parking', 'width', 'left')).toBe('3');
    expect(sidePropertyTag({ 'parking:width': '4' }, 'parking', 'width', 'left')).toBe('4');
    expect(sidePropertyTag({ width: '5' }, 'parking', 'width', 'left')).toBe('5');
  });

  it('covers all inferred road and side width fallbacks', () => {
    expect(getCityDesignOsmRoadWidthMeters({ width: '0', lanes: '1' })).toBe(3.25);
    expect(getCityDesignOsmRoadWidthMeters({ highway: 'motorway' })).toBe(7.2);
    expect(getCityDesignOsmRoadWidthMeters({ highway: 'trunk' })).toBe(7.2);
    expect(getCityDesignOsmRoadWidthMeters({ highway: 'primary' })).toBe(6.5);
    expect(getCityDesignOsmRoadWidthMeters({ highway: 'service' })).toBe(3.5);
    expect(getCityDesignOsmRoadWidthMeters({ highway: 'living_street' })).toBe(4.5);
    expect(getCityDesignOsmRoadWidthMeters({})).toBe(4.8);
    expect(getCityDesignOsmSideWidthMeters({ tags: {}, kind: 'sidewalk', side: 'left' })).toBe(2.4);
    expect(
      getCityDesignOsmSideWidthMeters({
        tags: { 'cycleway:left': 'sidepath' },
        kind: 'bike_lane',
        side: 'left',
      })
    ).toBe(2.4);
    expect(getCityDesignOsmSideWidthMeters({ tags: {}, kind: 'bike_lane', side: 'left' })).toBe(
      1.8
    );
    expect(
      getCityDesignOsmSideWidthMeters({
        tags: { 'parking:left:orientation': 'diagonal' },
        kind: 'parking',
        side: 'left',
      })
    ).toBe(3.6);
    expect(getCityDesignOsmSideWidthMeters({ tags: {}, kind: 'parking', side: 'left' })).toBe(2.3);
  });

  it('maps road, path, bike, parking, tree, building, and rail alternatives', () => {
    expect(
      mapping('road', {
        tags: {
          highway: 'construction',
          oneway: '1',
          lane_markings: 'no',
          maxspeed: 'bad',
        },
        level: 'bridge',
        source: 'derived',
      })
    ).toMatchObject({
      confidence: 'derived',
      properties: { roadClass: 'construction', direction: 'one_way', status: 'construction' },
    });
    expect(
      mapping('sidewalk', {
        subkind: 'steps',
        tags: { steps: '8', tactile_paving: 'yes' },
      })
    ).toMatchObject({ objectType: 'stairs', properties: { steps: 8, tactilePaving: true } });
    expect(
      mapping('sidewalk', {
        side: 'left',
        tags: { highway: 'pedestrian', surface: 'gravel', wheelchair: 'no' },
      })
    ).toMatchObject({
      properties: { surface: 'gravel', pathType: 'promenade', accessibility: false },
    });
    expect(mapping('sidewalk', { tags: { tactile_paving: 'yes' } }).renderProfile).toBe('tactile');
    expect(mapping('bike_lane', { tags: { oneway: '-1', segregated: 'yes' } })).toMatchObject({
      properties: { protection: 'protected', direction: 'backward' },
    });
    expect(
      mapping('parking', {
        subkind: 'loading_zone',
        tags: { orientation: 'diagonal', surface: '' },
      })
    ).toMatchObject({ objectType: 'loading_zone', properties: { orientation: 'angled' } });
    expect(mapping('parking', { tags: {} })).toMatchObject({
      objectType: 'parking_area',
      properties: { orientation: 'parallel' },
    });
    expect(
      mapping('tree_row', { tags: { genus: 'acer', height: '5', spacing: '7' } })
    ).toMatchObject({
      properties: { species: 'acer', height: 5, spacing: 7 },
    });
    expect(mapping('building', { semanticUse: 'office', tags: {} })).toMatchObject({
      properties: { use: 'office' },
    });
    expect(mapping('rail', { tags: { railway: 'light_rail' } }).properties.railType).toBe(
      'light_rail'
    );
    expect(mapping('rail', { tags: { railway: 'rail' } }).properties.railType).toBe('rail');
    expect(mapping('rail', { tags: {} }).properties.railType).toBe('tram');
  });

  it('maps every transit and barrier decision', () => {
    expect(
      mapping('transit', { geometryKind: 'point', tags: { railway: 'subway_entrance' } }).objectType
    ).toBe('building_entrance');
    expect(mapping('transit', { tags: { railway: 'platform' } }).properties.platformType).toBe(
      'rail_platform'
    );
    expect(
      mapping('transit', { geometryKind: 'polygon', tags: { tram: 'yes' } }).properties.platformType
    ).toBe('tram_stop');
    expect(mapping('transit', { geometryKind: 'line', tags: {} }).properties.platformType).toBe(
      'bus_platform'
    );
    expect(
      mapping('transit', { geometryKind: 'point', tags: { railway: 'tram_stop' } }).properties
        .transportMode
    ).toBe('tram');
    expect(mapping('transit', { geometryKind: 'point', tags: {} }).properties.transportMode).toBe(
      'bus'
    );
    expect(mapping('barrier', { subkind: 'fence', tags: {} })).toMatchObject({
      objectType: 'fence',
      properties: { material: 'metall' },
    });
    expect(mapping('barrier', { subkind: 'lift_gate', tags: {} }).objectType).toBe('gate');
    expect(mapping('barrier', { subkind: 'cycle_barrier', tags: {} }).objectType).toBe('gate');
    expect(mapping('barrier', { tags: {} })).toMatchObject({
      objectType: 'bollard',
      properties: { bollardType: 'fixed' },
    });
  });

  it('maps traffic, utility, water, green, and land-use alternatives', () => {
    expect(mapping('traffic', { tags: { traffic_calming: 'island' } })).toMatchObject({
      objectType: 'traffic_island',
      properties: { islandType: 'calming', surface: 'paving_stones' },
    });
    expect(
      mapping('traffic', {
        tags: { 'area:highway': 'traffic_island', 'crossing:island': 'yes' },
      }).properties.islandType
    ).toBe('refuge');
    expect(
      mapping('traffic', { subkind: 'crossing', tags: { 'crossing:island': 'yes' } }).properties
        .crossingType
    ).toBe('refuge');
    expect(
      mapping('traffic', {
        subkind: 'crossing',
        tags: { crossing: 'traffic_signals' },
      }).properties.crossingType
    ).toBe('signalized');
    expect(mapping('traffic', { subkind: 'crossing', tags: {} }).properties.crossingType).toBe(
      'zebra'
    );
    expect(mapping('traffic', { tags: { traffic_calming: 'hump' } }).objectType).toBe(
      'traffic_calming'
    );
    expect(mapping('traffic', { tags: { traffic_sign: 'DE:205' } }).properties.signType).toBe(
      'DE:205'
    );
    expect(mapping('utility', { subkind: 'toilets', tags: {} }).objectType).toBe('public_toilet');
    expect(mapping('utility', { subkind: 'taxi', tags: { capacity: '4' } }).objectType).toBe(
      'taxi_stand'
    );
    expect(mapping('water', { geometryKind: 'point', tags: {} }).properties.waterType).toBe(
      'decorative'
    );
    expect(
      mapping('water', { geometryKind: 'point', tags: { amenity: 'drinking_water' } }).properties
        .waterType
    ).toBe('drinking');
    expect(mapping('water', { subkind: 'wetland', tags: {} }).objectType).toBe('wetland_area');
    expect(mapping('green', { subkind: 'heath', tags: {} }).objectType).toBe('heath_area');
    expect(mapping('green', { subkind: 'flower_bed', tags: {} }).objectType).toBe('flower_bed');
    expect(mapping('green', { subkind: 'orchard', tags: {} }).objectType).toBe('orchard_area');
    expect(mapping('green', { subkind: 'vineyard', tags: {} }).objectType).toBe('vineyard_area');
    expect(
      mapping('landuse_context', { tags: { amenity: 'marketplace' } }).properties.publicSpaceType
    ).toBe('marketplace');
    expect(mapping('landuse_context', { tags: {} }).objectType).toBe('landuse_context_area');
  });

  it('keeps unsupported features generic and omits their mapped object type', () => {
    const unsupported = applyCityDesignOsmSemanticMapping({
      id: 'unsupported',
      kind: 'unsupported' as CityDesignOsmFeatureKind,
      geometryKind: 'point',
      point: { lat: 0, lon: 0 },
      source: 'sample',
    });
    expect(unsupported.mappedObjectType).toBeUndefined();
    expect(unsupported.mappingConfidence).toBe('generic');
  });
});

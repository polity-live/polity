import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchOverpassSnapshot,
  normalizeOverpassPayload,
  overpassStreetSceneInternals as internals,
} from '../overpass-street-scene';

const bbox = { south: 0, west: 0, north: 0.01, east: 0.01 };
const line = [
  { lat: 0, lon: 0 },
  { lat: 0.01, lon: 0.01 },
];
const ring = [...line, { lat: 0.01, lon: 0 }, line[0]];

describe('overpass street scene A04 classification alternatives', () => {
  it('validates each invalid and oversized bounding-box dimension', () => {
    expect(() => internals.assertSmallBoundingBox({ ...bbox, north: 0 })).toThrow(/invalid/i);
    expect(() => internals.assertSmallBoundingBox({ ...bbox, east: 0 })).toThrow(/invalid/i);
    expect(() => internals.assertSmallBoundingBox({ ...bbox, north: 0.03 })).toThrow(/too large/i);
    expect(() => internals.assertSmallBoundingBox({ ...bbox, east: 0.03 })).toThrow(/too large/i);
    expect(() => internals.assertSmallBoundingBox(bbox)).not.toThrow();
  });

  it('classifies all way families and rejection paths', () => {
    const classify = internals.classifyWay;
    expect(classify(undefined)).toBeNull();
    expect(classify({ building: 'yes' })).toBe('building');
    expect(classify({ railway: 'rail' })).toBe('rail');
    expect(classify({ railway: 'station' })).toBe('transit');
    expect(classify({ public_transport: 'platform' })).toBe('transit');
    expect(classify({ highway: 'bus_stop' })).toBe('transit');
    expect(classify({ amenity: 'bus_station' })).toBe('transit');
    expect(classify({ natural: 'tree_row' })).toBe('tree_row');
    expect(classify({ natural: 'water' })).toBe('water');
    expect(classify({ water: 'pond' })).toBe('water');
    expect(classify({ waterway: 'stream' })).toBe('water');
    expect(classify({ natural: 'wetland' })).toBe('water');
    expect(classify({ amenity: 'drinking_water' })).toBe('water');
    expect(classify({ amenity: 'parking' })).toBe('parking');
    expect(classify({ parking: 'lane' })).toBe('parking');
    expect(classify({ parking: 'lane', highway: 'residential' })).toBe('road');
    expect(classify({ 'area:highway': 'traffic_island' })).toBe('traffic');
    expect(classify({ place: 'square' })).toBe('landuse_context');
    expect(classify({ amenity: 'marketplace' })).toBe('landuse_context');
    expect(classify({ highway: 'pedestrian', area: 'yes' })).toBe('landuse_context');
    expect(classify({ leisure: 'playground' })).toBe('playground');
    expect(classify({ leisure: 'pitch' })).toBe('sports');
    expect(classify({ landuse: 'brownfield' })).toBe('construction');
    expect(classify({ landuse: 'industrial' })).toBe('landuse_context');
    expect(classify({ amenity: 'school' })).toBe('civic_area');
    expect(classify({ barrier: 'wall' })).toBe('barrier');
    expect(classify({ amenity: 'bench' })).toBe('street_furniture');
    expect(classify({ amenity: 'toilets' })).toBe('utility');
    expect(classify({ man_made: 'bridge' })).toBe('construction');
    expect(classify({ traffic_calming: 'table' })).toBe('traffic');
    expect(classify({ leisure: 'garden' })).toBe('green');
    expect(classify({ natural: 'wood' })).toBe('green');
    expect(classify({ landuse: 'meadow' })).toBe('green');
    expect(classify({ 'garden:type': 'residential' })).toBe('green');
    expect(classify({})).toBeNull();
    expect(classify({ highway: 'give_way' })).toBe('traffic');
    expect(classify({ highway: 'bridleway' })).toBe('sidewalk');
    expect(classify({ highway: 'cycleway' })).toBe('bike_lane');
    expect(classify({ highway: 'path', bicycle: 'designated' })).toBe('bike_lane');
    expect(classify({ highway: 'path' })).toBe('sidewalk');
    expect(classify({ highway: 'residential' })).toBe('road');
    expect(classify({ highway: 'raceway' })).toBeNull();
  });

  it('classifies all point families and unknown points', () => {
    const classify = internals.classifyPoint;
    expect(classify({ railway: 'platform' })).toBe('transit');
    expect(classify({ entrance: 'main' })).toBe('utility');
    expect(classify({ barrier: 'gate' })).toBe('barrier');
    expect(classify({ amenity: 'bicycle_parking' })).toBe('street_furniture');
    expect(classify({ amenity: 'drinking_water' })).toBe('water');
    expect(classify({ amenity: 'charging_station' })).toBe('utility');
    expect(classify({ highway: 'give_way' })).toBe('traffic');
    expect(classify({ public_transport: 'stop_position' })).toBe('transit');
    expect(classify({})).toBeNull();
  });
});

describe('overpass street scene A04 geometry alternatives', () => {
  it('stitches all segment orientations and handles open and empty sets', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 1 };
    const c = { lat: 1, lon: 1 };
    const d = { lat: 1, lon: 0 };
    expect(
      internals.stitchRelationSegments([
        [a, b],
        [c, b],
        [c, d],
        [d, a],
      ])
    ).toHaveLength(5);
    expect(
      internals.stitchRelationSegments([
        [b, c],
        [a, b],
        [d, a],
        [c, d],
      ])
    ).toHaveLength(5);
    expect(
      internals.stitchRelationSegments([
        [b, a],
        [b, c],
        [c, d],
        [d, a],
      ])
    ).toHaveLength(5);
    expect(
      internals.stitchRelationSegments([
        [a, b],
        [d, c],
      ])
    ).toBeNull();
    expect(internals.stitchRelationSegments([[a, b, c], [d]])).toHaveLength(3);
    expect(internals.stitchRelationSegments([[a], [b]])).toBeNull();
  });

  it('resolves direct geometry, relation members, and absent geometry', () => {
    expect(internals.getElementGeometryPoints({ type: 'way', id: 1, geometry: line })).toEqual(
      line
    );
    expect(internals.getElementGeometryPoints({ type: 'relation', id: 2, geometry: line })).toEqual(
      line
    );
    expect(internals.getElementGeometryPoints({ type: 'way', id: 3 })).toBeNull();
    expect(internals.getElementGeometryPoints({ type: 'relation', id: 4 })).toBeNull();
    expect(
      internals.getElementGeometryPoints({
        type: 'relation',
        id: 5,
        members: [
          { type: 'node', ref: 1, geometry: line },
          { type: 'way', ref: 2, role: 'inner', geometry: line },
          { type: 'way', ref: 3, role: 'outer' },
          { type: 'way', ref: 4, role: 'outer', geometry: [line[0]] },
        ],
      })
    ).toBeNull();
  });

  it('chooses every line/polygon geometry alternative', () => {
    const geometry = internals.getFeatureGeometryKind;
    expect(geometry('road', line)).toBe('line');
    for (const kind of [
      'barrier',
      'traffic',
      'transit',
      'street_furniture',
      'utility',
      'parking',
      'water',
    ] as const) {
      expect(geometry(kind, line)).toBe('line');
      expect(geometry(kind, ring)).toBe('polygon');
    }
    expect(geometry('green', ring)).toBe('polygon');
  });

  it('handles point predicates and coordinate helpers', () => {
    expect(internals.hasPointGeometry({ type: 'node', id: 1, lat: 1, lon: 2 })).toBe(true);
    expect(internals.hasPointGeometry({ type: 'way', id: 1, lat: 1, lon: 2 })).toBe(false);
    expect(internals.hasPointGeometry({ type: 'node', id: 1, lat: Number.NaN, lon: 2 })).toBe(
      false
    );
    expect(internals.toGeoPoints(line)).toEqual(line);
    expect(internals.isSameGeoPoint(line[0], { ...line[0] })).toBe(true);
    expect(internals.isSameGeoPoint(undefined, line[0])).toBe(false);
  });
});

describe('overpass street scene A04 metadata alternatives', () => {
  it('resolves explicit and inferred widths', () => {
    const width = internals.getFeatureWidthMeters;
    expect(width('road', { width: '7.5' })).toBe(7.5);
    expect(width('sidewalk', { width: 'bad' })).toBe(2.4);
    expect(width('bike_lane', {})).toBe(2);
    expect(width('parking', {})).toBe(2.5);
    expect(width('tree_row', {})).toBe(1.8);
    expect(width('rail', {})).toBe(1.6);
    expect(width('water', { waterway: 'stream' })).toBe(2);
    expect(width('water', { waterway: 'ditch' })).toBe(1.4);
    expect(width('barrier', { barrier: 'wall' })).toBe(0.5);
    expect(width('barrier', { barrier: 'hedge' })).toBe(0.8);
    expect(width('barrier', { barrier: 'gate' })).toBe(0.3);
    expect(width('traffic', { highway: 'crossing' })).toBe(3);
    expect(width('traffic', {})).toBe(1.2);
    expect(width('transit', {})).toBe(2.8);
    expect(width('road', { highway: 'residential' })).toBeGreaterThan(0);
    expect(width('green', {})).toBeUndefined();
  });

  it('parses numeric, level, truthiness, and structure metadata', () => {
    expect(internals.parseFiniteNumber(undefined)).toBeUndefined();
    expect(internals.parseFiniteNumber('unknown')).toBeUndefined();
    expect(internals.parseFiniteNumber('9'.repeat(400))).toBeUndefined();
    expect(internals.parseFiniteNumber('height 3,5 m')).toBe(3.5);
    expect(internals.parseInteger('3.6')).toBe(4);
    expect(internals.parseInteger(undefined)).toBeUndefined();
    expect(internals.isTruthyOsmTag(undefined)).toBe(false);
    expect(internals.isTruthyOsmTag('no')).toBe(false);
    expect(internals.isTruthyOsmTag('yes')).toBe(true);
    expect(internals.getFeatureLayerIndex({})).toBe(0);
    expect(internals.getFeatureLevel({ man_made: 'bridge' })).toBe('bridge');
    expect(internals.getFeatureLevel({ railway: 'subway' })).toBe('tunnel');
    expect(internals.getFeatureLevel({})).toBe('surface');

    const structure = internals.getFeatureStructureKind;
    expect(structure('sidewalk', { 'area:highway': 'steps' })).toBe('steps');
    expect(structure('rail', { railway: 'subway' })).toBe('tunnel');
    expect(structure('road', { cutting: 'yes' })).toBe('cutting');
    expect(structure('road', { bridge: 'viaduct' })).toBe('viaduct');
    expect(structure('road', { bridge: 'yes', 'bridge:structure': 'viaduct' })).toBe('viaduct');
    expect(structure('road', { bridge: 'yes', 'bridge:support': 'viaduct' })).toBe('viaduct');
    expect(structure('road', { man_made: 'bridge' })).toBe('bridge');
    expect(structure('road', { embankment: 'yes' })).toBe('embankment');
    expect(structure('rail', { layer: '1' })).toBe('embankment');
    expect(structure('green', {})).toBeUndefined();
  });

  it('resolves clearance, steps, deck elevations, and elevation sources', () => {
    expect(internals.getFeatureClearanceMeters({ 'maxheight:physical': '4.2' })).toBe(4.2);
    expect(internals.getFeatureClearanceMeters({ maxheight: '4.1' })).toBe(4.1);
    expect(internals.getFeatureClearanceMeters({ min_height: '3.8' })).toBe(3.8);
    expect(internals.getFeatureStepCount({ steps: '10' })).toBe(10);
    const deck = internals.getFeatureDeckElevationMeters;
    const value = (overrides: Record<string, unknown>) =>
      deck({ kind: 'road', tags: {}, layerIndex: 0, ...overrides } as never);
    expect(value({ structureKind: 'tunnel' })).toBe(-2.4);
    expect(value({ structureKind: 'cutting' })).toBe(-1.4);
    expect(value({ structureKind: 'steps', tags: { incline: 'down' } })).toBeLessThan(0);
    expect(value({ structureKind: 'steps', stepCount: 2, tags: { incline: 'up' } })).toBe(0.6);
    expect(value({ tags: { height: '4' } })).toBe(4);
    expect(value({ structureKind: 'bridge', clearanceMeters: 4 })).toBe(4.45);
    expect(value({ structureKind: 'viaduct' })).toBe(6.5);
    expect(
      deck({ kind: 'rail', tags: {}, layerIndex: 3, structureKind: 'viaduct' })
    ).toBeGreaterThan(8);
    expect(value({ structureKind: 'embankment' })).toBe(3.4);
    expect(deck({ kind: 'rail', tags: {}, layerIndex: 0, structureKind: 'embankment' })).toBe(4.5);
    expect(value({ structureKind: 'bridge' })).toBe(3.6);
    expect(deck({ kind: 'rail', tags: {}, layerIndex: 0, structureKind: 'bridge' })).toBe(5.2);
    expect(value({ layerIndex: 2 })).toBeGreaterThan(0);
    expect(deck({ kind: 'water', tags: {}, layerIndex: 0 })).toBe(-0.08);
    expect(deck({ kind: 'green', tags: {}, layerIndex: 0 })).toBe(0);
    expect(internals.getFeatureBaseElevationMeters('tunnel')).toBe(-2.4);
    expect(internals.getFeatureBaseElevationMeters('cutting')).toBe(-1.4);
    expect(internals.getFeatureBaseElevationMeters(undefined)).toBe(0);
    expect(
      internals.getFeatureElevationSource({ tags: { clearance: '4' }, deckElevationMeters: 0 })
    ).toBe('osm');
    expect(
      internals.getFeatureElevationSource({
        tags: {},
        deckElevationMeters: 1,
        structureKind: undefined,
      })
    ).toBe('heuristic');
    expect(internals.getFeatureElevationSource({ tags: {}, deckElevationMeters: 0 })).toBe(
      'surface'
    );
  });

  it('resolves access, building semantics, and all building colors', () => {
    expect(internals.getFeatureAccess({ access: 'destination' })).toBe('destination');
    expect(internals.getFeatureAccess({})).toBe('public');
    const semantic = internals.getBuildingSemanticUse;
    for (const tags of [
      { building: 'commercial' },
      { building: 'office' },
      { amenity: 'library' },
      { amenity: 'restaurant' },
      { building: 'hotel' },
      { building: 'warehouse' },
      { building: 'house' },
      { tourism: 'attraction' },
    ]) {
      expect(semantic(tags as unknown as Record<string, string>)).toBeTruthy();
    }
    expect(semantic({})).toBeUndefined();
    for (const use of [
      'residential',
      'retail',
      'office',
      'civic',
      'hospitality',
      'industrial',
      'significant',
    ]) {
      expect(internals.getBuildingRenderColor(use)).toMatch(/^#/);
    }
    expect(internals.getBuildingRenderColor(undefined)).toBeUndefined();
  });

  it('resolves feature colors and subkinds across every family', () => {
    const color = internals.getFeatureRenderColor;
    for (const [kind, tags] of [
      ['road', { highway: 'construction' }],
      ['road', { highway: 'track' }],
      ['rail', {}],
      ['water', { natural: 'wetland' }],
      ['green', { natural: 'scrub' }],
      ['green', { natural: 'heath' }],
      ['green', { landuse: 'flowerbed' }],
      ['construction', {}],
      ['landuse_context', {}],
      ['sports', {}],
      ['playground', {}],
      ['barrier', { barrier: 'hedge' }],
      ['barrier', { barrier: 'wall' }],
      ['traffic', {}],
      ['transit', {}],
      ['street_furniture', {}],
      ['utility', {}],
    ] as const) {
      expect(color(kind, tags)).toMatch(/^#/);
    }
    expect(color('green', {})).toBeUndefined();

    const subkind = internals.getFeatureSubkind;
    expect(subkind('road', { highway: 'construction' })).toBe('construction');
    expect(subkind('road', { highway: 'track' })).toBe('track');
    expect(subkind('road', { highway: 'secondary' })).toBe('major_road');
    expect(subkind('sidewalk', { highway: 'bridleway' })).toBe('bridleway');
    expect(subkind('rail', { railway: 'subway' })).toBe('subway');
    expect(subkind('rail', { railway: 'tram' })).toBe('tram');
    expect(subkind('water', { natural: 'wetland' })).toBe('wetland');
    expect(subkind('water', { intermittent: 'yes' })).toBe('intermittent');
    expect(subkind('water', { waterway: 'canal' })).toBe('canal');
    expect(subkind('green', { natural: 'shrubbery' })).toBe('scrub');
    expect(subkind('green', { natural: 'heath' })).toBe('heath');
    expect(subkind('green', { landuse: 'vineyard' })).toBe('vineyard');
    expect(subkind('green', { 'garden:type': 'residential' })).toBe('flower_bed');
    expect(subkind('green', { leisure: 'park' })).toBe('park');
    expect(subkind('construction', {})).toBe('construction');
    expect(subkind('sports', {})).toBe('sports');
    expect(subkind('traffic', { crossing: 'zebra' })).toBe('zebra');
    expect(subkind('transit', { public_transport: 'platform' })).toBe('platform');
    expect(subkind('parking', { 'parking:right:restriction': 'loading_only' })).toBe(
      'loading_zone'
    );
    expect(subkind('building', { tourism: 'attraction' })).toBe('significant');
    expect(subkind('building', { building: 'yes' })).toBe('yes');
    expect(subkind('tree', { amenity: 'bench' })).toBe('bench');
    expect(subkind('tree', { landuse: 'grass' })).toBe('grass');
  });
});

describe('overpass street scene A04 side-band alternatives', () => {
  it('collects explicit, both, legacy, absent, and loading-only sides', () => {
    expect(internals.isPresentSideValue(undefined)).toBe(false);
    expect(internals.isPresentSideValue('none')).toBe(false);
    expect(internals.isPresentSideValue('lane')).toBe(true);
    const collect = (tags: Record<string, string>) =>
      internals.collectSideValues(tags, 'sidewalk', new Set(['lane']));
    expect(collect({ 'sidewalk:left': 'lane', 'sidewalk:right': 'separate' })).toEqual(['left']);
    expect(collect({ 'sidewalk:both': 'lane', 'sidewalk:left': 'separate' })).toEqual(['right']);
    expect(collect({})).toEqual([]);
    expect(collect({ sidewalk: 'left' })).toEqual(['left']);
    expect(collect({ sidewalk: 'both' })).toEqual(['left', 'right']);
    expect(collect({ sidewalk: 'lane' })).toEqual(['left', 'right']);
    expect(collect({ sidewalk: 'mystery' })).toEqual([]);
    expect(internals.collectCyclewaySides({ cycleway: 'sidepath' })).toEqual([]);
    expect(internals.collectCyclewaySides({ 'cycleway:left': 'separate' })).toEqual([]);
    expect(internals.collectParkingSides({ 'parking:lane:right': 'parallel' })).toEqual(['right']);
    expect(
      internals.collectLoadingZoneSides({
        'parking:left:restriction': 'loading_only',
        'parking:right:restriction': 'loading_only',
      })
    ).toEqual(['left', 'right']);
    expect(internals.collectLoadingZoneSides({ parking: 'loading_only' })).toEqual(['right']);
    expect(internals.collectLoadingZoneSides({})).toEqual([]);
    expect(internals.hasLoadingZoneTags({ parking: 'loading_only' })).toBe(true);
  });

  it('creates derived features with fallbacks and every band ordering', () => {
    const bare = internals.createDerivedStreetSideFeature({
      feature: { id: 'road', kind: 'road', geometryKind: 'line', source: 'osm' },
      kind: 'sidewalk',
      side: 'left',
      widthMeters: 2,
      offsetMeters: 4,
    });
    expect(bare.points).toEqual([]);
    expect(bare.tags).toMatchObject({ 'polity:derived_from': 'road' });
    expect(bare.offsetMeters).toBe(-4);
    expect(
      internals.createDerivedStreetSideFeatures({
        id: 'not-road',
        kind: 'green',
        geometryKind: 'polygon',
        points: ring,
        tags: {},
        source: 'osm',
      })
    ).toEqual([]);
    expect(
      internals
        .createDerivedStreetSideFeatures({
          id: 'road',
          kind: 'road',
          geometryKind: 'line',
          points: line,
          tags: {
            highway: 'residential',
            sidewalk: 'both',
            cycleway: 'both',
            parking: 'both',
            'parking:left:restriction': 'loading_only',
          },
          source: 'osm',
        })
        .map(feature => [feature.kind, feature.side, feature.subkind])
    ).toEqual(
      expect.arrayContaining([
        ['bike_lane', 'left', undefined],
        ['parking', 'left', 'loading_zone'],
        ['sidewalk', 'right', undefined],
      ])
    );
  });
});

describe('overpass street scene A04 normalization and transport alternatives', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('ignores missing, tagless, unclassified, and geometry-free elements', () => {
    expect(normalizeOverpassPayload(bbox, {}).features).toEqual([]);
    expect(
      normalizeOverpassPayload(bbox, {
        elements: [
          { type: 'node', id: 1, lat: 1, lon: 1 },
          { type: 'node', id: 2, tags: { natural: 'tree' } },
          { type: 'way', id: 3, geometry: line },
          { type: 'way', id: 4, tags: { highway: 'raceway' }, geometry: line },
        ],
      }).features
    ).toEqual([]);
  });

  it('normalizes height fallbacks, relations, and point variants', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0, tags: { entrance: 'main' } },
        { type: 'way', id: 2, geometry: ring, tags: { building: 'yes', height: '12' } },
        {
          type: 'way',
          id: 3,
          geometry: ring,
          tags: { building: 'yes', height: 'bad', 'building:levels': '2' },
        },
        { type: 'way', id: 4, geometry: ring, tags: { building: 'yes' } },
        { type: 'relation', id: 5, geometry: ring, tags: { natural: 'wood' } },
        { type: 'way', id: 6, geometry: line, tags: { highway: 'residential' } },
      ],
    });
    expect(snapshot.features?.find(feature => feature.id === '2')?.height).toBe(12);
    expect(snapshot.features?.find(feature => feature.id === '3')?.height).toBe(6);
    expect(snapshot.features?.find(feature => feature.id === '4')?.height).toBe(9);
    expect(snapshot.features?.find(feature => feature.id === 'relation/5')).toBeTruthy();
    expect(snapshot.features?.find(feature => feature.id === '6')?.height).toBeUndefined();
  });

  it('rotates endpoints, classifies retry statuses, and logs both levels', () => {
    const first = internals.getOverpassEndpointsForRequest();
    const second = internals.getOverpassEndpointsForRequest();
    expect(second[0]).toBe(first[1]);
    expect(internals.shouldRetryOverpassStatus(429)).toBe(true);
    expect(internals.shouldRetryOverpassStatus(500)).toBe(true);
    expect(internals.shouldRetryOverpassStatus(400)).toBe(false);
    internals.logOverpassAttempt({ endpoint: 'ok', attempt: 1, durationMs: 1, status: 200 });
    internals.logOverpassAttempt({ endpoint: 'bad', attempt: 1, durationMs: 1 });
    expect(console.info).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(internals.createFallbackSnapshot(bbox).features).toHaveLength(3);
  });

  it('records a non-Error fetch rejection before succeeding', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce('network unavailable')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    expect((await fetchOverpassSnapshot(bbox)).features).toEqual([]);
  });
});

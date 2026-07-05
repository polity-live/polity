import { describe, expect, it } from 'vitest';
import { buildOverpassQuery, normalizeOverpassPayload } from '../overpass-street-scene';

const bbox = { south: 0, west: 0, north: 1, east: 1 };

describe('overpass street scene normalization', () => {
  it('requests full way geometry instead of center-only output', () => {
    const query = buildOverpassQuery(bbox);

    expect(query).toContain('out tags geom;');
    expect(query).not.toContain('out tags geom center');
    expect(query).toContain('node["amenity"~"bench|bicycle_parking');
    expect(query).toContain('way["railway"~"rail|tram|light_rail|subway');
    expect(query).toContain('way["barrier"~"hedge|fence|wall|gate"]');
    expect(query).toContain('way["landuse"~"allotments|cemetery|forest');
    expect(query).toContain('way["waterway"~"riverbank|river|canal|stream|ditch|drain"]');
    expect(query).toContain('relation["natural"~"water|wetland"]');
    expect(query).toContain('relation["waterway"~"riverbank|river|canal"]');
    expect(query).toContain('way["bridge"]');
    expect(query).toContain('way["bridge:structure"]');
    expect(query).toContain('way["bridge:support"]');
    expect(query).toContain('way["tunnel"]');
    expect(query).toContain('way["layer"]');
    expect(query).toContain('way["embankment"]');
    expect(query).toContain('way["cutting"]');
    expect(query).toContain('way["incline"]');
    expect(query).toContain('way["step_count"]');
    expect(query).toContain('way["ele"]');
    expect(query).toContain('way["height"]');
    expect(query).toContain('way["man_made"="bridge"]');
    expect(query).toContain('way["area:highway"="steps"]');
    expect(query).toContain('relation["bridge:structure"]');
  });

  it('classifies footways as sidewalks instead of roads', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { highway: 'footway' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 1 },
          ],
        },
      ],
    });

    expect(snapshot.features?.[0]?.kind).toBe('sidewalk');
    expect(snapshot.features?.[0]?.geometryKind).toBe('line');
  });

  it('classifies cycleways and cycleway sidepaths as bike lanes', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { highway: 'cycleway' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 1 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { highway: 'path', cycleway: 'sidepath' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.map(feature => feature.kind)).toEqual(['bike_lane', 'bike_lane']);
  });

  it('loads parking areas and street-side parking tags', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { amenity: 'parking', parking: 'surface' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { highway: 'residential', 'parking:right': 'lane' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.find(feature => feature.id === '1')?.kind).toBe('parking');
    expect(snapshot.features?.find(feature => feature.id === '2:parking:right')?.kind).toBe(
      'parking'
    );
  });

  it('loads individual trees and tree rows', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'node',
          id: 1,
          tags: { natural: 'tree' },
          lat: 0.5,
          lon: 0.5,
        },
        {
          type: 'way',
          id: 2,
          tags: { natural: 'tree_row' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.find(feature => feature.id === '1')?.kind).toBe('tree');
    expect(snapshot.features?.find(feature => feature.id === '2')?.kind).toBe('tree_row');
  });

  it('loads riverbank water ways and linear waterways', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { waterway: 'riverbank', name: 'Spree' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { waterway: 'canal' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.find(feature => feature.id === '1')).toMatchObject({
      kind: 'water',
      geometryKind: 'polygon',
      label: 'Spree',
      subkind: 'riverbank',
    });
    expect(snapshot.features?.find(feature => feature.id === '2')).toMatchObject({
      kind: 'water',
      geometryKind: 'line',
      subkind: 'canal',
      widthMeters: 8,
    });
  });

  it('stitches water multipolygon relation outer members', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'relation',
          id: 10,
          tags: { type: 'multipolygon', natural: 'water', water: 'river', name: 'Spree' },
          members: [
            {
              type: 'way',
              ref: 1,
              role: 'outer',
              geometry: [
                { lat: 0, lon: 0 },
                { lat: 0, lon: 1 },
              ],
            },
            {
              type: 'way',
              ref: 2,
              role: 'outer',
              geometry: [
                { lat: 0, lon: 1 },
                { lat: 1, lon: 1 },
              ],
            },
            {
              type: 'way',
              ref: 3,
              role: 'outer',
              geometry: [
                { lat: 1, lon: 1 },
                { lat: 0, lon: 0 },
              ],
            },
          ],
        },
      ],
    });

    expect(snapshot.features?.[0]).toMatchObject({
      id: 'relation/10',
      kind: 'water',
      geometryKind: 'polygon',
      label: 'Spree',
      subkind: 'river',
    });
    expect(snapshot.features?.[0]?.points).toHaveLength(4);
  });

  it('loads point street furniture, traffic, transit, barriers, and utilities', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        { type: 'node', id: 1, tags: { amenity: 'bench' }, lat: 0.1, lon: 0.1 },
        { type: 'node', id: 2, tags: { highway: 'street_lamp' }, lat: 0.2, lon: 0.2 },
        { type: 'node', id: 3, tags: { emergency: 'fire_hydrant' }, lat: 0.3, lon: 0.3 },
        { type: 'node', id: 4, tags: { barrier: 'bollard' }, lat: 0.4, lon: 0.4 },
        { type: 'node', id: 5, tags: { highway: 'traffic_signals' }, lat: 0.5, lon: 0.5 },
        { type: 'node', id: 6, tags: { highway: 'bus_stop' }, lat: 0.6, lon: 0.6 },
      ],
    });

    expect(snapshot.features?.map(feature => feature.kind)).toEqual([
      'street_furniture',
      'street_furniture',
      'utility',
      'barrier',
      'traffic',
      'transit',
    ]);
    expect(snapshot.features?.map(feature => feature.geometryKind)).toEqual([
      'point',
      'point',
      'point',
      'point',
      'point',
      'point',
    ]);
  });

  it('adds building semantic colors and structural hints', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { building: 'retail', shop: 'supermarket', bridge: 'yes', access: 'private' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.[0]).toMatchObject({
      kind: 'building',
      semanticUse: 'retail',
      renderColor: '#b46b55',
      level: 'bridge',
      access: 'private',
    });
  });

  it('computes elevated rail viaduct metadata from bridge and layer tags', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: {
            railway: 'rail',
            bridge: 'viaduct',
            layer: '1',
            'bridge:structure': 'viaduct',
          },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.[0]).toMatchObject({
      kind: 'rail',
      level: 'bridge',
      layerIndex: 1,
      structureKind: 'viaduct',
      elevationSource: 'heuristic',
    });
    expect(snapshot.features?.[0]?.deckElevationMeters).toBeGreaterThan(7);
  });

  it('places bridge roads above water in local deck elevation metadata', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { waterway: 'riverbank' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { highway: 'primary', bridge: 'yes', layer: '1' },
          geometry: [
            { lat: 0, lon: 0.5 },
            { lat: 1, lon: 0.5 },
          ],
        },
      ],
    });

    const water = snapshot.features?.find(feature => feature.kind === 'water');
    const bridge = snapshot.features?.find(feature => feature.kind === 'road');

    expect(water?.deckElevationMeters).toBeLessThan(0);
    expect(bridge).toMatchObject({
      level: 'bridge',
      structureKind: 'bridge',
      layerIndex: 1,
    });
    expect(bridge?.deckElevationMeters).toBeGreaterThan(water?.deckElevationMeters ?? 0);
  });

  it('computes lowered tunnel and cutting metadata', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { highway: 'service', tunnel: 'yes' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { railway: 'rail', cutting: 'yes' },
          geometry: [
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
          ],
        },
      ],
    });

    expect(snapshot.features?.find(feature => feature.id === '1')).toMatchObject({
      level: 'tunnel',
      structureKind: 'tunnel',
      deckElevationMeters: -2.4,
    });
    expect(snapshot.features?.find(feature => feature.id === '2')).toMatchObject({
      structureKind: 'cutting',
      deckElevationMeters: -1.4,
    });
  });

  it('keeps step count and incline metadata for stair rendering', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { highway: 'steps', step_count: '23', incline: 'up' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.[0]).toMatchObject({
      kind: 'sidewalk',
      subkind: 'steps',
      structureKind: 'steps',
      stepCount: 23,
      incline: 'up',
    });
    expect(snapshot.features?.[0]?.deckElevationMeters).toBeCloseTo(3.68);
  });

  it('computes elevated embankment metadata', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { railway: 'tram', embankment: 'yes' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.[0]).toMatchObject({
      kind: 'rail',
      structureKind: 'embankment',
    });
    expect(snapshot.features?.[0]?.deckElevationMeters).toBeGreaterThan(4);
  });

  it('classifies recommended area and line features', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { railway: 'tram' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 2,
          tags: { barrier: 'hedge' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 3,
          tags: { leisure: 'playground' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
        {
          type: 'way',
          id: 4,
          tags: { landuse: 'brownfield' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.map(feature => [feature.kind, feature.subkind])).toEqual([
      ['rail', 'tram'],
      ['barrier', 'hedge'],
      ['playground', 'playground'],
      ['construction', 'brownfield'],
    ]);
  });

  it('does not turn residential landuse polygons into green surface overlays', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { landuse: 'residential' },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features).toEqual([]);
  });

  it('creates conservative side bands for explicit sidewalk and cycleway tags', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: {
            highway: 'residential',
            sidewalk: 'both',
            'cycleway:right': 'lane',
          },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.find(feature => feature.id === '1:sidewalk:left')).toMatchObject({
      kind: 'sidewalk',
      side: 'left',
    });
    expect(snapshot.features?.find(feature => feature.id === '1:sidewalk:right')).toMatchObject({
      kind: 'sidewalk',
      side: 'right',
    });
    expect(snapshot.features?.find(feature => feature.id === '1:bike_lane:right')).toMatchObject({
      kind: 'bike_lane',
      side: 'right',
    });
  });

  it('creates loading-zone side bands from parking restrictions', () => {
    const snapshot = normalizeOverpassPayload(bbox, {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: {
            highway: 'residential',
            'parking:left:restriction:conditional': 'loading_only @ (07:30-09:00)',
          },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
          ],
        },
      ],
    });

    expect(snapshot.features?.find(feature => feature.id === '1:loading_zone:left')).toMatchObject({
      kind: 'parking',
      subkind: 'loading_zone',
      side: 'left',
    });
  });
});

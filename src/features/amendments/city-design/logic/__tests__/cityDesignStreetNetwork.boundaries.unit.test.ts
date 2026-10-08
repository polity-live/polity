import { describe, expect, it } from 'vitest';
import {
  buildStreetNetwork,
  designStreetSources,
  getDesignStreetNetwork,
  getOsmStreetNetwork,
  offsetStreetCenterline,
  osmStreetSources,
  streetLaneProperties,
  type StreetNetworkSource,
} from '../cityDesignStreetNetwork';
import {
  createCorridorCityDesignObject,
  createPointCityDesignObject,
  createPolygonGeometry,
  createSampledCorridorGeometry,
} from '../cityDesignPlacement';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import { unprojectLocalPointToGeo } from '../cityDesignProjection';
import { getCityDesignOsmWidthSource } from '../cityDesignOsmMapping';
import { convertCityDesignOsmFeature } from '../cityDesignOsmConversion';

const line = (
  id: string,
  x1: number,
  x2: number,
  extra: Partial<StreetNetworkSource> = {}
): StreetNetworkSource => ({
  id,
  kind: 'road',
  level: 'surface',
  width: 6,
  points: [
    { x: x1, z: 0 },
    { x: x2, z: 0 },
  ],
  ...extra,
});

describe('street network source boundaries', () => {
  it('does not connect crossing or collinear OSM ways with unrelated nodes', () => {
    const network = buildStreetNetwork([
      line('main', -20, 20, { nodeIds: ['a', 'b'] }),
      line('cross', 0, 0, {
        points: [
          { x: 0, z: -20 },
          { x: 0, z: 20 },
        ],
        nodeIds: ['c', 'd'],
      }),
      line('continuation', 20, 40, { nodeIds: ['e', 'f'] }),
    ]);
    for (const feature of network.features.values()) {
      expect(feature.junctions).toEqual([]);
      expect(feature.markingCenterline).toEqual(feature.geometry.roundedCenterline);
    }
  });

  it.each([
    [{ lanes: 4, lanesBackward: 1 }, { lanes: 4, lanesBackward: 1 }, true],
    [{ lanesBackward: 1 }, { lanesBackward: 0 }, false],
    [{ lanes: 4, lanesForward: 1 }, { lanes: 4, lanesForward: 2 }, false],
    [{ lanes: 4, lanesForward: 1 }, { lanes: 4, lanesForward: 3 }, false],
  ] as const)(
    'continues split ways only for matching directional lane counts %j / %j',
    (a, b, connected) => {
      const network = buildStreetNetwork([line('a', -20, 0, a), line('b', 0, 20, b)]);
      expect(network.features.get('a')!.markingCenterline!.length > 2).toBe(connected);
      const reversed = buildStreetNetwork([line('a', -20, 0, a), line('b', 20, 0, b)]);
      expect(reversed.features.get('a')!.markingCenterline).toBeDefined();
    }
  );

  it('clips a crossing sidewalk at the road mouth and handles an orphan derived surface', () => {
    const network = buildStreetNetwork([
      line('road', -20, 20),
      line('walk', 0, 0, {
        kind: 'sidewalk',
        width: 2,
        points: [
          { x: 0, z: -10 },
          { x: 0, z: 10 },
        ],
      }),
      line('orphan', -20, 20, { kind: 'bike_lane', parentId: 'absent', offset: 7 }),
    ]);
    expect(network.features.get('walk')!.junctions.length).toBeGreaterThan(0);
    expect(network.features.get('orphan')!.geometry.width).toBe(6);
    expect(
      buildStreetNetwork([line('sampled', -10, 10, { sampled: true })]).features.get('sampled')!
        .geometry.cornerRadius
    ).toBe(0);
    const erased = buildStreetNetwork(
      [line('erased', -10, 10)],
      [
        {
          level: 'surface',
          points: [
            { x: -30, z: -30 },
            { x: 30, z: -30 },
            { x: 30, z: 30 },
            { x: -30, z: 30 },
          ],
        },
      ]
    );
    expect(erased.features.get('erased')!.edges).toEqual([]);
  });

  it('keeps duplicate and reversing samples finite when offsetting imported centerlines', () => {
    for (const points of [
      [
        { x: 0, z: 0 },
        { x: 0, z: 0 },
      ],
      [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 0 },
      ],
    ])
      expect(
        offsetStreetCenterline(points, 2).every(p => Number.isFinite(p.x) && Number.isFinite(p.z))
      ).toBe(true);
  });

  it('maps polygon surfaces, sampled edits and traffic islands without losing lane metadata', () => {
    const design = createEmptyCityDesignState();
    const road = createCorridorCityDesignObject({
      id: 'road',
      type: 'street',
      start: { x: -20, z: 0 },
      end: { x: 20, z: 0 },
      width: 8,
    });
    const geometry = createPolygonGeometry([
      { x: -2, z: -1 },
      { x: 2, z: -1 },
      { x: 2, z: 1 },
      { x: -2, z: 1 },
    ]);
    const polygon = { ...road, geometry };
    expect(designStreetSources([polygon])[0].width).toBe(0);
    expect(designStreetSources([{ ...polygon, properties: { width: 4 } }])[0].width).toBe(4);
    const sampled = {
      ...road,
      geometry: createSampledCorridorGeometry(
        [
          { x: -10, z: 0 },
          { x: 10, z: 0 },
        ],
        8
      ),
    };
    expect(designStreetSources([sampled])[0].sampled).toBe(true);
    const island = { ...polygon, id: 'island', type: 'traffic_island' as const };
    expect(
      getDesignStreetNetwork([
        road,
        island,
        {
          ...createPointCityDesignObject({
            id: 'point-island',
            type: 'tree',
            point: { x: 0, z: 0 },
          }),
          type: 'traffic_island',
        },
      ]).features.get('road')!.footprint[0].length
    ).toBe(2);
    const feature = {
      id: 'osm-road',
      kind: 'road' as const,
      geometryKind: 'line' as const,
      widthSource: 'osm' as const,
      points: [
        { x: -20, z: 0 },
        { x: 20, z: 0 },
      ].map(p => unprojectLocalPointToGeo(p, design.origin)),
      tags: { lanes: '4', 'lanes:forward': '1', 'lanes:backward': '2', 'lanes:both_ways': '1' },
    };
    expect(osmStreetSources([feature], design)[0]).toMatchObject({
      estimated: false,
      lanesForward: 1,
      lanesBackward: 2,
      lanesBothWays: 1,
    });
    expect(osmStreetSources([{ ...feature, widthSource: 'lanes' }], design)[0].estimated).toBe(
      true
    );
    const osmIsland = {
      id: 'osm-island',
      kind: 'road' as const,
      subkind: 'traffic_island',
      geometryKind: 'polygon' as const,
      points: geometry.points.map(p => unprojectLocalPointToGeo(p, design.origin)),
    };
    expect(
      getOsmStreetNetwork(design, [feature, osmIsland]).features.get(feature.id)!.footprint[0]
        .length
    ).toBe(2);
    expect(
      getOsmStreetNetwork(design, [
        { ...osmIsland, points: undefined },
        { ...osmIsland, points: [] },
        { ...osmIsland, geometryKind: 'point' },
      ]).features.size
    ).toBe(0);
    expect(
      streetLaneProperties({ lanesForward: 1, lanesBackward: 2, lanesBothWays: 1 })
    ).toMatchObject({ lanesForward: 1, lanesBackward: 2, lanesBothWays: 1 });
    expect(getCityDesignOsmWidthSource({ lanes: '3' }, 'road')).toBe('lanes');
    const imported = convertCityDesignOsmFeature({
      feature: { ...feature, mappedObjectType: 'street' },
      origin: design.origin,
      createId: () => 'import',
      corridorGeometry: sampled.geometry,
    });
    expect(imported[0].geometry).toBe(sampled.geometry);
  });
});

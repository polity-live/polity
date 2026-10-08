import { describe, expect, it } from 'vitest';
import {
  createStreetMarkings,
  getStreetMarkings,
  type StreetMarking,
} from '../cityDesignStreetMarkings';
import { createSampledCorridorGeometry } from '../cityDesignPlacement';
import {
  buildStreetNetwork,
  streetPolygon,
  streetPolygonArea,
  streetPolygonOperations,
  streetLaneProperties,
  type StreetNetworkSource,
} from '../cityDesignStreetNetwork';
import { getCityDesignOsmSemanticMapping } from '../cityDesignOsmMapping';

const road = (
  id: string,
  points = [
    { x: -30, z: 0 },
    { x: 30, z: 0 },
  ],
  lanes = 4,
  width = lanes * 3
): StreetNetworkSource => ({ id, points, lanes, width, level: 'surface', kind: 'road' });
const crossing = () =>
  road(
    'cross',
    [
      { x: 0, z: -30 },
      { x: 0, z: 30 },
    ],
    2
  );
const shape = (marking: StreetMarking) =>
  marking.polygons ?? [
    streetPolygon(createSampledCorridorGeometry(marking.points, marking.width).polygon),
  ];

describe('lane-aware intersection markings', () => {
  it('rejects missing axes and handles directional lanes without a supplied footprint', () => {
    const geometry = createSampledCorridorGeometry(
      [
        { x: -20, z: 0 },
        { x: 20, z: 0 },
      ],
      6
    );
    expect(createStreetMarkings({ geometry, source: {}, markingCenterline: [] })).toEqual([]);
    const junctions = [
      streetPolygon([
        { x: -4, z: -10 },
        { x: 4, z: -10 },
        { x: 4, z: 10 },
        { x: -4, z: 10 },
        { x: -4, z: -10 },
      ]),
    ];
    const markings = createStreetMarkings({
      geometry,
      source: { lanes: 4, lanesBackward: 1 },
      junctions,
    });
    expect(markings.some(marking => marking.kind === 'guide')).toBe(true);
    expect(markings.every(marking => marking.polygons?.length)).toBe(true);
    const folded = {
      ...geometry,
      roundedCenterline: [
        { x: 0, z: 0 },
        { x: 0.001, z: 0 },
      ],
    };
    expect(createStreetMarkings({ geometry: folded, source: { lanes: 3 } })).toEqual([]);
    const collapsingOffset = createSampledCorridorGeometry(
      [
        { x: -1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 0 },
      ],
      Math.sqrt(2) * 6
    );
    const remaining = createStreetMarkings({ geometry: collapsingOffset, source: { lanes: 3 } });
    expect(remaining.length).toBeGreaterThan(0);
    expect(remaining.every(marking => marking.offset > 0)).toBe(true);
  });
  it.each([
    [1, []],
    [2, [0]],
    [4, [-3, 0, 3]],
  ] as const)('uses %i lanes rather than a universal centre line', (lanes, offsets) => {
    const feature = buildStreetNetwork([road('main', undefined, lanes)]).features.get('main')!;
    expect([...new Set(getStreetMarkings(feature).map(marking => marking.offset))]).toEqual([
      ...offsets,
    ]);
  });

  it('clips opposing centre lines and guides only through lanes in a four-arm junction', () => {
    const network = buildStreetNetwork([road('main'), crossing()]);
    const feature = network.features.get('main')!;
    const markings = getStreetMarkings(feature);
    expect([
      ...new Set(
        markings.filter(marking => marking.kind === 'guide').map(marking => marking.offset)
      ),
    ]).toEqual([-3, 3]);
    for (const marking of markings.filter(marking => marking.kind === 'divider')) {
      expect(
        streetPolygonArea(streetPolygonOperations.intersection(shape(marking), feature.junctions))
      ).toBeCloseTo(0, 3);
    }
    expect(
      getStreetMarkings(network.features.get('cross')!).some(marking => marking.kind === 'guide')
    ).toBe(false);
  });

  it('clears the full mouth of a T junction and leaves the terminating approach without guides', () => {
    const network = buildStreetNetwork([
      road('main'),
      road('branch', [
        { x: 0, z: 0 },
        { x: 0, z: 30 },
      ]),
    ]);
    const main = network.features.get('main')!,
      branch = network.features.get('branch')!;
    expect(streetPolygonArea(main.junctions)).toBeGreaterThan(12 * 12);
    expect(getStreetMarkings(main).some(marking => marking.kind === 'guide')).toBe(true);
    expect(getStreetMarkings(branch).some(marking => marking.kind === 'guide')).toBe(false);
    const centre = getStreetMarkings(main).filter(marking => marking.offset === 0);
    for (const marking of centre)
      expect(
        streetPolygonArea(
          streetPolygonOperations.intersection(
            shape(marking),
            streetPolygon([
              { x: -5, z: -1 },
              { x: 5, z: -1 },
              { x: 5, z: 1 },
              { x: -5, z: 1 },
            ])
          )
        )
      ).toBe(0);
  });

  it('continues compatible split OSM ways through their shared junction node', () => {
    const network = buildStreetNetwork([
      {
        ...road('left', [
          { x: -30, z: 0 },
          { x: 0, z: 0 },
        ]),
        nodeIds: ['left', 'junction'],
      },
      {
        ...road('right', [
          { x: 0, z: 0 },
          { x: 30, z: 0 },
        ]),
        nodeIds: ['junction', 'right'],
      },
      {
        ...crossing(),
        points: [
          { x: 0, z: -30 },
          { x: 0, z: 0 },
          { x: 0, z: 30 },
        ],
        nodeIds: ['south', 'junction', 'north'],
      },
    ]);
    for (const id of ['left', 'right']) {
      const feature = network.features.get(id)!;
      const guides = getStreetMarkings(feature).filter(marking => marking.kind === 'guide');
      expect(guides.length).toBeGreaterThan(0);
      for (const marking of guides)
        expect(
          streetPolygonArea(streetPolygonOperations.difference(shape(marking), feature.footprint))
        ).toBe(0);
    }
  });

  it('does not invent a continuation when lane counts change or multiple approaches compete', () => {
    const network = buildStreetNetwork([
      road('left', [
        { x: -30, z: 0 },
        { x: 0, z: 0 },
      ]),
      road(
        'right',
        [
          { x: 0, z: 0 },
          { x: 30, z: 0 },
        ],
        2
      ),
      crossing(),
    ]);
    expect(
      getStreetMarkings(network.features.get('left')!).some(marking => marking.kind === 'guide')
    ).toBe(false);
    const ambiguous = buildStreetNetwork([
      road('left', [
        { x: -30, z: 0 },
        { x: 0, z: 0 },
      ]),
      road('a', [
        { x: 0, z: 0 },
        { x: 30, z: 0 },
      ]),
      road('b', [
        { x: 0, z: 0 },
        { x: 30, z: 1 },
      ]),
      crossing(),
    ]);
    expect(
      getStreetMarkings(ambiguous.features.get('left')!).some(marking => marking.kind === 'guide')
    ).toBe(false);
  });

  it('keeps split-way markings inside their owning surface even without a junction', () => {
    const network = buildStreetNetwork([
      road('left', [
        { x: -30, z: 0 },
        { x: 0, z: 0 },
      ]),
      road('right', [
        { x: 0, z: 0 },
        { x: 30, z: 0 },
      ]),
    ]);
    for (const feature of network.features.values())
      for (const marking of getStreetMarkings(feature))
        expect(
          streetPolygonArea(streetPolygonOperations.difference(shape(marking), feature.footprint))
        ).toBe(0);
  });

  it('matches directional lane counts across reversed way geometry without joining opposing one-way flows', () => {
    const left = {
      ...road(
        'left',
        [
          { x: -30, z: 0 },
          { x: 0, z: 0 },
        ],
        3
      ),
      lanesForward: 2,
      lanesBackward: 1,
    };
    const right = {
      ...road(
        'right',
        [
          { x: 30, z: 0 },
          { x: 0, z: 0 },
        ],
        3
      ),
      lanesForward: 1,
      lanesBackward: 2,
    };
    const network = buildStreetNetwork([left, right, crossing()]);
    for (const id of ['left', 'right'])
      expect(
        getStreetMarkings(network.features.get(id)!).some(marking => marking.kind === 'guide')
      ).toBe(true);
    const oneWay = {
      ...left,
      lanesForward: undefined,
      lanesBackward: undefined,
      direction: 'one_way',
    };
    const opposing = {
      ...right,
      lanesForward: undefined,
      lanesBackward: undefined,
      direction: 'one_way',
    };
    expect(
      getStreetMarkings(
        buildStreetNetwork([oneWay, opposing, crossing()]).features.get('left')!
      ).some(marking => marking.kind === 'guide')
    ).toBe(false);
    expect(
      getStreetMarkings(
        buildStreetNetwork([
          oneWay,
          { ...opposing, onewayReversed: true },
          crossing(),
        ]).features.get('left')!
      ).some(marking => marking.kind === 'guide')
    ).toBe(true);
  });

  it('uses explicit directional lanes and suppresses uncertain shared or turning-lane guides', () => {
    const make = (properties: Partial<StreetNetworkSource>) => {
      const feature = buildStreetNetwork([
        { ...road('main', undefined, 3), ...properties },
        crossing(),
      ]).features.get('main')!;
      return getStreetMarkings(feature).filter(marking => marking.kind === 'guide');
    };
    expect(
      make({ lanesForward: 2, lanesBackward: 1 }).every(marking => marking.offset === -1.5)
    ).toBe(true);
    expect(make({ lanesForward: 2, lanesBackward: 1 }).length).toBeGreaterThan(0);
    expect(make({})).toEqual([]);
    expect(make({ lanesForward: 2, lanesBackward: 2 })).toEqual([]);
    expect(make({ direction: 'one_way', lanesForward: 2, lanesBackward: 1 })).toEqual([]);
    expect(make({ lanesBothWays: 1 })).toEqual([]);
    expect(make({ turnLanes: 'left|through|right' })).toEqual([]);
    expect(make({ direction: 'one_way' }).some(marking => marking.offset === 1.5)).toBe(true);
  });

  it('keeps curved and oblique guides inside the road and out of traffic islands', () => {
    const island = [
      { x: -1, z: 2 },
      { x: 1, z: 2 },
      { x: 1, z: 4 },
      { x: -1, z: 4 },
    ];
    const network = buildStreetNetwork(
      [
        road('main', [
          { x: -30, z: -8 },
          { x: 0, z: 0 },
          { x: 25, z: 12 },
        ]),
        crossing(),
      ],
      [{ level: 'surface', points: island }]
    );
    const feature = network.features.get('main')!;
    expect(getStreetMarkings(feature).some(marking => marking.kind === 'guide')).toBe(true);
    for (const marking of getStreetMarkings(feature)) {
      expect(
        streetPolygonArea(streetPolygonOperations.difference(shape(marking), feature.footprint))
      ).toBeCloseTo(0, 3);
      expect(
        streetPolygonArea(
          streetPolygonOperations.intersection(shape(marking), streetPolygon(island))
        )
      ).toBe(0);
    }
  });

  it('handles staggered junctions independently and reuses marking geometry', () => {
    const network = buildStreetNetwork([
      road('main'),
      road(
        'south',
        [
          { x: -12, z: -30 },
          { x: -12, z: 0 },
        ],
        2
      ),
      road(
        'north',
        [
          { x: 12, z: 0 },
          { x: 12, z: 30 },
        ],
        2
      ),
    ]);
    const feature = network.features.get('main')!;
    const markings = getStreetMarkings(feature);
    const guides = markings.filter(marking => marking.kind === 'guide');
    expect(guides.some(marking => marking.points[0].x < -8)).toBe(true);
    expect(guides.some(marking => marking.points[0].x > 8)).toBe(true);
    expect(getStreetMarkings(feature)).toBe(markings);
  });

  it('respects unmarked roads and different bridge levels', () => {
    const network = buildStreetNetwork([
      { ...road('main'), laneMarkings: false },
      { ...crossing(), level: 'bridge' },
    ]);
    expect(getStreetMarkings(network.features.get('main')!)).toEqual([]);
    expect(network.features.get('cross')!.junctions).toEqual([]);
    expect(
      createStreetMarkings({
        geometry: network.features.get('main')!.geometry,
        source: { lanes: Infinity },
      })
    ).toEqual([]);
  });

  it('imports directional lane counts and reverse and roundabout one-way tags', () => {
    const feature = {
      id: 'way',
      kind: 'road' as const,
      geometryKind: 'line' as const,
      tags: {
        lanes: '3',
        'lanes:forward': '2',
        'lanes:backward': '1',
        oneway: '-1',
        lane_markings: 'no',
      },
    };
    expect(getCityDesignOsmSemanticMapping(feature).properties).toMatchObject({
      lanes: 3,
      lanesForward: 2,
      lanesBackward: 1,
      direction: 'one_way',
      laneMarkings: false,
    });
    expect(
      getCityDesignOsmSemanticMapping({ ...feature, tags: { junction: 'roundabout' } }).properties
        .direction
    ).toBe('one_way');
    const directionalTurns = getCityDesignOsmSemanticMapping({
      ...feature,
      tags: { lanes: '4', 'turn:lanes:forward': 'left|through' },
    }).properties;
    expect(streetLaneProperties(directionalTurns).turnLanes).toBe('left|through');
  });
});

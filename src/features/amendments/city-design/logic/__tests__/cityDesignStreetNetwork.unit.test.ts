import { describe, expect, it } from 'vitest';
import {
  buildStreetNetwork,
  measureStreetCrossSection,
  streetPolygonArea,
  offsetStreetCenterline,
  type StreetNetworkSource,
} from '../cityDesignStreetNetwork';
import {
  createPathCorridorCityDesignObject,
  updateCorridorLength,
  updateCorridorWidth,
} from '../cityDesignPlacement';

const road = (
  id: string,
  points = [
    { x: -20, z: 0 },
    { x: 20, z: 0 },
  ],
  width = 6,
  level = 'surface'
): StreetNetworkSource => ({ id, points, width, level, kind: 'road' });
const measure = (sources: StreetNetworkSource[], start = { x: 0, z: -10 }, end = { x: 0, z: 10 }) =>
  measureStreetCrossSection(buildStreetNetwork(sources), {
    start,
    end,
    layer: 'design',
    level: 'surface',
  });

describe('street networks', () => {
  it.each([
    [
      'T junction',
      [
        { x: 0, z: 0 },
        { x: 0, z: 20 },
      ],
      342,
      43.2,
    ],
    [
      'four arm junction',
      [
        { x: 0, z: -20 },
        { x: 0, z: 20 },
      ],
      444,
      43.2,
    ],
  ] as const)(
    'partitions a %s into surfaces with no duplicate area',
    (_, points, area, intersection) => {
      const network = buildStreetNetwork([road('a'), road('b', [...points])]);
      expect(
        [...network.features.values()].reduce(
          (sum, feature) => sum + streetPolygonArea(feature.surface),
          0
        )
      ).toBeCloseTo(area, 2);
      expect(streetPolygonArea(network.features.get('a')!.junctions)).toBeCloseTo(intersection, 2);
      expect(network.features.get('a')!.geometry.roundedCenterline).toContainEqual({ x: 0, z: 0 });
    }
  );

  it('keeps bridges and unrelated height levels separate', () => {
    const network = buildStreetNetwork([
      road('surface'),
      road(
        'bridge',
        [
          { x: 0, z: -20 },
          { x: 0, z: 20 },
        ],
        6,
        'bridge'
      ),
    ]);
    for (const feature of network.features.values()) expect(feature.junctions).toEqual([]);
    expect(
      measureStreetCrossSection(network, {
        start: { x: 0, z: -10 },
        end: { x: 0, z: 10 },
        layer: 'original',
        level: 'surface',
      }).covered
    ).toBeCloseTo(6);
  });

  it('pins a shared OSM node while rounding the other vertices', () => {
    const source = road('main', [
      { x: -20, z: 0 },
      { x: 0, z: 0 },
      { x: 10, z: 10 },
      { x: 20, z: 10 },
    ]);
    source.nodeIds = ['1', '2', '3', '4'];
    const branch = road('branch', [
      { x: 0, z: 0 },
      { x: 0, z: -20 },
    ]);
    branch.nodeIds = ['2', '5'];
    const geometry = buildStreetNetwork([source, branch]).features.get('main')!.geometry;
    expect(geometry.roundedCenterline).toContainEqual({ x: 0, z: 0 });
    expect(geometry.roundedCenterline.length).toBeGreaterThan(source.points.length);
  });

  it('creates derived bands from exactly the same smoothed axis', () => {
    const source = road('curve', [
      { x: -20, z: 0 },
      { x: 0, z: 0 },
      { x: 10, z: 10 },
      { x: 20, z: 10 },
    ]);
    const network = buildStreetNetwork([
      source,
      { ...source, id: 'bike', kind: 'bike_lane', width: 2, parentId: 'curve', offset: 5 },
    ]);
    const curve = network.features.get('curve')!.geometry.roundedCenterline;
    expect(network.features.get('bike')!.geometry.roundedCenterline).toEqual(
      offsetStreetCenterline(curve, 5).map(point => ({
        x: Math.round(point.x * 1000) / 1000,
        z: Math.round(point.z * 1000) / 1000,
      }))
    );
  });

  it('preserves the central void of a roundabout', () => {
    const points = Array.from({ length: 33 }, (_, index) => ({
      x: Math.cos((index / 32) * Math.PI * 2) * 20,
      z: Math.sin((index / 32) * Math.PI * 2) * 20,
    }));
    const result = measure([road('roundabout', points, 4)], { x: 0, z: -30 }, { x: 0, z: 30 });
    expect(result.covered).toBeGreaterThan(7);
    expect(result.covered).toBeLessThan(9);
    expect(result.gaps).toBeGreaterThan(34);
  });

  it('subtracts traffic islands and measures their gap', () => {
    const network = buildStreetNetwork(
      [road('road')],
      [
        {
          level: 'surface',
          points: [
            { x: -1, z: -1 },
            { x: 1, z: -1 },
            { x: 1, z: 1 },
            { x: -1, z: 1 },
          ],
        },
      ]
    );
    expect(streetPolygonArea(network.features.get('road')!.surface)).toBeCloseTo(236);
    const result = measureStreetCrossSection(network, {
      start: { x: 0, z: -10 },
      end: { x: 0, z: 10 },
      layer: 'design',
      level: 'surface',
    });
    expect(result.span).toBeCloseTo(6);
    expect(result.covered).toBeCloseTo(4);
    expect(result.gaps).toBeCloseTo(2);
  });

  it('reuses prepared geometry for unchanged sources', () => {
    expect(buildStreetNetwork([road('cache')])).toBe(buildStreetNetwork([road('cache')]));
    expect(buildStreetNetwork([road('cache', undefined, 7)])).not.toBe(
      buildStreetNetwork([road('cache')])
    );
  });
});

describe('cross-section measurement', () => {
  const band = (id: string, z: number, width: number, kind: StreetNetworkSource['kind']) => ({
    ...road(
      id,
      [
        { x: -20, z },
        { x: 20, z },
      ],
      width
    ),
    kind,
  });
  it('measures a road, parking strip and cycleway in physical order', () => {
    const result = measure([
      road('road'),
      band('parking', 4.5, 3, 'parking'),
      band('bike', 7, 2, 'bike_lane'),
    ]);
    expect(result.span).toBeCloseTo(11);
    expect(result.covered).toBeCloseTo(11);
    expect(result.gaps).toBeCloseTo(0);
    expect(result.overlaps).toBeCloseTo(0);
    expect(result.sections.map(section => section.ids)).toEqual([['road'], ['parking'], ['bike']]);
  });
  it('shows gaps without adding them to covered width', () => {
    const result = measure([
      road('road'),
      band('parking', 5, 3, 'parking'),
      band('bike', 8, 2, 'bike_lane'),
    ]);
    expect(result.span).toBeCloseTo(12);
    expect(result.covered).toBeCloseTo(11);
    expect(result.gaps).toBeCloseTo(1);
  });
  it('counts overlapping surfaces once while reporting the overlap', () => {
    const result = measure([road('road'), band('parking', 3, 3, 'parking')]);
    expect(result.span).toBeCloseTo(7.5);
    expect(result.covered).toBeCloseTo(7.5);
    expect(result.overlaps).toBeCloseTo(1.5);
  });
  it('measures actual diagonal distances instead of adding nominal widths', () => {
    expect(measure([road('road')], { x: -5, z: -5 }, { x: 5, z: 5 }).span).toBeCloseTo(
      6 * Math.SQRT2
    );
  });
  it('handles lines inside a surface, empty hits and zero-length lines', () => {
    expect(measure([road('road')], { x: 0, z: -1 }, { x: 0, z: 1 }).covered).toBeCloseTo(2);
    expect(measure([road('road')], { x: 50, z: -1 }, { x: 50, z: 1 }).span).toBe(0);
    expect(measure([road('road')], { x: 0, z: 0 }, { x: 0, z: 0 }).covered).toBe(0);
  });
  it('reports estimates and measures polygon parking areas', () => {
    const result = measure([
      {
        ...road('parking'),
        kind: 'parking',
        estimated: true,
        polygon: [
          { x: -3, z: -4 },
          { x: 3, z: -4 },
          { x: 3, z: 4 },
          { x: -3, z: 4 },
        ],
      },
    ]);
    expect(result.covered).toBeCloseTo(8);
    expect(result.intervals[0].estimated).toBe(true);
  });
});

describe('committed length edits', () => {
  const object = () =>
    createPathCorridorCityDesignObject({
      id: 'curve',
      type: 'bike_lane',
      width: 2,
      points: [
        { x: 0, z: 0 },
        { x: 20, z: 0 },
        { x: 20, z: 20 },
      ],
    });
  it('trims the curve and extends its last tangent with a fixed start and width', () => {
    const original = object();
    const short = updateCorridorLength(original, 10);
    expect(short.geometry).toMatchObject({ length: 10, width: 2 });
    const extended = updateCorridorLength(original, 60);
    expect(extended.geometry).toMatchObject({ length: 60, width: 2 });
    if (extended.geometry.kind !== 'path_corridor') throw new Error('Expected path');
    expect(extended.geometry.roundedCenterline[0]).toEqual({ x: 0, z: 0 });
    expect(extended.geometry.roundedCenterline.at(-1)?.x).toBe(20);
    const resized = updateCorridorWidth(extended, 3);
    expect(resized.geometry).toMatchObject({ length: 60, width: 3 });
    if (resized.geometry.kind !== 'path_corridor') throw new Error('Expected path');
    expect(resized.geometry.area).toBeCloseTo(180, 2);
  });
  it('rejects invalid dimensions without changing the object', () => {
    const original = object();
    for (const value of [NaN, Infinity, -1, 0]) {
      expect(updateCorridorLength(original, value)).toBe(original);
      expect(updateCorridorWidth(original, value)).toBe(original);
    }
  });
});

it('connects old coordinate-only snapshots at an oblique, unequal-width junction', () => {
  const network = buildStreetNetwork([
    road(
      'main',
      [
        { x: -20, z: 0 },
        { x: 0, z: 0 },
        { x: 20, z: 3 },
      ],
      8
    ),
    road(
      'branch',
      [
        { x: 0, z: 0 },
        { x: 15, z: -15 },
      ],
      3
    ),
  ]);
  for (const feature of network.features.values()) {
    expect(feature.geometry.roundedCenterline).toContainEqual({ x: 0, z: 0 });
    expect(streetPolygonArea(feature.junctions)).toBeGreaterThan(0);
    expect(
      feature.geometry.roundedCenterline.every(
        point => Number.isFinite(point.x) && Number.isFinite(point.z)
      )
    ).toBe(true);
  }
});
it('rounds dense short bends without changing the endpoints or narrowing the declared width', () => {
  const points = [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    { x: 3, z: 1 },
    { x: 4, z: 1 },
    { x: 5, z: 3 },
    { x: 8, z: 5 },
  ];
  const geometry = buildStreetNetwork([road('short-bends', points, 3)]).features.get(
    'short-bends'
  )!.geometry;
  expect(geometry.roundedCenterline.length).toBeGreaterThan(points.length);
  expect(geometry.roundedCenterline[0]).toEqual(points[0]);
  expect(geometry.roundedCenterline.at(-1)).toEqual(points.at(-1));
  expect(geometry.width).toBe(3);
});

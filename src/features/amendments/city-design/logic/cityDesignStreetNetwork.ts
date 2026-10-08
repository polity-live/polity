import polygonClippingRaw, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type {
  CityDesignLocalPoint,
  CityDesignObject,
  CityDesignOsmFeature,
  CityDesignStateV1,
  PathCorridorGeometry,
  CityDesignComparisonLayer,
} from '../types';
import { createPathCorridorGeometry, createSampledCorridorGeometry } from './cityDesignPlacement';
import { projectGeoPointToLocal } from './cityDesignProjection';
import { getCityDesignOsmSemanticMapping } from './cityDesignOsmMapping';
import {
  getCityDesignHiddenOsmFeatureIds,
  getCityDesignOsmFeatures,
  getCityDesignOsmFeatureLayer,
  getCityDesignOsmLayerVisibility,
} from './cityDesignOsm';

export type StreetSurfaceKind = 'road' | 'bike_lane' | 'sidewalk' | 'parking';
export interface StreetNetworkSource {
  id: string;
  kind: StreetSurfaceKind;
  points: CityDesignLocalPoint[];
  width: number;
  level: string;
  nodeIds?: string[];
  parentId?: string;
  offset?: number;
  sampled?: boolean;
  estimated?: boolean;
  polygon?: CityDesignLocalPoint[];
  lanes?: number;
  direction?: string;
  onewayReversed?: boolean;
  lanesForward?: number;
  lanesBackward?: number;
  lanesBothWays?: number;
  laneMarkings?: boolean;
  turnLanes?: string;
}
export interface StreetNetworkFeature {
  source: StreetNetworkSource;
  geometry: PathCorridorGeometry;
  footprint: MultiPolygon;
  /** Disjoint ownership of the shared surface, preserving object identities. */
  surface: MultiPolygon;
  junctions: MultiPolygon;
  edges: MultiPolygon;
  /** Collinear OSM ways may be split at a junction; use both approaches for guides. */
  markingCenterline?: CityDesignLocalPoint[];
}
export interface StreetNetwork {
  features: Map<string, StreetNetworkFeature>;
}
// Quantize every operation to the model's millimetre grid. Reusing raw intersection
// coordinates can otherwise produce nearly coincident segments and invalid rings.
type PolygonCoordinates = number | PolygonCoordinates[];
function mapPolygonCoordinates(
  value: PolygonCoordinates,
  map: (value: number) => number
): PolygonCoordinates {
  return Array.isArray(value) ? value.map(item => mapPolygonCoordinates(item, map)) : map(value);
}
export const streetPolygonOperations = Object.fromEntries(
  (['union', 'intersection', 'difference'] as const).map(operation => [
    operation,
    (first: Polygon | MultiPolygon, ...rest: (Polygon | MultiPolygon)[]): MultiPolygon => {
      const inputs = [first, ...rest].map(input =>
        mapPolygonCoordinates(input, value => Math.round(value * 1000))
      ) as MultiPolygon[];
      const result = polygonClippingRaw[operation](inputs[0], ...inputs.slice(1));
      return mapPolygonCoordinates(result, value => Math.round(value) / 1000) as MultiPolygon;
    },
  ])
) as Pick<typeof polygonClippingRaw, 'union' | 'intersection' | 'difference'>;
const polygonClipping = streetPolygonOperations;
const EPSILON = 0.001;
const cache = new Map<string, StreetNetwork>();

export function streetPolygon(points: CityDesignLocalPoint[]): Polygon {
  return [points.map(point => [point.x, point.z])];
}
export function streetPolygonArea(polygons: MultiPolygon) {
  return polygons.reduce(
    (total, polygon) =>
      total +
      polygon.reduce((sum, ring, index) => {
        const area =
          Math.abs(
            ring.reduce((value, point, i) => {
              const next = ring[(i + 1) % ring.length];
              return value + point[0] * next[1] - next[0] * point[1];
            }, 0)
          ) / 2;
        return sum + (index === 0 ? area : -area);
      }, 0),
    0
  );
}
function cross(a: CityDesignLocalPoint, b: CityDesignLocalPoint) {
  return a.x * b.z - a.z * b.x;
}
const subtract = (a: CityDesignLocalPoint, b: CityDesignLocalPoint) => ({
  x: a.x - b.x,
  z: a.z - b.z,
});
function segmentIntersection(
  a: CityDesignLocalPoint,
  b: CityDesignLocalPoint,
  c: CityDesignLocalPoint,
  d: CityDesignLocalPoint
) {
  if (
    Math.max(a.x, b.x) + EPSILON < Math.min(c.x, d.x) ||
    Math.max(c.x, d.x) + EPSILON < Math.min(a.x, b.x) ||
    Math.max(a.z, b.z) + EPSILON < Math.min(c.z, d.z) ||
    Math.max(c.z, d.z) + EPSILON < Math.min(a.z, b.z)
  )
    return null;
  const r = subtract(b, a),
    s = subtract(d, c);
  const divisor = cross(r, s);
  if (Math.abs(divisor) < EPSILON) return null;
  const t = cross(subtract(c, a), s) / divisor;
  const u = cross(subtract(c, a), r) / divisor;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;
  return {
    point: { x: a.x + t * r.x, z: a.z + t * r.z },
    t,
    u,
    sine: Math.abs(divisor) / (Math.hypot(r.x, r.z) * Math.hypot(s.x, s.z)),
  };
}
function near(a: CityDesignLocalPoint, b: CityDesignLocalPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z) < EPSILON * 2;
}

/** True normal offset with bounded miter joins, shared by import and rendering. */
export function offsetStreetCenterline(points: CityDesignLocalPoint[], offset = 0) {
  if (!offset || points.length < 2) return points;
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)],
      next = points[Math.min(points.length - 1, index + 1)];
    const before = subtract(point, previous),
      after = subtract(next, point);
    const beforeLength = Math.hypot(before.x, before.z),
      afterLength = Math.hypot(after.x, after.z);
    const incoming = beforeLength
      ? { x: before.x / beforeLength, z: before.z / beforeLength }
      : { x: after.x / (afterLength || 1), z: after.z / (afterLength || 1) };
    const outgoing = afterLength
      ? { x: after.x / afterLength, z: after.z / afterLength }
      : incoming;
    const nx = -incoming.z - outgoing.z,
      nz = incoming.x + outgoing.x;
    const norm = Math.hypot(nx, nz) || 1;
    const projection = (nx * -outgoing.z + nz * outgoing.x) / norm;
    const distance = offset / Math.max(0.5, projection);
    return { x: point.x + (nx / norm) * distance, z: point.z + (nz / norm) * distance };
  });
}

function smoothPinned(points: CityDesignLocalPoint[], width: number, pins: CityDesignLocalPoint[]) {
  const sampled: CityDesignLocalPoint[] = [];
  let start = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (index !== points.length - 1 && !pins.some(pin => near(pin, points[index]))) continue;
    const part = createPathCorridorGeometry(
      points.slice(start, index + 1),
      width
    ).roundedCenterline;
    sampled.push(...(sampled.length ? part.slice(1) : part));
    start = index;
  }
  return createSampledCorridorGeometry(sampled, width, points);
}

/** Geometry-only cache: camera, selection and measurement never invalidate it. */
export function buildStreetNetwork(
  sources: StreetNetworkSource[],
  holes: {
    level: string;
    points: CityDesignLocalPoint[];
  }[] = []
): StreetNetwork {
  const signature = JSON.stringify([sources, holes]);
  const cached = cache.get(signature);
  if (cached) return cached;
  const features = new Map<string, StreetNetworkFeature>();
  const primary = sources.filter(source => !source.parentId && !source.polygon);
  const pins = new Map(primary.map(source => [source.id, [] as CityDesignLocalPoint[]]));
  const inserts = new Map(
    primary.map(source => [
      source.id,
      new Map<number, { point: CityDesignLocalPoint; t: number }[]>(),
    ])
  );
  for (let left = 0; left < primary.length; left += 1) {
    const a = primary[left];
    for (let right = left + 1; right < primary.length; right += 1) {
      const b = primary[right];
      if (a.level !== b.level) continue;
      for (let i = 1; i < a.points.length; i += 1) {
        for (let j = 1; j < b.points.length; j += 1) {
          const hit = segmentIntersection(
            a.points[i - 1],
            a.points[i],
            b.points[j - 1],
            b.points[j]
          );
          if (!hit) continue;
          // OSM roads connect at shared nodes, never simply because lines cross on a map.
          if (
            a.nodeIds &&
            b.nodeIds &&
            !a.nodeIds.some(
              (id, index) =>
                b.nodeIds?.includes(id) && a.points[index] && near(a.points[index], hit.point)
            )
          )
            continue;
          for (const [source, index, t] of [
            [a, i, hit.t],
            [b, j, hit.u],
          ] as const) {
            pins.get(source.id)?.push(hit.point);
            const parts = inserts.get(source.id) as Map<
              number,
              { point: CityDesignLocalPoint; t: number }[]
            >;
            parts.set(index, [...(parts.get(index) ?? []), { point: hit.point, t }]);
          }
        }
      }
    }
  }
  for (const source of primary) {
    const points = source.points
      .flatMap((point, index) =>
        index === 0
          ? [point]
          : [
              ...(inserts.get(source.id)?.get(index) ?? [])
                .sort((a, b) => a.t - b.t)
                .map(hit => hit.point),
              point,
            ]
      )
      .filter((point, index, all) => !index || !near(point, all[index - 1]));
    if (points.length < 2) continue;
    const geometry = source.sampled
      ? createSampledCorridorGeometry(points, source.width)
      : smoothPinned(points, source.width, pins.get(source.id) as CityDesignLocalPoint[]);
    const footprint = polygonClipping.union(streetPolygon(source.polygon ?? geometry.polygon));
    features.set(source.id, {
      source,
      geometry,
      footprint,
      surface: footprint,
      junctions: [],
      edges: [],
    });
  }
  for (const source of sources.filter(item => item.polygon && item.polygon.length >= 3)) {
    const geometry = createSampledCorridorGeometry(
      source.points.slice(0, 2),
      Math.max(source.width, 0.1)
    );
    const footprint = polygonClipping.union(
      streetPolygon(source.polygon as CityDesignLocalPoint[])
    );
    features.set(source.id, {
      source,
      geometry,
      footprint,
      surface: footprint,
      junctions: [],
      edges: [],
    });
  }
  for (const source of sources.filter(item => item.parentId)) {
    const parent = features.get(source.parentId as string);
    const centerline =
      parent?.geometry.roundedCenterline ??
      createPathCorridorGeometry(source.points, source.width).roundedCenterline;
    const geometry = createSampledCorridorGeometry(
      offsetStreetCenterline(centerline, source.offset),
      source.width
    );
    const footprint = polygonClipping.union(streetPolygon(geometry.polygon));
    features.set(source.id, {
      source,
      geometry,
      footprint,
      surface: footprint,
      junctions: [],
      edges: [],
    });
  }
  const groups = new Map<string, StreetNetworkFeature[]>();
  for (const feature of features.values()) {
    const key = `${feature.source.level}:${feature.source.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), feature]);
  }
  for (const group of groups.values()) {
    const voids = holes
      .filter(hole => hole.level === group[0].source.level)
      .map(hole => streetPolygon(hole.points));
    const union = polygonClipping.union(
      group[0].footprint,
      ...group.slice(1).map(feature => feature.footprint)
    );
    const surface = voids.length ? polygonClipping.difference(union, ...voids) : union;
    // Derive kerbs from the union boundary so a shared edge never becomes a seam.
    const edgePolygons = surface.flatMap(polygon =>
      polygon.map(ring => {
        const points = ring.map(([x, z]) => ({ x, z }));
        return streetPolygon(createSampledCorridorGeometry(points, 0.1).polygon);
      })
    );
    const boundary = edgePolygons.length
      ? polygonClipping.intersection(
          polygonClipping.union(edgePolygons[0], ...edgePolygons.slice(1)),
          surface
        )
      : [];
    let occupied: MultiPolygon = [];
    for (const feature of group) {
      const clipped = polygonClipping.intersection(feature.footprint, surface);
      feature.footprint = clipped;
      feature.surface = occupied.length ? polygonClipping.difference(clipped, occupied) : clipped;
      occupied = polygonClipping.union(occupied, clipped);
      feature.edges = polygonClipping.intersection(boundary, feature.surface);
    }
  }
  // Continue split ways only when there is a single compatible, straight approach.
  const roads = [...features.values()].filter(feature => feature.source.kind === 'road');
  for (const feature of roads) {
    const points = feature.geometry.roundedCenterline;
    let extended = points;
    for (const atStart of [true, false]) {
      const endpoint = atStart ? points[0] : points[points.length - 1];
      const inward = subtract(atStart ? points[1] : points[points.length - 2], endpoint);
      const candidates = roads.flatMap(other => {
        if (
          other === feature ||
          other.source.level !== feature.source.level ||
          Math.abs(other.source.width - feature.source.width) > 0.25 ||
          (other.source.lanes ?? 2) !== (feature.source.lanes ?? 2) ||
          (other.source.direction ?? 'two_way') !== (feature.source.direction ?? 'two_way') ||
          other.source.laneMarkings === false ||
          other.source.turnLanes ||
          feature.source.turnLanes ||
          other.source.lanesBothWays ||
          feature.source.lanesBothWays
        )
          return [];
        const line = other.geometry.roundedCenterline;
        const outward = near(line[0], endpoint)
          ? line
          : near(line[line.length - 1], endpoint)
            ? [...line].reverse()
            : null;
        if (!outward) return [];
        const reversed = near(line[0], endpoint) ? atStart : !atStart;
        if (feature.source.direction === 'one_way') {
          if (
            Boolean(feature.source.onewayReversed) !==
            (Boolean(other.source.onewayReversed) !== reversed)
          )
            return [];
        } else {
          const forwardCount = (source: StreetNetworkSource) =>
            source.lanesForward ??
            (source.lanesBackward != null
              ? (source.lanes ?? 2) - source.lanesBackward
              : (source.lanes ?? 2) / 2);
          const otherForward = forwardCount(other.source);
          if (
            forwardCount(feature.source) !==
            (reversed ? (other.source.lanes ?? 2) - otherForward : otherForward)
          )
            return [];
        }
        if (
          feature.source.nodeIds &&
          other.source.nodeIds &&
          !feature.source.nodeIds.some(id => other.source.nodeIds?.includes(id))
        )
          return [];
        const direction = subtract(outward[1], endpoint);
        const alignment =
          -(inward.x * direction.x + inward.z * direction.z) /
          (Math.hypot(inward.x, inward.z) * Math.hypot(direction.x, direction.z));
        return alignment > 0.97 ? [outward] : [];
      });
      if (candidates.length === 1)
        extended = atStart
          ? [...candidates[0].slice(1).reverse(), ...extended]
          : [...extended, ...candidates[0].slice(1)];
    }
    feature.markingCenterline = extended;
  }
  // Include the full mouth of T junctions, rather than just their overlapping half.
  // A small setback keeps longitudinal dashes away from the corner of the junction.
  for (const feature of features.values()) {
    const masks: MultiPolygon[] = [];
    for (const road of roads) {
      if (
        road === feature ||
        road.source.level !== feature.source.level ||
        road.source.id === feature.source.parentId
      )
        continue;
      if (
        feature.source.nodeIds &&
        road.source.nodeIds &&
        !feature.source.parentId &&
        !feature.source.nodeIds.some(id => road.source.nodeIds?.includes(id))
      )
        continue;
      const a = feature.geometry.roundedCenterline,
        b = road.geometry.roundedCenterline;
      let crossing = false;
      for (let i = 1; i < a.length && !crossing; i += 1) {
        for (let j = 1; j < b.length; j += 1) {
          const hit = segmentIntersection(a[i - 1], a[i], b[j - 1], b[j]);
          if (
            hit &&
            hit.sine > 0.15 &&
            (!feature.source.nodeIds ||
              !road.source.nodeIds ||
              feature.source.parentId ||
              feature.source.nodeIds.some(
                (id, index) =>
                  road.source.nodeIds?.includes(id) &&
                  feature.source.points[index] &&
                  near(feature.source.points[index], hit.point)
              ))
          ) {
            crossing = true;
            break;
          }
        }
      }
      if (crossing) {
        const extension = feature.source.width + road.source.width;
        const points = b.map(point => ({ ...point }));
        for (const atStart of [true, false]) {
          const index = atStart ? 0 : points.length - 1;
          const direction = subtract(b[index], b[atStart ? 1 : b.length - 2]);
          const length = Math.hypot(direction.x, direction.z);
          points[index] = {
            x: b[index].x + (direction.x / length) * extension,
            z: b[index].z + (direction.z / length) * extension,
          };
        }
        masks.push(
          polygonClipping.intersection(
            feature.footprint,
            streetPolygon(createSampledCorridorGeometry(points, road.source.width + 1.2).polygon)
          )
        );
      }
    }
    feature.junctions = masks.length ? polygonClipping.union(masks[0], ...masks.slice(1)) : [];
    if (feature.junctions.length && feature.source.kind !== 'road')
      feature.edges = polygonClipping.difference(feature.edges, feature.junctions);
  }
  const network = { features };
  cache.set(signature, network);
  if (cache.size > 6) cache.delete(cache.keys().next().value as string);
  return network;
}

function objectKind(object: CityDesignObject): StreetSurfaceKind | null {
  if (object.type === 'street' || object.type === 'car_lane') return 'road';
  if (object.type === 'parking_area' || object.type === 'loading_zone') return 'parking';
  if (object.type === 'bike_lane' || object.type === 'sidewalk') return object.type;
  return null;
}
export function streetLevel(feature: {
  layerIndex?: number;
  deckElevationMeters?: number;
  level?: string;
  structureKind?: string;
}) {
  return `${feature.layerIndex ?? 0}:${feature.deckElevationMeters ?? 0}:${feature.level ?? 'surface'}:${feature.structureKind ?? 'surface'}`;
}
export function objectStreetLevel(object: CityDesignObject) {
  return streetLevel({
    layerIndex: Number(object.properties.layerIndex) || 0,
    deckElevationMeters: Number(object.properties.deckElevationMeters) || 0,
    level: typeof object.properties.level === 'string' ? object.properties.level : undefined,
    structureKind:
      typeof object.properties.structureKind === 'string'
        ? object.properties.structureKind
        : undefined,
  });
}
export function designStreetSources(objects: readonly CityDesignObject[]): StreetNetworkSource[] {
  return objects.flatMap<StreetNetworkSource>(object => {
    const kind = objectKind(object),
      geometry = object.geometry;
    if (!kind || geometry.kind === 'point') return [];
    if (geometry.kind === 'polygon')
      return [
        {
          id: object.id,
          kind,
          width: Number(object.properties.width) || 0,
          level: objectStreetLevel(object),
          points: geometry.points,
          polygon: geometry.points,
        },
      ];
    return [
      {
        id: object.id,
        kind,
        width: geometry.width,
        level: objectStreetLevel(object),
        points:
          geometry.kind === 'corridor'
            ? [geometry.start, geometry.end]
            : geometry.cornerRadius === 0
              ? geometry.roundedCenterline
              : geometry.points,
        sampled: geometry.kind === 'path_corridor' && geometry.cornerRadius === 0,
        estimated:
          object.properties.widthSource === 'lanes' || object.properties.widthSource === 'default',
        ...streetLaneProperties(
          object.properties,
          object.type === 'car_lane' && object.properties.direction !== 'two_way' ? 1 : 2
        ),
      },
    ];
  });
}
export function osmStreetSources(
  features: CityDesignOsmFeature[],
  design: CityDesignStateV1
): StreetNetworkSource[] {
  return features.flatMap(feature => {
    if (
      !['road', 'bike_lane', 'sidewalk', 'parking'].includes(feature.kind) ||
      feature.geometryKind === 'point' ||
      !feature.points ||
      feature.points.length < 2
    )
      return [];
    return [
      {
        id: feature.id,
        kind: feature.kind as StreetSurfaceKind,
        points: feature.points.map(point => projectGeoPointToLocal(point, design.origin)),
        width: feature.widthMeters ?? (feature.kind === 'road' ? 4.8 : 2.4),
        level: streetLevel(feature),
        nodeIds: feature.nodeIds,
        polygon:
          feature.geometryKind === 'polygon'
            ? feature.points.map(point => projectGeoPointToLocal(point, design.origin))
            : undefined,
        parentId: feature.tags?.['polity:derived_from'],
        offset: feature.offsetMeters,
        estimated: feature.widthSource ? feature.widthSource !== 'osm' : true,
        ...streetLaneProperties(getCityDesignOsmSemanticMapping(feature).properties),
      },
    ];
  });
}

export function streetLaneProperties(properties: CityDesignObject['properties'], fallback = 2) {
  return {
    lanes: typeof properties.lanes === 'number' ? properties.lanes : fallback,
    direction: typeof properties.direction === 'string' ? properties.direction : 'two_way',
    onewayReversed: properties.onewayReversed === true,
    lanesForward: typeof properties.lanesForward === 'number' ? properties.lanesForward : undefined,
    lanesBackward:
      typeof properties.lanesBackward === 'number' ? properties.lanesBackward : undefined,
    lanesBothWays:
      typeof properties.lanesBothWays === 'number' ? properties.lanesBothWays : undefined,
    laneMarkings: properties.laneMarkings !== false,
    turnLanes: [
      properties.turnLanes,
      properties.turnLanesForward,
      properties.turnLanesBackward,
    ].find((value): value is string => typeof value === 'string' && value.length > 0),
  };
}
export function getDesignStreetNetwork(objects: readonly CityDesignObject[]) {
  return buildStreetNetwork(
    designStreetSources(objects),
    objects
      .filter(object => object.type === 'traffic_island')
      .map(object => ({
        level: objectStreetLevel(object),
        points:
          object.geometry.kind === 'polygon'
            ? object.geometry.points
            : object.geometry.kind === 'point'
              ? []
              : object.geometry.polygon,
      }))
      .filter(hole => hole.points.length >= 3)
  );
}
export function getOsmStreetNetwork(design: CityDesignStateV1, features?: CityDesignOsmFeature[]) {
  const hidden = getCityDesignHiddenOsmFeatureIds(design);
  const visibility = getCityDesignOsmLayerVisibility(design.osmLayerVisibility);
  const visible =
    features ??
    getCityDesignOsmFeatures(design.osmSnapshot).filter(
      feature => !hidden.has(feature.id) && visibility[getCityDesignOsmFeatureLayer(feature.kind)]
    );
  return buildStreetNetwork(
    osmStreetSources(visible, design),
    visible
      .filter(
        feature =>
          feature.subkind === 'traffic_island' &&
          feature.geometryKind === 'polygon' &&
          (feature.points?.length ?? 0) >= 3
      )
      .map(feature => ({
        level: streetLevel(feature),
        points: (feature.points as NonNullable<CityDesignOsmFeature['points']>).map(point =>
          projectGeoPointToLocal(point, design.origin)
        ),
      }))
  );
}

export interface StreetMeasurement {
  start: CityDesignLocalPoint;
  end: CityDesignLocalPoint;
  layer: CityDesignComparisonLayer;
  level?: string;
}
export interface StreetMeasurementInterval {
  start: number;
  end: number;
  ids: string[];
}
/** Intersect a finite measuring line with polygons including holes, then sweep its intervals. */
export function measureStreetCrossSection(network: StreetNetwork, measurement: StreetMeasurement) {
  const { start, end } = measurement;
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  const intervals: { id: string; start: number; end: number; estimated: boolean }[] = [];
  if (length < EPSILON)
    return {
      length,
      span: 0,
      covered: 0,
      gaps: 0,
      overlaps: 0,
      intervals,
      sections: [] as StreetMeasurementInterval[],
    };
  for (const feature of network.features.values()) {
    if (measurement.level && feature.source.level !== measurement.level) continue;
    for (const polygon of feature.footprint) {
      const cuts = [0, 1];
      for (const ring of polygon)
        for (let i = 0; i < ring.length; i += 1) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length];
          const hit = segmentIntersection(start, end, { x: a[0], z: a[1] }, { x: b[0], z: b[1] });
          if (hit) cuts.push(Math.max(0, Math.min(1, hit.t)));
        }
      const sorted = [...new Set(cuts)].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) {
        const middle = (sorted[i - 1] + sorted[i]) / 2;
        const x = start.x + (end.x - start.x) * middle,
          z = start.z + (end.z - start.z) * middle;
        const inside = (ring: number[][]) => {
          let result = false;
          for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
            const a = ring[j],
              b = ring[k];
            if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
              result = !result;
          }
          return result;
        };
        if (
          inside(polygon[0]) &&
          !polygon.slice(1).some(inside) &&
          (sorted[i] - sorted[i - 1]) * length > EPSILON
        ) {
          intervals.push({
            id: feature.source.id,
            start: sorted[i - 1] * length,
            end: sorted[i] * length,
            estimated: Boolean(feature.source.estimated),
          });
        }
      }
    }
  }
  const cuts = [...new Set(intervals.flatMap(interval => [interval.start, interval.end]))].sort(
    (a, b) => a - b
  );
  const sections: StreetMeasurementInterval[] = [];
  let covered = 0,
    overlaps = 0;
  for (let i = 1; i < cuts.length; i += 1) {
    const middle = (cuts[i - 1] + cuts[i]) / 2;
    const ids = [
      ...new Set(
        intervals
          .filter(interval => interval.start < middle && interval.end > middle)
          .map(interval => interval.id)
      ),
    ];
    const size = cuts[i] - cuts[i - 1];
    if (ids.length) covered += size;
    if (ids.length > 1) overlaps += size;
    sections.push({ start: cuts[i - 1], end: cuts[i], ids });
  }
  const span = cuts.length ? cuts[cuts.length - 1] - cuts[0] : 0;
  return { length, span, covered, gaps: span - covered, overlaps, intervals, sections };
}

export const streetNetworkInternals = { segmentIntersection };

import type { MultiPolygon } from 'polygon-clipping';
import type { CityDesignLocalPoint, CorridorGeometry, PathCorridorGeometry } from '../types';
import { createSampledCorridorGeometry } from './cityDesignPlacement';
import {
  offsetStreetCenterline,
  streetNetworkInternals,
  streetPolygon,
  streetPolygonOperations,
  type StreetNetworkFeature,
  type StreetNetworkSource,
} from './cityDesignStreetNetwork';

export interface StreetMarking {
  kind: 'divider' | 'guide';
  offset: number;
  points: CityDesignLocalPoint[];
  width: number;
  polygons?: MultiPolygon;
}
const cache = new WeakMap<StreetNetworkFeature, StreetMarking[]>();

function contains(polygons: MultiPolygon, point: CityDesignLocalPoint) {
  const inside = (ring: number[][]) => {
    let value = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j];
      if (
        a[1] > point.z !== b[1] > point.z &&
        point.x < ((b[0] - a[0]) * (point.z - a[1])) / (b[1] - a[1]) + a[0]
      )
        value = !value;
    }
    return value;
  };
  return polygons.some(polygon => inside(polygon[0]) && !polygon.slice(1).some(inside));
}

function distances(points: CityDesignLocalPoint[]) {
  const result = [0];
  for (let i = 1; i < points.length; i++)
    result.push(
      result[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
    );
  return result;
}
function sample(points: CityDesignLocalPoint[], lengths: number[], distance: number) {
  let index = 1;
  while (index < lengths.length - 1 && lengths[index] < distance) index++;
  const ratio = Math.max(
    0,
    Math.min(1, (distance - lengths[index - 1]) / (lengths[index] - lengths[index - 1]))
  );
  return {
    x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
    z: points[index - 1].z + (points[index].z - points[index - 1].z) * ratio,
  };
}
function junctionIntervals(points: CityDesignLocalPoint[], polygons: MultiPolygon) {
  const lengths = distances(points);
  const result: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    const cuts = [0, 1];
    for (const polygon of polygons)
      for (const ring of polygon)
        for (let j = 1; j < ring.length; j++) {
          const hit = streetNetworkInternals.segmentIntersection(
            points[i - 1],
            points[i],
            { x: ring[j - 1][0], z: ring[j - 1][1] },
            { x: ring[j][0], z: ring[j][1] }
          );
          if (hit) cuts.push(Math.max(0, Math.min(1, hit.t)));
        }
    const sorted = [...new Set(cuts)].sort((a, b) => a - b);
    for (let j = 1; j < sorted.length; j++) {
      const start = lengths[i - 1] + (lengths[i] - lengths[i - 1]) * sorted[j - 1];
      const end = lengths[i - 1] + (lengths[i] - lengths[i - 1]) * sorted[j];
      if (end - start < 0.001 || !contains(polygons, sample(points, lengths, (start + end) / 2)))
        continue;
      const last = result[result.length - 1];
      if (last && Math.abs(last[1] - start) < 0.002) last[1] = end;
      else result.push([start, end]);
    }
  }
  return result;
}

/** Lane separators follow the axis; guides never imply priority or turning permissions. */
export function createStreetMarkings(args: {
  geometry: CorridorGeometry | PathCorridorGeometry;
  source: Partial<StreetNetworkSource>;
  footprint?: MultiPolygon;
  junctions?: MultiPolygon;
  markingCenterline?: CityDesignLocalPoint[];
}): StreetMarking[] {
  const { geometry, source, footprint, junctions = [] } = args;
  if (source.laneMarkings === false || !Number.isFinite(source.lanes ?? 2)) return [];
  const lanes = Math.max(1, Math.min(16, Math.round(source.lanes ?? 2)));
  if (lanes < 2) return [];
  const originalCenterline =
    geometry.kind === 'path_corridor' ? geometry.roundedCenterline : [geometry.start, geometry.end];
  const centerline = args.markingCenterline ?? originalCenterline;
  const extended = centerline !== originalCenterline && args.markingCenterline != null;
  if (centerline.length < 2) return [];
  const axisLength = distances(centerline).at(-1) as number;
  if (axisLength < 0.001) return [];
  const junctionsOnAxis = junctionIntervals(centerline, junctions);
  const forward =
    source.lanesForward ??
    (source.lanesBackward != null ? lanes - source.lanesBackward : lanes / 2);
  const knownDirections =
    source.direction === 'one_way' || (Number.isInteger(forward) && forward > 0 && forward < lanes);
  const consistentDirections =
    (source.lanesForward == null ||
      (Number.isInteger(source.lanesForward) &&
        source.lanesForward >= 0 &&
        source.lanesForward <= lanes)) &&
    (source.lanesBackward == null ||
      (Number.isInteger(source.lanesBackward) &&
        source.lanesBackward >= 0 &&
        source.lanesBackward <= lanes)) &&
    (source.lanesForward == null ||
      source.lanesBackward == null ||
      source.lanesForward + source.lanesBackward === lanes) &&
    (source.direction !== 'one_way' || !source.lanesForward || !source.lanesBackward);
  const guidesAllowed =
    knownDirections && consistentDirections && !source.lanesBothWays && !source.turnLanes;
  const result: StreetMarking[] = [];
  for (let lane = 1; lane < lanes; lane++) {
    const offset = -geometry.width / 2 + (geometry.width * lane) / lanes;
    const points = offsetStreetCenterline(centerline, offset);
    const lengths = distances(points),
      length = lengths.at(-1) as number;
    if (length < 0.001) continue;
    const append = (start: number, end: number, kind: StreetMarking['kind']) => {
      const path = [
        sample(points, lengths, start),
        ...points.filter(
          (_, index) => lengths[index] > start + 0.001 && lengths[index] < end - 0.001
        ),
        sample(points, lengths, end),
      ];
      const marking: StreetMarking = {
        kind,
        offset,
        points: path,
        width: kind === 'guide' ? 0.12 : 0.16,
      };
      if (junctions.length || extended || footprint?.some(polygon => polygon.length > 1)) {
        const polygon = streetPolygon(createSampledCorridorGeometry(path, marking.width).polygon);
        marking.polygons =
          kind === 'guide'
            ? streetPolygonOperations.intersection(polygon, junctions)
            : streetPolygonOperations.difference(polygon, junctions);
        if (footprint)
          marking.polygons = streetPolygonOperations.intersection(marking.polygons, footprint);
        if (!marking.polygons.length) return;
      }
      result.push(marking);
    };
    for (let start = 1.6; start < length - 0.4; start += 5.6)
      append(start, Math.min(start + 2.4, length), 'divider');
    if (!guidesAllowed || (source.direction !== 'one_way' && lane === forward)) continue;
    for (const [start, end] of junctionIntervals(points, junctions)) {
      // A branch ending in the junction has no through movement to guide.
      const axisStart = (start / length) * axisLength,
        axisEnd = (end / length) * axisLength;
      if (
        !junctionsOnAxis.some(
          ([a, b]) =>
            a > 0.5 &&
            b < axisLength - 0.5 &&
            axisStart < b + geometry.width &&
            axisEnd > a - geometry.width
        )
      )
        continue;
      for (let distance = start + 0.25; distance < end - 0.2; distance += 2)
        append(distance, Math.min(distance + 1, end), 'guide');
    }
  }
  return result;
}

export function getStreetMarkings(feature: StreetNetworkFeature) {
  const cached = cache.get(feature);
  if (cached) return cached;
  const markings = createStreetMarkings(feature);
  cache.set(feature, markings);
  return markings;
}

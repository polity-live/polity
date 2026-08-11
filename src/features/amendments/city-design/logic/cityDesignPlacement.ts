import type {
  CorridorGeometry,
  PathCorridorGeometry,
  PointGeometry,
  PolygonGeometry,
  CityDesignGeometry,
  CityDesignLocalPoint,
  CityDesignObject,
  CityDesignObjectDefinition,
  CityDesignObjectType,
  CityDesignPropertyValue,
} from '../types';
import { getCityDesignCostCatalogEntry } from './cityDesignCostCatalog';
import { getCityDesignObjectDefinition } from './cityDesignObjectRegistry';

const MIN_CORRIDOR_LENGTH = 0.05;
const PATH_CORRIDOR_TYPES = new Set<CityDesignObjectType>([
  'tree',
  'bush',
  'grass_strip',
  'flower_bed',
  'scrub_area',
  'heath_area',
  'orchard_area',
  'vineyard_area',
  'water_area',
  'wetland_area',
  'street',
  'car_lane',
  'bike_lane',
  'sidewalk',
  'building',
  'bicycle_parking',
  'fence',
  'wall',
  'crossing',
  'traffic_calming',
  'rail_track',
  'station_platform',
  'playground',
  'sports_pitch',
  'stairs',
  'hedge',
  'construction_area',
  'landuse_context_area',
  'civic_area',
  'kerb',
  'traffic_island',
  'public_space',
  'taxi_stand',
]);

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function normalizeDegrees(value: number) {
  const normalized = value % 360;
  if (Object.is(normalized, -0) || normalized === 0) return 0;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function distanceBetweenPoints(start: CityDesignLocalPoint, end: CityDesignLocalPoint) {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function normalizeVector(dx: number, dz: number) {
  const length = Math.hypot(dx, dz);
  if (length < MIN_CORRIDOR_LENGTH) return { x: 0, z: 0, length };

  return {
    x: dx / length,
    z: dz / length,
    length,
  };
}

function removeConsecutiveDuplicatePoints(points: CityDesignLocalPoint[]) {
  return points.reduce<CityDesignLocalPoint[]>((result, point) => {
    const rounded = { x: roundMetric(point.x), z: roundMetric(point.z) };
    const previous = result[result.length - 1];
    if (previous && distanceBetweenPoints(previous, rounded) < MIN_CORRIDOR_LENGTH) {
      return result;
    }

    result.push(rounded);
    return result;
  }, []);
}

function createRoundedCenterline(points: CityDesignLocalPoint[], width: number) {
  const cleanPoints = removeConsecutiveDuplicatePoints(points);
  if (cleanPoints.length <= 2) return cleanPoints;

  const rounded: CityDesignLocalPoint[] = [cleanPoints[0]];
  const maxCornerRadius = Math.min(Math.max(width, 0.1) * 1.5, 12);

  for (let index = 1; index < cleanPoints.length - 1; index += 1) {
    const previous = cleanPoints[index - 1];
    const current = cleanPoints[index];
    const next = cleanPoints[index + 1];
    const incoming = normalizeVector(previous.x - current.x, previous.z - current.z);
    const outgoing = normalizeVector(next.x - current.x, next.z - current.z);
    const radius = Math.min(maxCornerRadius, incoming.length * 0.35, outgoing.length * 0.35);

    if (radius <= MIN_CORRIDOR_LENGTH || incoming.length <= radius || outgoing.length <= radius) {
      rounded.push(current);
      continue;
    }

    const trimStart = {
      x: current.x + incoming.x * radius,
      z: current.z + incoming.z * radius,
    };
    const trimEnd = {
      x: current.x + outgoing.x * radius,
      z: current.z + outgoing.z * radius,
    };

    rounded.push(trimStart);
    const steps = Math.max(4, Math.ceil(radius / 2));
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const oneMinusT = 1 - t;
      rounded.push({
        x: oneMinusT * oneMinusT * trimStart.x + 2 * oneMinusT * t * current.x + t * t * trimEnd.x,
        z: oneMinusT * oneMinusT * trimStart.z + 2 * oneMinusT * t * current.z + t * t * trimEnd.z,
      });
    }
    rounded.push(trimEnd);
  }

  rounded.push(cleanPoints[cleanPoints.length - 1]);
  return removeConsecutiveDuplicatePoints(rounded);
}

function createOffsetPolygon(centerline: CityDesignLocalPoint[], width: number) {
  if (centerline.length < 2) return [];

  const halfWidth = Math.max(width, 0.1) / 2;
  const left: CityDesignLocalPoint[] = [];
  const right: CityDesignLocalPoint[] = [];

  centerline.forEach((point, index) => {
    const previous = centerline[Math.max(index - 1, 0)];
    const next = centerline[Math.min(index + 1, centerline.length - 1)];
    const direction = normalizeVector(next.x - previous.x, next.z - previous.z);
    const normal = {
      x: -direction.z,
      z: direction.x,
    };

    left.push({
      x: roundMetric(point.x + normal.x * halfWidth),
      z: roundMetric(point.z + normal.z * halfWidth),
    });
    right.push({
      x: roundMetric(point.x - normal.x * halfWidth),
      z: roundMetric(point.z - normal.z * halfWidth),
    });
  });

  return [...left, ...right.reverse()];
}

function getPathLength(points: CityDesignLocalPoint[]) {
  return points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    return sum + distanceBetweenPoints(points[index - 1], point);
  }, 0);
}

export function isPathCorridorObjectType(type: CityDesignObjectType) {
  return PATH_CORRIDOR_TYPES.has(type);
}

export function createPointGeometry(point: CityDesignLocalPoint, rotation = 0): PointGeometry {
  return {
    kind: 'point',
    point: { x: roundMetric(point.x), z: roundMetric(point.z) },
    rotation,
  };
}

function getPolygonArea(points: CityDesignLocalPoint[]) {
  if (points.length < 3) return 0;

  const sum = points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.z - next.x * point.z;
  }, 0);

  return roundMetric(Math.abs(sum) / 2);
}

export function createPolygonGeometry(points: CityDesignLocalPoint[]): PolygonGeometry {
  const cleanPoints = removeConsecutiveDuplicatePoints(points);
  const normalizedPoints =
    cleanPoints.length > 1 &&
    distanceBetweenPoints(cleanPoints[0], cleanPoints[cleanPoints.length - 1]) < MIN_CORRIDOR_LENGTH
      ? cleanPoints.slice(0, -1)
      : cleanPoints;

  return {
    kind: 'polygon',
    points: normalizedPoints,
    area: getPolygonArea(normalizedPoints),
  };
}

function rotatePointAround(
  point: CityDesignLocalPoint,
  center: CityDesignLocalPoint,
  rotationRad: number
): CityDesignLocalPoint {
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  return {
    x: roundMetric(center.x + dx * cos - dz * sin),
    z: roundMetric(center.z + dx * sin + dz * cos),
  };
}

export function getCityDesignGeometryCenter(geometry: CityDesignGeometry): CityDesignLocalPoint {
  if (geometry.kind === 'point') {
    return geometry.point;
  }

  const points =
    geometry.kind === 'corridor'
      ? [geometry.start, geometry.end]
      : geometry.kind === 'path_corridor'
        ? geometry.points
        : geometry.points;

  if (points.length === 0) {
    return { x: 0, z: 0 };
  }

  return {
    x: roundMetric(points.reduce((sum, point) => sum + point.x, 0) / points.length),
    z: roundMetric(points.reduce((sum, point) => sum + point.z, 0) / points.length),
  };
}

export function getCityDesignGeometryRotationDeg(geometry: CityDesignGeometry) {
  if (geometry.kind === 'point') {
    return normalizeDegrees(roundMetric(radToDeg(geometry.rotation)));
  }

  if (geometry.kind === 'corridor') {
    return normalizeDegrees(roundMetric(radToDeg(geometry.rotation)));
  }

  const points = geometry.kind === 'path_corridor' ? geometry.points : geometry.points;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || distanceBetweenPoints(first, last) < MIN_CORRIDOR_LENGTH) {
    return 0;
  }

  return normalizeDegrees(roundMetric(radToDeg(Math.atan2(last.x - first.x, last.z - first.z))));
}

function rotatePolygonGeometry(geometry: PolygonGeometry, rotationDeg: number): PolygonGeometry {
  const center = getCityDesignGeometryCenter(geometry);
  const rotationRad = degToRad(getCityDesignGeometryRotationDeg(geometry) - rotationDeg);
  const points = geometry.points.map(point => rotatePointAround(point, center, rotationRad));

  return {
    ...geometry,
    points,
    area: getPolygonArea(points),
  };
}

export function rotateCityDesignObject(
  object: CityDesignObject,
  rotationDeg: number
): CityDesignObject {
  const normalizedRotationDeg = normalizeDegrees(rotationDeg);
  const currentRotationDeg = getCityDesignGeometryRotationDeg(object.geometry);
  const rotationRad = degToRad(currentRotationDeg - normalizedRotationDeg);

  if (object.geometry.kind === 'point') {
    return {
      ...object,
      geometry: createPointGeometry(object.geometry.point, degToRad(normalizedRotationDeg)),
    };
  }

  const center = getCityDesignGeometryCenter(object.geometry);

  if (object.geometry.kind === 'corridor') {
    return {
      ...object,
      geometry: createCorridorGeometry(
        rotatePointAround(object.geometry.start, center, rotationRad),
        rotatePointAround(object.geometry.end, center, rotationRad),
        object.geometry.width
      ),
    };
  }

  if (object.geometry.kind === 'path_corridor') {
    return {
      ...object,
      geometry: createPathCorridorGeometry(
        object.geometry.points.map(point => rotatePointAround(point, center, rotationRad)),
        object.geometry.width
      ),
    };
  }

  return {
    ...object,
    geometry: rotatePolygonGeometry(object.geometry, normalizedRotationDeg),
  };
}

export function createCorridorGeometry(
  start: CityDesignLocalPoint,
  end: CityDesignLocalPoint,
  width: number
): CorridorGeometry {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.max(distanceBetweenPoints(start, end), MIN_CORRIDOR_LENGTH);
  const directionX = dx / length;
  const directionZ = dz / length;
  const normalX = -directionZ;
  const normalZ = directionX;
  const halfWidth = Math.max(width, 0.1) / 2;

  const polygon = [
    { x: start.x + normalX * halfWidth, z: start.z + normalZ * halfWidth },
    { x: end.x + normalX * halfWidth, z: end.z + normalZ * halfWidth },
    { x: end.x - normalX * halfWidth, z: end.z - normalZ * halfWidth },
    { x: start.x - normalX * halfWidth, z: start.z - normalZ * halfWidth },
  ].map(point => ({ x: roundMetric(point.x), z: roundMetric(point.z) }));

  return {
    kind: 'corridor',
    start: { x: roundMetric(start.x), z: roundMetric(start.z) },
    end: { x: roundMetric(end.x), z: roundMetric(end.z) },
    width: roundMetric(Math.max(width, 0.1)),
    polygon,
    length: roundMetric(length),
    area: roundMetric(length * Math.max(width, 0.1)),
    rotation: roundMetric(Math.atan2(dx, dz)),
  };
}

export function createCorridorPreview(
  start: CityDesignLocalPoint,
  cursor: CityDesignLocalPoint,
  width: number
) {
  return createCorridorGeometry(start, cursor, width);
}

export function createPathCorridorGeometry(
  points: CityDesignLocalPoint[],
  width: number
): PathCorridorGeometry {
  const cleanPoints = removeConsecutiveDuplicatePoints(points);
  const safePoints =
    cleanPoints.length >= 2
      ? cleanPoints
      : [cleanPoints[0] ?? { x: 0, z: 0 }, cleanPoints[0] ?? { x: 0, z: 0 }];
  const safeWidth = roundMetric(Math.max(width, 0.1));
  const roundedCenterline = createRoundedCenterline(safePoints, safeWidth).map(point => ({
    x: roundMetric(point.x),
    z: roundMetric(point.z),
  }));
  const polygon = createOffsetPolygon(roundedCenterline, safeWidth);
  const length = Math.max(getPathLength(roundedCenterline), MIN_CORRIDOR_LENGTH);

  return {
    kind: 'path_corridor',
    points: safePoints,
    roundedCenterline,
    width: safeWidth,
    polygon,
    length: roundMetric(length),
    area: roundMetric(length * safeWidth),
    cornerRadius: roundMetric(Math.min(safeWidth * 1.5, 12)),
  };
}

export function createPathCorridorPreview(
  points: CityDesignLocalPoint[],
  cursor: CityDesignLocalPoint,
  width: number
) {
  return createPathCorridorGeometry([...points, cursor], width);
}

export interface CityDesignObjectCreationOverrides {
  properties?: Record<string, CityDesignPropertyValue>;
  customUnitCostMinor?: number | null;
  rotationDeg?: number;
  currency?: string;
}

function createBaseObjectCost(
  definition: CityDesignObjectDefinition,
  customUnitCostMinor?: number | null,
  currency?: string
) {
  const catalogEntry = getCityDesignCostCatalogEntry(definition.type, currency);

  return {
    rule: definition.costRule,
    currency: catalogEntry.currency,
    suggestedUnitCostMinor: catalogEntry.unitCostMinor,
    ...(customUnitCostMinor == null ? {} : { customUnitCostMinor }),
  };
}

function createObjectProperties(
  definition: CityDesignObjectDefinition,
  overrides?: Record<string, CityDesignPropertyValue>
) {
  return {
    ...definition.defaultProperties,
    ...(overrides ?? {}),
  };
}

export function createPointCityDesignObject(args: {
  id: string;
  type: CityDesignObjectType;
  point: CityDesignLocalPoint;
  overrides?: CityDesignObjectCreationOverrides;
}): CityDesignObject {
  const definition = getCityDesignObjectDefinition(args.type);

  if (definition.geometryKind !== 'point') {
    throw new Error(`${args.type} is not a point element`);
  }

  return {
    id: args.id,
    type: args.type,
    geometry: createPointGeometry(args.point, degToRad(args.overrides?.rotationDeg ?? 0)),
    properties: createObjectProperties(definition, args.overrides?.properties),
    cost: createBaseObjectCost(
      definition,
      args.overrides?.customUnitCostMinor,
      args.overrides?.currency
    ),
  };
}

export function createCorridorCityDesignObject(args: {
  id: string;
  type: CityDesignObjectType;
  start: CityDesignLocalPoint;
  end: CityDesignLocalPoint;
  width?: number;
  overrides?: CityDesignObjectCreationOverrides;
}): CityDesignObject {
  const definition = getCityDesignObjectDefinition(args.type);

  if (definition.geometryKind !== 'corridor') {
    throw new Error(`${args.type} is not a corridor element`);
  }

  const object: CityDesignObject = {
    id: args.id,
    type: args.type,
    geometry: createCorridorGeometry(
      args.start,
      args.end,
      args.width ?? (definition.defaultWidth as number)
    ),
    properties: createObjectProperties(definition, args.overrides?.properties),
    cost: createBaseObjectCost(
      definition,
      args.overrides?.customUnitCostMinor,
      args.overrides?.currency
    ),
  };

  return typeof args.overrides?.rotationDeg === 'number'
    ? rotateCityDesignObject(object, args.overrides.rotationDeg)
    : object;
}

export function createPathCorridorCityDesignObject(args: {
  id: string;
  type: CityDesignObjectType;
  points: CityDesignLocalPoint[];
  width?: number;
  overrides?: CityDesignObjectCreationOverrides;
}): CityDesignObject {
  const definition = getCityDesignObjectDefinition(args.type);

  if (!isPathCorridorObjectType(args.type)) {
    throw new Error(`${args.type} is not a path corridor element`);
  }

  const object: CityDesignObject = {
    id: args.id,
    type: args.type,
    geometry: createPathCorridorGeometry(
      args.points,
      args.width ?? (definition.defaultWidth as number)
    ),
    properties: createObjectProperties(definition, args.overrides?.properties),
    cost: createBaseObjectCost(
      definition,
      args.overrides?.customUnitCostMinor,
      args.overrides?.currency
    ),
  };

  return typeof args.overrides?.rotationDeg === 'number'
    ? rotateCityDesignObject(object, args.overrides.rotationDeg)
    : object;
}

export function updateCorridorWidth(object: CityDesignObject, width: number): CityDesignObject {
  if (object.geometry.kind === 'corridor') {
    return {
      ...object,
      geometry: createCorridorGeometry(object.geometry.start, object.geometry.end, width),
    };
  }

  if (object.geometry.kind === 'path_corridor') {
    return {
      ...object,
      geometry: createPathCorridorGeometry(object.geometry.points, width),
    };
  }

  return object;
}

export function movePointObject(
  object: CityDesignObject,
  point: CityDesignLocalPoint
): CityDesignObject {
  if (object.geometry.kind !== 'point') {
    return object;
  }

  return {
    ...object,
    geometry: createPointGeometry(point, object.geometry.rotation),
  };
}

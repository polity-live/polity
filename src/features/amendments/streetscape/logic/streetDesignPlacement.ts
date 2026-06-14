import type {
  CorridorGeometry,
  PathCorridorGeometry,
  PointGeometry,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectDefinition,
  StreetDesignObjectType,
} from '../types';
import { getStreetDesignCostCatalogEntry } from './streetDesignCostCatalog';
import { getStreetDesignObjectDefinition } from './streetDesignObjectRegistry';

const MIN_CORRIDOR_LENGTH = 0.05;
const PATH_CORRIDOR_TYPES = new Set<StreetDesignObjectType>([
  'tree',
  'bush',
  'grass_strip',
  'flower_bed',
  'water_area',
  'street',
  'car_lane',
  'bike_lane',
  'sidewalk',
  'building',
]);

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function distanceBetweenPoints(start: StreetDesignLocalPoint, end: StreetDesignLocalPoint) {
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

function removeConsecutiveDuplicatePoints(points: StreetDesignLocalPoint[]) {
  return points.reduce<StreetDesignLocalPoint[]>((result, point) => {
    const rounded = { x: roundMetric(point.x), z: roundMetric(point.z) };
    const previous = result[result.length - 1];
    if (previous && distanceBetweenPoints(previous, rounded) < MIN_CORRIDOR_LENGTH) {
      return result;
    }

    result.push(rounded);
    return result;
  }, []);
}

function createRoundedCenterline(points: StreetDesignLocalPoint[], width: number) {
  const cleanPoints = removeConsecutiveDuplicatePoints(points);
  if (cleanPoints.length <= 2) return cleanPoints;

  const rounded: StreetDesignLocalPoint[] = [cleanPoints[0]];
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

function createOffsetPolygon(centerline: StreetDesignLocalPoint[], width: number) {
  if (centerline.length < 2) return [];

  const halfWidth = Math.max(width, 0.1) / 2;
  const left: StreetDesignLocalPoint[] = [];
  const right: StreetDesignLocalPoint[] = [];

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

function getPathLength(points: StreetDesignLocalPoint[]) {
  return points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    return sum + distanceBetweenPoints(points[index - 1], point);
  }, 0);
}

export function isPathCorridorObjectType(type: StreetDesignObjectType) {
  return PATH_CORRIDOR_TYPES.has(type);
}

export function createPointGeometry(point: StreetDesignLocalPoint, rotation = 0): PointGeometry {
  return {
    kind: 'point',
    point: { x: roundMetric(point.x), z: roundMetric(point.z) },
    rotation,
  };
}

export function createCorridorGeometry(
  start: StreetDesignLocalPoint,
  end: StreetDesignLocalPoint,
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
  start: StreetDesignLocalPoint,
  cursor: StreetDesignLocalPoint,
  width: number
) {
  return createCorridorGeometry(start, cursor, width);
}

export function createPathCorridorGeometry(
  points: StreetDesignLocalPoint[],
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
  points: StreetDesignLocalPoint[],
  cursor: StreetDesignLocalPoint,
  width: number
) {
  return createPathCorridorGeometry([...points, cursor], width);
}

function createBaseObjectCost(definition: StreetDesignObjectDefinition) {
  const catalogEntry = getStreetDesignCostCatalogEntry(definition.type);

  return {
    rule: definition.costRule,
    currency: catalogEntry.currency,
    suggestedUnitCostMinor: catalogEntry.unitCostMinor,
  };
}

export function createPointStreetDesignObject(args: {
  id: string;
  type: StreetDesignObjectType;
  point: StreetDesignLocalPoint;
}): StreetDesignObject {
  const definition = getStreetDesignObjectDefinition(args.type);

  if (definition.geometryKind !== 'point') {
    throw new Error(`${args.type} is not a point element`);
  }

  return {
    id: args.id,
    type: args.type,
    geometry: createPointGeometry(args.point),
    properties: { ...definition.defaultProperties },
    cost: createBaseObjectCost(definition),
  };
}

export function createCorridorStreetDesignObject(args: {
  id: string;
  type: StreetDesignObjectType;
  start: StreetDesignLocalPoint;
  end: StreetDesignLocalPoint;
  width?: number;
}): StreetDesignObject {
  const definition = getStreetDesignObjectDefinition(args.type);

  if (definition.geometryKind !== 'corridor') {
    throw new Error(`${args.type} is not a corridor element`);
  }

  return {
    id: args.id,
    type: args.type,
    geometry: createCorridorGeometry(
      args.start,
      args.end,
      args.width ?? definition.defaultWidth ?? 2
    ),
    properties: { ...definition.defaultProperties },
    cost: createBaseObjectCost(definition),
  };
}

export function createPathCorridorStreetDesignObject(args: {
  id: string;
  type: StreetDesignObjectType;
  points: StreetDesignLocalPoint[];
  width?: number;
}): StreetDesignObject {
  const definition = getStreetDesignObjectDefinition(args.type);

  if (!isPathCorridorObjectType(args.type)) {
    throw new Error(`${args.type} is not a path corridor element`);
  }

  return {
    id: args.id,
    type: args.type,
    geometry: createPathCorridorGeometry(
      args.points,
      args.width ?? ('defaultWidth' in definition ? definition.defaultWidth : undefined) ?? 2
    ),
    properties: { ...definition.defaultProperties },
    cost: createBaseObjectCost(definition),
  };
}

export function updateCorridorWidth(object: StreetDesignObject, width: number): StreetDesignObject {
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
  object: StreetDesignObject,
  point: StreetDesignLocalPoint
): StreetDesignObject {
  if (object.geometry.kind !== 'point') {
    return object;
  }

  return {
    ...object,
    geometry: createPointGeometry(point, object.geometry.rotation),
  };
}

import type {
  CorridorGeometry,
  PointGeometry,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectDefinition,
  StreetDesignObjectType,
} from '../types';
import { getStreetDesignCostCatalogEntry } from './streetDesignCostCatalog';
import { getStreetDesignObjectDefinition } from './streetDesignObjectRegistry';

const MIN_CORRIDOR_LENGTH = 0.05;

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function distanceBetweenPoints(start: StreetDesignLocalPoint, end: StreetDesignLocalPoint) {
  return Math.hypot(end.x - start.x, end.z - start.z);
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

export function updateCorridorWidth(object: StreetDesignObject, width: number): StreetDesignObject {
  if (object.geometry.kind !== 'corridor') {
    return object;
  }

  return {
    ...object,
    geometry: createCorridorGeometry(object.geometry.start, object.geometry.end, width),
  };
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

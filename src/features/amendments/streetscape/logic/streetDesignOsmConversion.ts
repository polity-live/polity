import type {
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignOrigin,
  StreetDesignOsmFeature,
} from '../types';
import { getStreetDesignCostCatalogEntry } from './streetDesignCostCatalog';
import { getStreetDesignObjectDefinition } from './streetDesignObjectRegistry';
import { getStreetDesignOsmFeaturePoints } from './streetDesignOsm';
import {
  createPathCorridorStreetDesignObject,
  createPathCorridorGeometry,
  createPointStreetDesignObject,
  createPolygonGeometry,
  distanceBetweenPoints,
} from './streetDesignPlacement';
import { projectGeoPointToLocal } from './streetDesignProjection';

function offsetLocalPoints(points: StreetDesignLocalPoint[], offsetMeters?: number) {
  if (!offsetMeters || points.length < 2) return points;

  return points.map((point, index) => {
    const previous = points[Math.max(index - 1, 0)] ?? point;
    const next = points[Math.min(index + 1, points.length - 1)] ?? point;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    return {
      x: point.x + (-dz / length) * offsetMeters,
      z: point.z + (dx / length) * offsetMeters,
    };
  });
}

function localFeaturePoints(feature: StreetDesignOsmFeature, origin: StreetDesignOrigin) {
  const points = getStreetDesignOsmFeaturePoints(feature).map(point =>
    projectGeoPointToLocal(point, origin)
  );
  return feature.geometryKind === 'point'
    ? points
    : offsetLocalPoints(points, feature.offsetMeters);
}

function center(points: StreetDesignLocalPoint[]) {
  if (points.length === 0) return { x: 0, z: 0 };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

function samplePath(points: StreetDesignLocalPoint[], spacing: number) {
  if (points.length < 2) return points;
  const samples: StreetDesignLocalPoint[] = [points[0]];
  let distanceToNext = spacing;

  for (let index = 1; index < points.length && samples.length < 90; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distanceBetweenPoints(start, end);
    if (segmentLength <= 0) continue;
    let travelled = distanceToNext;
    while (travelled <= segmentLength && samples.length < 90) {
      const ratio = travelled / segmentLength;
      samples.push({
        x: start.x + (end.x - start.x) * ratio,
        z: start.z + (end.z - start.z) * ratio,
      });
      travelled += spacing;
    }
    distanceToNext = Math.max(0.01, travelled - segmentLength);
  }

  return samples;
}

function withProvenance(object: StreetDesignObject, feature: StreetDesignOsmFeature) {
  return {
    ...object,
    provenance: {
      source: 'osm' as const,
      featureId: feature.id,
      confidence: feature.mappingConfidence ?? 'generic',
    },
  };
}

export function convertStreetDesignOsmFeature(args: {
  feature: StreetDesignOsmFeature;
  origin: StreetDesignOrigin;
  createId: () => string;
  currency?: string;
}) {
  const { feature, origin, createId, currency } = args;
  const type = feature.mappedObjectType;
  if (!type || feature.mappingConfidence === 'generic') return [];

  const definition = getStreetDesignObjectDefinition(type);
  const properties = feature.mappedProperties ?? {};
  const points = localFeaturePoints(feature, origin);
  if (points.length === 0) return [];

  if (feature.kind === 'tree_row') {
    const spacingValue = properties.spacing;
    const spacing = typeof spacingValue === 'number' ? Math.max(spacingValue, 2) : 6;
    return samplePath(points, spacing).map(point =>
      withProvenance(
        createPointStreetDesignObject({
          id: createId(),
          type: 'tree',
          point,
          overrides: { properties, currency },
        }),
        feature
      )
    );
  }

  if (definition.geometryKind === 'point') {
    return [
      withProvenance(
        createPointStreetDesignObject({
          id: createId(),
          type,
          point: center(points),
          overrides: { properties, currency },
        }),
        feature
      ),
    ];
  }

  if (feature.geometryKind === 'polygon' && points.length >= 3) {
    const catalogEntry = getStreetDesignCostCatalogEntry(type, currency);
    const object: StreetDesignObject = {
      id: createId(),
      type,
      geometry: createPolygonGeometry(points),
      properties: { ...definition.defaultProperties, ...properties },
      cost: {
        rule: definition.costRule,
        currency: catalogEntry.currency,
        suggestedUnitCostMinor: catalogEntry.unitCostMinor,
      },
    };
    return [withProvenance(object, feature)];
  }

  const corridorPoints =
    points.length >= 2
      ? points
      : [
          { x: points[0].x, z: points[0].z - 1.5 },
          { x: points[0].x, z: points[0].z + 1.5 },
        ];
  if (type === 'parking_area' || type === 'loading_zone') {
    const catalogEntry = getStreetDesignCostCatalogEntry(type, currency);
    return [
      withProvenance(
        {
          id: createId(),
          type,
          geometry: createPathCorridorGeometry(
            corridorPoints,
            feature.widthMeters ?? definition.defaultWidth ?? 2.5
          ),
          properties: { ...definition.defaultProperties, ...properties },
          cost: {
            rule: definition.costRule,
            currency: catalogEntry.currency,
            suggestedUnitCostMinor: catalogEntry.unitCostMinor,
          },
        },
        feature
      ),
    ];
  }
  return [
    withProvenance(
      createPathCorridorStreetDesignObject({
        id: createId(),
        type,
        points: corridorPoints,
        width: feature.widthMeters ?? definition.defaultWidth,
        overrides: { properties, currency },
      }),
      feature
    ),
  ];
}

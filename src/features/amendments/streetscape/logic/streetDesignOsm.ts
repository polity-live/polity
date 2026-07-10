import type {
  StreetDesignOsmFeature,
  StreetDesignOsmFeatureKind,
  StreetDesignOsmFeatureLayer,
  StreetDesignOsmLayerVisibility,
  StreetDesignOsmSnapshot,
  StreetDesignStateV1,
} from '../types';
import { applyStreetDesignOsmSemanticMapping } from './streetDesignOsmMapping';

export const DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY: StreetDesignOsmLayerVisibility = {
  road: true,
  building: true,
  green: true,
  water: true,
  sidewalk: true,
  bike_lane: true,
  parking: true,
  trees: true,
  rail: true,
  transit: true,
  barrier: true,
  street_furniture: true,
  traffic: true,
  sports: true,
  construction: true,
  landuse_context: true,
};

function hasClosedRing(feature: StreetDesignOsmFeature) {
  const points = feature.points ?? [];
  const first = points[0];
  const last = points[points.length - 1];
  return (
    points.length >= 4 && Boolean(first && last && first.lat === last.lat && first.lon === last.lon)
  );
}

export function getStreetDesignOsmFeatureLayer(
  kind: StreetDesignOsmFeatureKind
): StreetDesignOsmFeatureLayer {
  if (kind === 'tree' || kind === 'tree_row') return 'trees';
  if (kind === 'utility') return 'street_furniture';
  if (kind === 'playground') return 'sports';
  if (kind === 'civic_area') return 'landuse_context';
  return kind;
}

export function getStreetDesignOsmLayerVisibility(
  visibility: Partial<StreetDesignOsmLayerVisibility> | null | undefined
): StreetDesignOsmLayerVisibility {
  return {
    ...DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY,
    ...(visibility ?? {}),
  };
}

export function getStreetDesignOsmFeaturePoints(feature: StreetDesignOsmFeature) {
  if (feature.geometryKind === 'point') {
    return feature.point ? [feature.point] : [];
  }

  return feature.points ?? [];
}

export function normalizeStreetDesignOsmFeature(
  feature: Partial<StreetDesignOsmFeature>
): StreetDesignOsmFeature | null {
  if (!feature.id || !feature.kind) return null;

  const point = feature.point;
  const points = feature.points ?? [];
  const inferredGeometryKind =
    feature.geometryKind ??
    (point
      ? 'point'
      : feature.kind === 'building' ||
          feature.kind === 'green' ||
          feature.kind === 'water' ||
          feature.kind === 'parking' ||
          feature.kind === 'sports' ||
          feature.kind === 'playground' ||
          feature.kind === 'construction' ||
          feature.kind === 'landuse_context' ||
          feature.kind === 'civic_area' ||
          hasClosedRing(feature as StreetDesignOsmFeature)
        ? 'polygon'
        : 'line');

  if (inferredGeometryKind === 'point') {
    if (!point) return null;
    return applyStreetDesignOsmSemanticMapping({
      ...(feature as StreetDesignOsmFeature),
      id: feature.id,
      kind: feature.kind,
      geometryKind: 'point',
      point,
      source: feature.source ?? 'osm',
    });
  }

  if (points.length < 2) return null;

  return applyStreetDesignOsmSemanticMapping({
    ...(feature as StreetDesignOsmFeature),
    id: feature.id,
    kind: feature.kind,
    geometryKind: inferredGeometryKind,
    points,
    source: feature.source ?? 'osm',
  });
}

export function normalizeStreetDesignOsmSnapshot(
  snapshot: StreetDesignOsmSnapshot | null | undefined
): StreetDesignOsmSnapshot | null {
  if (!snapshot) return null;

  const sourceFeatures = snapshot.features?.length ? snapshot.features : (snapshot.ways ?? []);
  const features = sourceFeatures
    .map(feature => normalizeStreetDesignOsmFeature(feature))
    .filter((feature): feature is StreetDesignOsmFeature => Boolean(feature));

  return {
    ...snapshot,
    features,
    ways: features,
  };
}

export function getStreetDesignOsmFeatures(snapshot: StreetDesignOsmSnapshot | null | undefined) {
  return normalizeStreetDesignOsmSnapshot(snapshot)?.features ?? [];
}

export function getStreetDesignHiddenOsmFeatureIds(design: StreetDesignStateV1) {
  return new Set([...(design.hiddenOsmWayIds ?? []), ...(design.hiddenOsmFeatureIds ?? [])]);
}

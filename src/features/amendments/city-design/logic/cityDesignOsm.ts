import type {
  CityDesignOsmFeature,
  CityDesignOsmFeatureKind,
  CityDesignOsmFeatureLayer,
  CityDesignOsmLayerVisibility,
  CityDesignOsmSnapshot,
  CityDesignStateV1,
} from '../types';
import { applyCityDesignOsmSemanticMapping } from './cityDesignOsmMapping';

export const DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY: CityDesignOsmLayerVisibility = {
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

function hasClosedRing(feature: CityDesignOsmFeature) {
  const points = feature.points ?? [];
  const first = points[0];
  const last = points[points.length - 1];
  return (
    points.length >= 4 && Boolean(first && last && first.lat === last.lat && first.lon === last.lon)
  );
}

export function getCityDesignOsmFeatureLayer(
  kind: CityDesignOsmFeatureKind
): CityDesignOsmFeatureLayer {
  if (kind === 'tree' || kind === 'tree_row') return 'trees';
  if (kind === 'utility') return 'street_furniture';
  if (kind === 'playground') return 'sports';
  if (kind === 'civic_area') return 'landuse_context';
  return kind;
}

export function getCityDesignOsmLayerVisibility(
  visibility: Partial<CityDesignOsmLayerVisibility> | null | undefined
): CityDesignOsmLayerVisibility {
  return {
    ...DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
    ...(visibility ?? {}),
  };
}

export function getCityDesignOsmFeaturePoints(feature: CityDesignOsmFeature) {
  if (feature.geometryKind === 'point') {
    return feature.point ? [feature.point] : [];
  }

  return feature.points ?? [];
}

export function normalizeCityDesignOsmFeature(
  feature: Partial<CityDesignOsmFeature>
): CityDesignOsmFeature | null {
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
          hasClosedRing(feature as CityDesignOsmFeature)
        ? 'polygon'
        : 'line');

  if (inferredGeometryKind === 'point') {
    if (!point) return null;
    return applyCityDesignOsmSemanticMapping({
      ...(feature as CityDesignOsmFeature),
      id: feature.id,
      kind: feature.kind,
      geometryKind: 'point',
      point,
      source: feature.source ?? 'osm',
    });
  }

  if (points.length < 2) return null;

  return applyCityDesignOsmSemanticMapping({
    ...(feature as CityDesignOsmFeature),
    id: feature.id,
    kind: feature.kind,
    geometryKind: inferredGeometryKind,
    points,
    source: feature.source ?? 'osm',
  });
}

export function normalizeCityDesignOsmSnapshot(
  snapshot: CityDesignOsmSnapshot | null | undefined
): CityDesignOsmSnapshot | null {
  if (!snapshot) return null;

  const sourceFeatures = snapshot.features?.length ? snapshot.features : (snapshot.ways ?? []);
  const features = sourceFeatures
    .map(feature => normalizeCityDesignOsmFeature(feature))
    .filter((feature): feature is CityDesignOsmFeature => Boolean(feature));

  return {
    fetchedAt: snapshot.fetchedAt,
    bbox: snapshot.bbox,
    features,
  };
}

export function getCityDesignOsmFeatures(snapshot: CityDesignOsmSnapshot | null | undefined) {
  return normalizeCityDesignOsmSnapshot(snapshot)?.features ?? [];
}

export function isCityDesignFallbackSnapshot(snapshot: CityDesignOsmSnapshot | null | undefined) {
  const features = getCityDesignOsmFeatures(snapshot);
  return features.length > 0 && features.every(feature => feature.source === 'fallback');
}

export function getCityDesignHiddenOsmFeatureIds(design: CityDesignStateV1) {
  return new Set([
    ...(design.hiddenOsmWayIds ?? []),
    ...(design.hiddenOsmFeatureIds ?? []),
    ...design.objects.flatMap(object =>
      object.provenance?.source === 'osm' && object.provenance.featureId
        ? [object.provenance.featureId]
        : []
    ),
  ]);
}

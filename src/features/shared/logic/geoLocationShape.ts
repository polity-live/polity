import { toMutableJSONValue, type MutableJSONValue } from '@/zero/shared/helpers';

export type GeoLocationKind = 'point' | 'postcode' | 'city' | 'region' | 'country';

export interface GeoJsonGeometry {
  type:
    | 'Point'
    | 'MultiPoint'
    | 'LineString'
    | 'MultiLineString'
    | 'Polygon'
    | 'MultiPolygon'
    | 'GeometryCollection';
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}

export interface GeoLocationBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface GeoLocationShape {
  kind: GeoLocationKind;
  placeId?: string | null;
  boundarySource?: string | null;
  geometry?: GeoJsonGeometry | null;
  bounds?: GeoLocationBounds | null;
}

export interface GeoLocationShapeFields {
  location_kind?: string | null;
  location_place_id?: string | null;
  location_boundary_source?: string | null;
  location_geometry?: unknown | null;
  location_bounds?: unknown | null;
}

export interface GeoLocationStoredFields {
  location_kind: string | null;
  location_place_id: string | null;
  location_boundary_source: string | null;
  location_geometry: MutableJSONValue | null;
  location_bounds: MutableJSONValue | null;
}

export function isAreaLocationKind(
  kind?: string | null
): kind is Exclude<GeoLocationKind, 'point'> {
  return kind === 'postcode' || kind === 'city' || kind === 'region' || kind === 'country';
}

export function isGeoJsonGeometry(value: unknown): value is GeoJsonGeometry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const geometry = value as { type?: unknown };
  return typeof geometry.type === 'string';
}

export function isGeoLocationBounds(value: unknown): value is GeoLocationBounds {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const bounds = value as Record<string, unknown>;
  return (
    typeof bounds.south === 'number' &&
    typeof bounds.west === 'number' &&
    typeof bounds.north === 'number' &&
    typeof bounds.east === 'number'
  );
}

export function hasGeoLocationGeometry(
  shape?: GeoLocationShape | null
): shape is GeoLocationShape & { geometry: GeoJsonGeometry } {
  return isGeoJsonGeometry(shape?.geometry);
}

export function hasGeoLocationBounds(
  shape?: GeoLocationShape | null
): shape is GeoLocationShape & { bounds: GeoLocationBounds } {
  return isGeoLocationBounds(shape?.bounds);
}

export function geoLocationShapeFromFields(
  fields?: GeoLocationShapeFields | null
): GeoLocationShape | null {
  if (!fields?.location_kind) {
    return null;
  }

  const kind = fields.location_kind;
  if (!isGeoLocationKind(kind)) {
    return null;
  }

  const geometry = isGeoJsonGeometry(fields.location_geometry) ? fields.location_geometry : null;
  const bounds = isGeoLocationBounds(fields.location_bounds) ? fields.location_bounds : null;

  return {
    kind,
    placeId: fields.location_place_id ?? null,
    boundarySource: fields.location_boundary_source ?? null,
    geometry,
    bounds,
  };
}

export function geoLocationFieldsFromShape(
  shape?: GeoLocationShape | null
): GeoLocationStoredFields {
  return {
    location_kind: shape?.kind ?? null,
    location_place_id: shape?.placeId ?? null,
    location_boundary_source: shape?.boundarySource ?? null,
    location_geometry: shape?.geometry ? toMutableJSONValue(shape.geometry) : null,
    location_bounds: shape?.bounds ? toMutableJSONValue(shape.bounds) : null,
  };
}

function isGeoLocationKind(value: string): value is GeoLocationKind {
  return (
    value === 'point' ||
    value === 'postcode' ||
    value === 'city' ||
    value === 'region' ||
    value === 'country'
  );
}

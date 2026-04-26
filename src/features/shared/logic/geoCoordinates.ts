export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export function hasGeoCoordinates(
  value: Partial<GeoCoordinates> | null | undefined
): value is GeoCoordinates {
  return (
    typeof value?.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    typeof value?.longitude === 'number' &&
    Number.isFinite(value.longitude)
  );
}

export function toGeoCoordinates(
  value: { lat?: number | null; lon?: number | null } | null | undefined
): GeoCoordinates | null {
  if (
    typeof value?.lat !== 'number' ||
    !Number.isFinite(value.lat) ||
    typeof value?.lon !== 'number' ||
    !Number.isFinite(value.lon)
  ) {
    return null;
  }

  return {
    latitude: value.lat,
    longitude: value.lon,
  };
}

export function geoCoordinatesEqual(
  left: GeoCoordinates | null | undefined,
  right: GeoCoordinates | null | undefined,
  precision = 6
): boolean {
  if (!left || !right) {
    return left === right;
  }

  const factor = 10 ** precision;

  return (
    Math.round(left.latitude * factor) === Math.round(right.latitude * factor) &&
    Math.round(left.longitude * factor) === Math.round(right.longitude * factor)
  );
}

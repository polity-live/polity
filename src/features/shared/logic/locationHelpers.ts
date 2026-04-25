export interface LocationParts {
  country?: string | null;
  region?: string | null;
  post_code?: string | null;
  city?: string | null;
  street?: string | null;
  house_number?: string | null;
}

function normalizeLocationValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isPresent(value: string | null): value is string {
  return value !== null;
}

export function hasLocationParts(location?: LocationParts | null): boolean {
  if (!location) {
    return false;
  }

  return [
    location.country,
    location.region,
    location.post_code,
    location.city,
    location.street,
    location.house_number,
  ].some(value => !!normalizeLocationValue(value));
}

export function formatLocation(location?: LocationParts | null): string {
  if (!location) {
    return '';
  }

  const streetLine = [
    normalizeLocationValue(location.street),
    normalizeLocationValue(location.house_number),
  ]
    .filter(isPresent)
    .join(' ');

  const localityLine = [
    normalizeLocationValue(location.post_code),
    normalizeLocationValue(location.city),
  ]
    .filter(isPresent)
    .join(' ');

  const regionLine = [
    normalizeLocationValue(location.region),
    normalizeLocationValue(location.country),
  ]
    .filter(isPresent)
    .join(', ');

  return [streetLine, localityLine, regionLine].filter(Boolean).join(', ');
}

export function formatNamedLocation(
  locationName?: string | null,
  location?: LocationParts | null
): string {
  const normalizedName = normalizeLocationValue(locationName);
  const formattedAddress = formatLocation(location);

  return [normalizedName, formattedAddress].filter(Boolean).join(', ');
}

export function buildLocationSearchValue(location?: LocationParts | null): string {
  if (!location) {
    return '';
  }

  return [
    location.country,
    location.region,
    location.post_code,
    location.city,
    location.street,
    location.house_number,
  ]
    .map(value => normalizeLocationValue(value))
    .filter(isPresent)
    .join(' ')
    .toLowerCase();
}

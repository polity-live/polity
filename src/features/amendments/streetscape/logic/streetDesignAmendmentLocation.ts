import { hasGeoCoordinates } from '@/features/shared/logic/geoCoordinates';
import { formatLocation, type LocationParts } from '@/features/shared/logic/locationHelpers';
import type { StreetDesignOrigin } from '../types';

export interface StreetDesignAmendmentLocationSource extends LocationParts {
  title?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function getStreetDesignOriginFromAmendmentLocation(
  amendment?: StreetDesignAmendmentLocationSource | null
): StreetDesignOrigin | null {
  const coordinates = {
    latitude: amendment?.latitude ?? undefined,
    longitude: amendment?.longitude ?? undefined,
  };

  if (!hasGeoCoordinates(coordinates)) {
    return null;
  }

  const label = formatLocation(amendment) || amendment?.title?.trim() || undefined;

  return {
    lat: coordinates.latitude,
    lon: coordinates.longitude,
    ...(label ? { label } : {}),
  };
}

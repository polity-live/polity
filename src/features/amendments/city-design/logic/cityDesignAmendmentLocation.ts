import { hasGeoCoordinates } from '@/features/shared/logic/geoCoordinates';
import { formatLocation, type LocationParts } from '@/features/shared/logic/locationHelpers';
import type { CityDesignOrigin } from '../types';

export interface CityDesignAmendmentLocationSource extends LocationParts {
  title?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function getCityDesignOriginFromAmendmentLocation(
  amendment?: CityDesignAmendmentLocationSource | null
): CityDesignOrigin | null {
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

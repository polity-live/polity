import type { CityDesignGeoPoint, CityDesignSelectionAddress } from '../types';
import type {
  GeoAddressValues,
  GeoResolvedAddress,
} from '@/features/shared/ui/form/GeoAddressInputField';

export const EMPTY_CITY_DESIGN_ADDRESS_VALUES: GeoAddressValues = {
  country: '',
  region: '',
  city: '',
  post_code: '',
  street: '',
  house_number: '',
};

export function createCityDesignSelectionAddress(
  result: GeoResolvedAddress,
  values?: GeoAddressValues
): CityDesignSelectionAddress {
  const resolvedAddressValues = mapCityDesignSelectionAddressToValues({
    country: result.country,
    region: result.state,
    city: result.city,
    postCode: result.postcode,
    street: result.street,
    houseNumber: result.housenumber,
  });
  const addressValues = values
    ? {
        country: resolvedAddressValues.country || values.country,
        region: resolvedAddressValues.region || values.region,
        city: resolvedAddressValues.city || values.city,
        post_code: resolvedAddressValues.post_code || values.post_code,
        street: resolvedAddressValues.street || values.street,
        house_number: resolvedAddressValues.house_number || values.house_number,
      }
    : resolvedAddressValues;

  return compactAddress({
    placeId: result.place_id,
    formatted: result.formatted,
    country: addressValues.country,
    region: addressValues.region,
    city: addressValues.city,
    postCode: addressValues.post_code,
    street: addressValues.street,
    houseNumber: addressValues.house_number,
  });
}

export function mapCityDesignSelectionAddressToValues(
  address?: CityDesignSelectionAddress | null
): GeoAddressValues {
  return {
    country: address?.country ?? '',
    region: address?.region ?? '',
    city: address?.city ?? '',
    post_code: address?.postCode ?? '',
    street: address?.street ?? '',
    house_number: address?.houseNumber ?? '',
  };
}

export function formatCityDesignSelectionAddress(
  address: CityDesignSelectionAddress | null | undefined,
  fallbackLabel: string | null | undefined,
  center: CityDesignGeoPoint
) {
  const formatted = address?.formatted?.trim();
  if (formatted) return formatted;

  const streetLine = [address?.street, address?.houseNumber].filter(Boolean).join(' ').trim();
  const localityLine = [address?.postCode, address?.city].filter(Boolean).join(' ').trim();
  const structured = [streetLine, localityLine, address?.region, address?.country]
    .filter(Boolean)
    .join(', ');
  if (structured) return structured;

  const fallback = fallbackLabel?.trim();
  if (fallback) return fallback;

  return `${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}`;
}

function compactAddress(address: CityDesignSelectionAddress): CityDesignSelectionAddress {
  return Object.fromEntries(
    Object.entries(address).filter(
      ([, value]) => typeof value === 'string' && value.trim().length > 0
    )
  ) as CityDesignSelectionAddress;
}

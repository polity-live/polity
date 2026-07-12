import type { StreetDesignGeoPoint, StreetDesignSelectionAddress } from '../types';
import type {
  GeoAddressValues,
  GeoResolvedAddress,
} from '@/features/shared/ui/form/GeoAddressInputField';

export const EMPTY_STREET_DESIGN_ADDRESS_VALUES: GeoAddressValues = {
  country: '',
  region: '',
  city: '',
  post_code: '',
  street: '',
  house_number: '',
};

export function createStreetDesignSelectionAddress(
  result: GeoResolvedAddress,
  values?: GeoAddressValues
): StreetDesignSelectionAddress {
  const addressValues =
    values ??
    mapStreetDesignSelectionAddressToValues({
      country: result.country,
      region: result.state,
      city: result.city,
      postCode: result.postcode,
      street: result.street,
      houseNumber: result.housenumber,
    });

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

export function mapStreetDesignSelectionAddressToValues(
  address?: StreetDesignSelectionAddress | null
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

export function formatStreetDesignSelectionAddress(
  address: StreetDesignSelectionAddress | null | undefined,
  fallbackLabel: string | null | undefined,
  center: StreetDesignGeoPoint
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

function compactAddress(address: StreetDesignSelectionAddress): StreetDesignSelectionAddress {
  return Object.fromEntries(
    Object.entries(address).filter(
      ([, value]) => typeof value === 'string' && value.trim().length > 0
    )
  ) as StreetDesignSelectionAddress;
}

export type GeoAddressField =
  'country' | 'region' | 'city' | 'post_code' | 'street' | 'house_number';

export interface GeoAddressValues {
  country: string;
  region: string;
  city: string;
  post_code: string;
  street: string;
  house_number: string;
}

export interface GeoResolvedAddress {
  place_id: string;
  country?: string;
  country_code?: string;
  state?: string;
  postcode?: string;
  city?: string;
  street?: string;
  housenumber?: string;
  lat?: number;
  lon?: number;
  formatted?: string;
  result_type?: string;
  rank?: {
    confidence?: number;
    confidence_city_level?: number;
    confidence_street_level?: number;
    confidence_building_level?: number;
  };
}

export interface GeoAddressContext {
  country: GeoResolvedAddress | null;
  region: GeoResolvedAddress | null;
  city: GeoResolvedAddress | null;
  post_code: GeoResolvedAddress | null;
  street: GeoResolvedAddress | null;
}

interface GeoAddressInputFieldProps {
  id: string;
  field: GeoAddressField;
  label: string;
  placeholder: string;
  value: string;
  values: GeoAddressValues;
  context: GeoAddressContext;
  onChange: (value: string) => void;
  onResolved: (field: GeoAddressField, result: GeoResolvedAddress | null) => void;
  autoComplete: string;
  disabled?: boolean;
}
import { useGeoAddressInputFieldController } from './useGeoAddressInputFieldController';
import { GeoAddressInputFieldView } from './GeoAddressInputFieldView';

export function GeoAddressInputField({
  id,
  field,
  label,
  placeholder,
  value,
  values,
  context,
  onChange,
  onResolved,
  autoComplete,
  disabled,
}: GeoAddressInputFieldProps) {
  const viewProps = useGeoAddressInputFieldController({
    id,
    field,
    label,
    placeholder,
    value,
    values,
    context,
    onChange,
    onResolved,
    autoComplete,
    disabled,
  });

  return <GeoAddressInputFieldView {...viewProps} />;
}

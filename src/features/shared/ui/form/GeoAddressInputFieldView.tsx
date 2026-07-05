import {
  type ValidatedInputSuggestion,
  ValidatedInputField,
} from '@/features/shared/ui/form/ValidatedInputField';

export type GeoAddressField =
  | 'country'
  | 'region'
  | 'city'
  | 'post_code'
  | 'street'
  | 'house_number';

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
const FIELD_HINT_KEYS: Record<GeoAddressField, string> = {
  country: 'common.validation.location.countryHint',
  region: 'common.validation.location.regionHint',
  city: 'common.validation.location.cityHint',
  post_code: 'common.validation.location.postCodeHint',
  street: 'common.validation.location.streetHint',
  house_number: 'common.validation.location.houseNumberHint',
};
export interface GeoAddressInputFieldViewProps {
  id: any;
  field: GeoAddressField;
  label: any;
  placeholder: any;
  value: any;
  values: any;
  context: any;
  onChange: any;
  onResolved: any;
  autoComplete: any;
  disabled: any;
  t: any;
  language: any;
  debouncedValue: any;
  validationState: any;
  setValidationState: any;
  suggestions: any;
  setSuggestions: any;
  fieldSuggestions: ValidatedInputSuggestion[];
}

export function GeoAddressInputFieldView({
  id,
  field,
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
  disabled,
  t,
  validationState,
  fieldSuggestions,
}: GeoAddressInputFieldViewProps) {
  return (
    <ValidatedInputField
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      hint={t(FIELD_HINT_KEYS[field])}
      valid={validationState === 'valid'}
      invalid={validationState === 'invalid'}
      suggestions={fieldSuggestions}
      autoComplete={autoComplete}
      disabled={disabled}
      showHint="always"
    />
  );
}

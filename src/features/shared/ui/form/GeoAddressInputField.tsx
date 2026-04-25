import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { isValidHouseNumberFormat } from '@/features/shared/logic/inputValidation';
import {
  type ValidatedInputSuggestion,
  ValidatedInputField,
} from '@/features/shared/ui/form/ValidatedInputField';
import { geoapifySearchFn } from '@/server/geoapify-search';

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
}

const FIELD_HINT_KEYS: Record<GeoAddressField, string> = {
  country: 'common.validation.location.countryHint',
  region: 'common.validation.location.regionHint',
  city: 'common.validation.location.cityHint',
  post_code: 'common.validation.location.postCodeHint',
  street: 'common.validation.location.streetHint',
  house_number: 'common.validation.location.houseNumberHint',
};

const FIELD_MIN_QUERY_LENGTH: Record<GeoAddressField, number> = {
  country: 2,
  region: 2,
  city: 2,
  post_code: 1,
  street: 2,
  house_number: 1,
};

const GEO_ADDRESS_DEBOUNCE_MS = 250;

function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s,.-]+/g, '');
}

function extractFieldValue(field: GeoAddressField, result: GeoResolvedAddress): string {
  switch (field) {
    case 'country':
      return result.country ?? '';
    case 'region':
      return result.state ?? '';
    case 'city':
      return result.city ?? '';
    case 'post_code':
      return result.postcode ?? '';
    case 'street':
      return result.street ?? '';
    case 'house_number':
      return result.housenumber ?? '';
  }
}

function matchesContext(
  field: GeoAddressField,
  result: GeoResolvedAddress,
  context: GeoAddressContext
): boolean {
  if (context.country?.country_code && result.country_code !== context.country.country_code) {
    return false;
  }

  if (
    (field === 'city' || field === 'post_code' || field === 'street' || field === 'house_number') &&
    context.region?.state
  ) {
    const resultRegion = result.state ?? '';
    if (resultRegion && normalizeValue(resultRegion) !== normalizeValue(context.region.state)) {
      return false;
    }
  }

  if (
    (field === 'post_code' || field === 'street' || field === 'house_number') &&
    context.city?.city
  ) {
    const resultCity = result.city ?? '';
    if (resultCity && normalizeValue(resultCity) !== normalizeValue(context.city.city)) {
      return false;
    }
  }

  if ((field === 'street' || field === 'house_number') && context.post_code?.postcode) {
    const resultPostCode = result.postcode ?? '';
    if (
      resultPostCode &&
      normalizeValue(resultPostCode) !== normalizeValue(context.post_code.postcode)
    ) {
      return false;
    }
  }

  if (field === 'house_number' && context.street?.street) {
    const resultStreet = result.street ?? '';
    if (resultStreet && normalizeValue(resultStreet) !== normalizeValue(context.street.street)) {
      return false;
    }
  }

  return true;
}

function findResolvedCandidate(
  field: GeoAddressField,
  query: string,
  results: GeoResolvedAddress[],
  context: GeoAddressContext
): GeoResolvedAddress | null {
  const normalizedQuery = normalizeValue(query);

  const exactMatch = results.find(result => {
    const fieldValue = extractFieldValue(field, result);
    return (
      fieldValue &&
      normalizeValue(fieldValue) === normalizedQuery &&
      matchesContext(field, result, context)
    );
  });

  if (exactMatch) {
    return exactMatch;
  }

  return null;
}

function toSuggestions(
  field: GeoAddressField,
  results: GeoResolvedAddress[]
): ValidatedInputSuggestion[] {
  const seenValues = new Set<string>();

  return results
    .map(result => {
      const fieldValue = extractFieldValue(field, result);
      return {
        value: fieldValue,
        label: result.formatted,
      };
    })
    .filter(option => {
      if (!option.value || seenValues.has(option.value)) {
        return false;
      }

      seenValues.add(option.value);
      return true;
    });
}

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
}: GeoAddressInputFieldProps) {
  const { t, language } = useTranslation();
  const debouncedValue = useDebounce(value.trim(), GEO_ADDRESS_DEBOUNCE_MS);
  const [validationState, setValidationState] = useState<'valid' | 'invalid' | undefined>();
  const [suggestions, setSuggestions] = useState<ValidatedInputSuggestion[]>([]);

  useEffect(() => {
    if (!debouncedValue) {
      setValidationState(undefined);
      setSuggestions([]);
      onResolved(field, null);
      return;
    }

    if (field === 'house_number' && !isValidHouseNumberFormat(debouncedValue)) {
      setValidationState('invalid');
      setSuggestions([]);
      onResolved(field, null);
      return;
    }

    if (debouncedValue.length < FIELD_MIN_QUERY_LENGTH[field]) {
      setValidationState(undefined);
      setSuggestions([]);
      onResolved(field, null);
      return;
    }

    if (field === 'house_number' && !values.street.trim()) {
      setValidationState(undefined);
      setSuggestions([]);
      onResolved(field, null);
      return;
    }

    let isCancelled = false;

    const loadCandidates = async () => {
      try {
        const data = await geoapifySearchFn({
          data: {
            field,
            query: debouncedValue,
            values,
            context,
            language,
          },
        });

        if (isCancelled) {
          return;
        }

        const results = data.results ?? [];
        const resolvedCandidate = findResolvedCandidate(field, debouncedValue, results, context);

        setSuggestions(toSuggestions(field, results));
        setValidationState(resolvedCandidate ? 'valid' : 'invalid');
        onResolved(field, resolvedCandidate);
      } catch {
        if (!isCancelled) {
          setValidationState(undefined);
          setSuggestions([]);
          onResolved(field, null);
        }
      }
    };

    loadCandidates();

    return () => {
      isCancelled = true;
    };
  }, [
    context.city?.city,
    context.city?.place_id,
    context.country?.country_code,
    context.country?.place_id,
    context.post_code?.place_id,
    context.post_code?.postcode,
    context.region?.place_id,
    context.region?.state,
    context.street?.place_id,
    context.street?.street,
    debouncedValue,
    field,
    language,
    onResolved,
    values.city,
    values.country,
    values.post_code,
    values.region,
    values.street,
  ]);

  const fieldSuggestions = useMemo(() => suggestions, [suggestions]);

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
    />
  );
}

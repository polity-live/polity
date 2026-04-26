import { useCallback, useEffect, useState } from 'react';
import {
  GeoAddressInputField,
  type GeoAddressContext,
  type GeoAddressField,
  type GeoAddressValues,
  type GeoResolvedAddress,
} from '@/features/shared/ui/form/GeoAddressInputField';

export type GeoAddressTextMap = Record<GeoAddressField, string>;

interface GeoAddressFieldsProps {
  idPrefix: string;
  values: GeoAddressValues;
  onFieldChange: (field: GeoAddressField, value: string) => void;
  labels: GeoAddressTextMap;
  placeholders: GeoAddressTextMap;
  onResolvedAddress?: (result: GeoResolvedAddress | null) => void;
  resetContextKey?: number | string;
}

const CASCADE_RESET_FIELDS: Record<GeoAddressField, GeoAddressField[]> = {
  country: ['region', 'city', 'post_code', 'street', 'house_number'],
  region: ['city', 'post_code', 'street', 'house_number'],
  city: ['post_code', 'street', 'house_number'],
  post_code: ['street', 'house_number'],
  street: ['house_number'],
  house_number: [],
};

const AUTO_COMPLETE_TOKENS: Record<GeoAddressField, string> = {
  country: 'country-name',
  region: 'address-level1',
  city: 'address-level2',
  post_code: 'postal-code',
  street: 'street-address',
  house_number: 'address-line2',
};

const INITIAL_CONTEXT: GeoAddressContext = {
  country: null,
  region: null,
  city: null,
  post_code: null,
  street: null,
};

const INITIAL_RESOLVED_ADDRESSES: Record<GeoAddressField, GeoResolvedAddress | null> = {
  country: null,
  region: null,
  city: null,
  post_code: null,
  street: null,
  house_number: null,
};

const RESOLVED_ADDRESS_PRIORITY: GeoAddressField[] = [
  'house_number',
  'street',
  'post_code',
  'city',
  'region',
  'country',
];

function hasSameResolvedAddress(
  previousValue: GeoResolvedAddress | null,
  nextValue: GeoResolvedAddress | null
): boolean {
  if (previousValue === nextValue) {
    return true;
  }

  if (!previousValue || !nextValue) {
    return previousValue === nextValue;
  }

  return previousValue.place_id === nextValue.place_id;
}

export function GeoAddressFields({
  idPrefix,
  values,
  onFieldChange,
  labels,
  placeholders,
  onResolvedAddress,
  resetContextKey,
}: GeoAddressFieldsProps) {
  const [context, setContext] = useState<GeoAddressContext>(INITIAL_CONTEXT);
  const [resolvedAddresses, setResolvedAddresses] = useState(INITIAL_RESOLVED_ADDRESSES);

  useEffect(() => {
    setContext(INITIAL_CONTEXT);
    setResolvedAddresses(INITIAL_RESOLVED_ADDRESSES);
  }, [resetContextKey]);

  useEffect(() => {
    if (!onResolvedAddress) {
      return;
    }

    const nextResolvedAddress =
      RESOLVED_ADDRESS_PRIORITY.map(field => resolvedAddresses[field]).find(Boolean) ?? null;

    onResolvedAddress(nextResolvedAddress);
  }, [onResolvedAddress, resolvedAddresses]);

  const handleResolved = useCallback(
    (field: GeoAddressField, result: GeoResolvedAddress | null) => {
      if (field !== 'house_number') {
        setContext(previousContext => {
          if (hasSameResolvedAddress(previousContext[field], result)) {
            return previousContext;
          }

          return {
            ...previousContext,
            [field]: result,
          };
        });
      }

      setResolvedAddresses(previousResolvedAddresses => {
        if (hasSameResolvedAddress(previousResolvedAddresses[field], result)) {
          return previousResolvedAddresses;
        }

        return {
          ...previousResolvedAddresses,
          [field]: result,
        };
      });
    },
    []
  );

  const handleFieldChange = useCallback(
    (field: GeoAddressField, value: string) => {
      const currentValue = values[field];
      onFieldChange(field, value);

      if (currentValue === value) {
        return;
      }

      setContext(previousContext => {
        const nextContext: GeoAddressContext = {
          ...previousContext,
          ...(field === 'house_number' ? {} : { [field]: null }),
        };

        for (const descendantField of CASCADE_RESET_FIELDS[field]) {
          if (descendantField !== 'house_number') {
            nextContext[descendantField] = null;
          }
        }

        return nextContext;
      });

      setResolvedAddresses(previousResolvedAddresses => {
        const nextResolvedAddresses = {
          ...previousResolvedAddresses,
          [field]: null,
        };

        for (const descendantField of CASCADE_RESET_FIELDS[field]) {
          nextResolvedAddresses[descendantField] = null;
        }

        return nextResolvedAddresses;
      });

      for (const descendantField of CASCADE_RESET_FIELDS[field]) {
        if (values[descendantField]) {
          onFieldChange(descendantField, '');
        }
      }
    },
    [onFieldChange, values]
  );

  return (
    <>
      <GeoAddressInputField
        id={`${idPrefix}-country`}
        field="country"
        label={labels.country}
        placeholder={placeholders.country}
        value={values.country}
        values={values}
        context={context}
        onChange={value => handleFieldChange('country', value)}
        onResolved={handleResolved}
        autoComplete={AUTO_COMPLETE_TOKENS.country}
      />
      <GeoAddressInputField
        id={`${idPrefix}-region`}
        field="region"
        label={labels.region}
        placeholder={placeholders.region}
        value={values.region}
        values={values}
        context={context}
        onChange={value => handleFieldChange('region', value)}
        onResolved={handleResolved}
        autoComplete={AUTO_COMPLETE_TOKENS.region}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <GeoAddressInputField
          id={`${idPrefix}-city`}
          field="city"
          label={labels.city}
          placeholder={placeholders.city}
          value={values.city}
          values={values}
          context={context}
          onChange={value => handleFieldChange('city', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.city}
        />
        <GeoAddressInputField
          id={`${idPrefix}-post-code`}
          field="post_code"
          label={labels.post_code}
          placeholder={placeholders.post_code}
          value={values.post_code}
          values={values}
          context={context}
          onChange={value => handleFieldChange('post_code', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.post_code}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <GeoAddressInputField
          id={`${idPrefix}-street`}
          field="street"
          label={labels.street}
          placeholder={placeholders.street}
          value={values.street}
          values={values}
          context={context}
          onChange={value => handleFieldChange('street', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.street}
        />
        <GeoAddressInputField
          id={`${idPrefix}-house-number`}
          field="house_number"
          label={labels.house_number}
          placeholder={placeholders.house_number}
          value={values.house_number}
          values={values}
          context={context}
          onChange={value => handleFieldChange('house_number', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.house_number}
        />
      </div>
    </>
  );
}

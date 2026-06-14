import { useCallback, useEffect, useState } from 'react';
import {
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
export function useGeoAddressFieldsController({
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
  return {
    idPrefix,
    values,
    onFieldChange,
    labels,
    placeholders,
    onResolvedAddress,
    resetContextKey,
    context,
    setContext,
    resolvedAddresses,
    setResolvedAddresses,
    handleResolved,
    handleFieldChange,
  };
}

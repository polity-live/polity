import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { type GeoAddressTextMap } from '@/features/shared/ui/form/GeoAddressFields';
import type {
  GeoAddressField,
  GeoAddressValues,
  GeoResolvedAddress,
} from '@/features/shared/ui/form/GeoAddressInputField';
import {
  geoCoordinatesEqual,
  toGeoCoordinates,
  type GeoCoordinates,
} from '@/features/shared/logic/geoCoordinates';
import { geoapifyReverseFn } from '@/server/geoapify-reverse';

interface GeoAddressPickerProps {
  idPrefix: string;
  values: GeoAddressValues;
  onFieldChange: (field: GeoAddressField, value: string) => void;
  labels: GeoAddressTextMap;
  placeholders: GeoAddressTextMap;
  coordinates: GeoCoordinates | null;
  onCoordinatesChange: (coordinates: GeoCoordinates | null) => void;
}

const REVERSE_FIELD_ORDER: GeoAddressField[] = [
  'country',
  'region',
  'city',
  'post_code',
  'street',
  'house_number',
];

function isGeoAddressValuesEmpty(values: GeoAddressValues): boolean {
  return REVERSE_FIELD_ORDER.every(field => !values[field].trim());
}

function mapResolvedAddressToValues(result: GeoResolvedAddress): GeoAddressValues {
  return {
    country: result.country ?? '',
    region: result.state ?? '',
    city: result.city ?? '',
    post_code: result.postcode ?? '',
    street: result.street ?? '',
    house_number: result.housenumber ?? '',
  };
}
export function useGeoAddressPickerController({
  idPrefix,
  values,
  onFieldChange,
  labels,
  placeholders,
  coordinates,
  onCoordinatesChange,
}: GeoAddressPickerProps) {
  const { t, language } = useTranslation();
  const [resetContextKey, setResetContextKey] = useState(0);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const reverseRequestIdRef = useRef(0);
  const isApplyingReverseSyncRef = useRef(false);
  const ignoreForwardResolutionRef = useRef(false);

  useEffect(() => {
    if (coordinates && isGeoAddressValuesEmpty(values)) {
      onCoordinatesChange(null);
    }
  }, [
    coordinates,
    onCoordinatesChange,
    values.city,
    values.country,
    values.house_number,
    values.post_code,
    values.region,
    values.street,
  ]);

  const handleResolvedAddress = useCallback(
    (result: GeoResolvedAddress | null) => {
      if (ignoreForwardResolutionRef.current) {
        return;
      }

      const nextCoordinates = toGeoCoordinates(result);

      if (!nextCoordinates || geoCoordinatesEqual(nextCoordinates, coordinates)) {
        return;
      }

      onCoordinatesChange(nextCoordinates);
    },
    [coordinates, onCoordinatesChange]
  );

  const handleFieldChange = useCallback(
    (field: GeoAddressField, value: string) => {
      if (!isApplyingReverseSyncRef.current) {
        ignoreForwardResolutionRef.current = false;
      }

      onFieldChange(field, value);
    },
    [onFieldChange]
  );

  const handleMapCoordinatesChange = useCallback(
    async (nextCoordinates: GeoCoordinates) => {
      if (!geoCoordinatesEqual(coordinates, nextCoordinates)) {
        onCoordinatesChange(nextCoordinates);
      }

      const requestId = ++reverseRequestIdRef.current;
      setIsReverseGeocoding(true);

      try {
        const { result } = await geoapifyReverseFn({
          data: {
            latitude: nextCoordinates.latitude,
            longitude: nextCoordinates.longitude,
            language,
          },
        });

        if (reverseRequestIdRef.current !== requestId || !result) {
          return;
        }

        const nextValues = mapResolvedAddressToValues(result);
        const normalizedCoordinates = toGeoCoordinates(result);

        isApplyingReverseSyncRef.current = true;
        ignoreForwardResolutionRef.current = true;

        for (const field of REVERSE_FIELD_ORDER) {
          if (values[field] !== nextValues[field]) {
            onFieldChange(field, nextValues[field]);
          }
        }

        if (normalizedCoordinates && !geoCoordinatesEqual(normalizedCoordinates, nextCoordinates)) {
          onCoordinatesChange(normalizedCoordinates);
        }

        setResetContextKey(previousValue => previousValue + 1);
      } catch {
        ignoreForwardResolutionRef.current = false;
      } finally {
        if (reverseRequestIdRef.current === requestId) {
          setIsReverseGeocoding(false);
        }

        isApplyingReverseSyncRef.current = false;
      }
    },
    [
      coordinates,
      language,
      onCoordinatesChange,
      onFieldChange,
      values.city,
      values.country,
      values.house_number,
      values.post_code,
      values.region,
      values.street,
    ]
  );
  return {
    idPrefix,
    values,
    onFieldChange,
    labels,
    placeholders,
    coordinates,
    onCoordinatesChange,
    t,
    language,
    resetContextKey,
    setResetContextKey,
    isReverseGeocoding,
    setIsReverseGeocoding,
    reverseRequestIdRef,
    isApplyingReverseSyncRef,
    ignoreForwardResolutionRef,
    handleResolvedAddress,
    handleFieldChange,
    handleMapCoordinatesChange,
  };
}

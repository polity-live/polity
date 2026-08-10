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
import type { GeoLocationShape } from '@/features/shared/logic/geoLocationShape';
import { geoapifyBoundaryFn } from '@/server/geoapify-boundary';
import { geoapifyReverseFn } from '@/server/geoapify-reverse';

interface GeoAddressPickerProps {
  idPrefix: string;
  values: GeoAddressValues;
  onFieldChange: (field: GeoAddressField, value: string) => void;
  labels: GeoAddressTextMap;
  placeholders: GeoAddressTextMap;
  coordinates: GeoCoordinates | null;
  onCoordinatesChange: (coordinates: GeoCoordinates | null) => void;
  shape?: GeoLocationShape | null;
  onShapeChange?: (shape: GeoLocationShape | null) => void;
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

function isBoundaryField(
  field: GeoAddressField | null
): field is 'country' | 'region' | 'city' | 'post_code' {
  return field === 'country' || field === 'region' || field === 'city' || field === 'post_code';
}

function pointShape(placeId?: string | null): GeoLocationShape {
  return {
    kind: 'point',
    placeId: placeId ?? null,
    boundarySource: null,
    geometry: null,
    bounds: null,
  };
}

function unresolvedBoundaryShape(
  field: 'country' | 'region' | 'city' | 'post_code',
  placeId: string
): GeoLocationShape {
  const boundaries = field === 'post_code' ? 'postal_code' : 'administrative';

  return {
    kind: field === 'post_code' ? 'postcode' : field,
    placeId,
    boundarySource: `geoapify:${boundaries}`,
    geometry: null,
    bounds: null,
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
  shape = null,
  onShapeChange,
}: GeoAddressPickerProps) {
  const { t, language } = useTranslation();
  const [resetContextKey, setResetContextKey] = useState(0);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isBoundaryLoading, setIsBoundaryLoading] = useState(false);
  const reverseRequestIdRef = useRef(0);
  const boundaryRequestIdRef = useRef(0);
  const isApplyingReverseSyncRef = useRef(false);
  const ignoreForwardResolutionRef = useRef(false);

  useEffect(() => {
    if (coordinates && isGeoAddressValuesEmpty(values)) {
      onCoordinatesChange(null);
      onShapeChange?.(null);
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
    onShapeChange,
  ]);

  const handleResolvedAddress = useCallback(
    async (result: GeoResolvedAddress | null, field: GeoAddressField | null) => {
      if (ignoreForwardResolutionRef.current) {
        return;
      }

      const nextCoordinates = toGeoCoordinates(result);

      if (!result || !nextCoordinates || !field) {
        boundaryRequestIdRef.current += 1;
        onShapeChange?.(null);
        return;
      }

      if (!geoCoordinatesEqual(nextCoordinates, coordinates)) {
        onCoordinatesChange(nextCoordinates);
      }

      const requestId = ++boundaryRequestIdRef.current;

      if (!isBoundaryField(field)) {
        onShapeChange?.(pointShape(result.place_id));
        return;
      }

      setIsBoundaryLoading(true);

      try {
        const data = (await geoapifyBoundaryFn({
          data: {
            field,
            placeId: result.place_id,
            latitude: nextCoordinates.latitude,
            longitude: nextCoordinates.longitude,
            values,
            resolvedAddress: result,
            language,
          },
        })) as { shape?: GeoLocationShape | null };

        if (boundaryRequestIdRef.current === requestId) {
          onShapeChange?.(data.shape ?? unresolvedBoundaryShape(field, result.place_id));
        }
      } catch {
        if (boundaryRequestIdRef.current === requestId) {
          onShapeChange?.(unresolvedBoundaryShape(field, result.place_id));
        }
      } finally {
        if (boundaryRequestIdRef.current === requestId) {
          setIsBoundaryLoading(false);
        }
      }
    },
    [
      coordinates,
      language,
      onCoordinatesChange,
      onShapeChange,
      values.city,
      values.country,
      values.house_number,
      values.post_code,
      values.region,
      values.street,
    ]
  );

  const handleFieldChange = useCallback(
    (field: GeoAddressField, value: string) => {
      if (!isApplyingReverseSyncRef.current) {
        ignoreForwardResolutionRef.current = false;
        onShapeChange?.(null);
      }

      onFieldChange(field, value);
    },
    [onFieldChange, onShapeChange]
  );

  const handleMapCoordinatesChange = useCallback(
    async (nextCoordinates: GeoCoordinates) => {
      if (!geoCoordinatesEqual(coordinates, nextCoordinates)) {
        onCoordinatesChange(nextCoordinates);
      }

      const requestId = ++reverseRequestIdRef.current;
      boundaryRequestIdRef.current += 1;
      onShapeChange?.(pointShape());
      setIsReverseGeocoding(true);
      setIsBoundaryLoading(false);

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
        onShapeChange?.(pointShape(result.place_id));

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
      onShapeChange,
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
    isBoundaryLoading,
    setIsBoundaryLoading,
    reverseRequestIdRef,
    boundaryRequestIdRef,
    isApplyingReverseSyncRef,
    ignoreForwardResolutionRef,
    shape,
    handleResolvedAddress,
    handleFieldChange,
    handleMapCoordinatesChange,
  };
}

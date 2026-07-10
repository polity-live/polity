/**
 * Location Info Section Component
 *
 * Form section for editing group location information.
 */

import { useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import {
  geoLocationFieldsFromShape,
  geoLocationShapeFromFields,
} from '@/features/shared/logic/geoLocationShape';
import type { GroupFormData } from '../hooks/useGroupUpdate';

interface LocationInfoSectionProps {
  formData: GroupFormData;
  onChange: <K extends keyof GroupFormData>(field: K, value: GroupFormData[K]) => void;
}

const GEO_ADDRESS_LABELS = {
  country: 'Country',
  region: 'Region',
  city: 'City',
  post_code: 'Post code',
  street: 'Street',
  house_number: 'House number',
};

export function LocationInfoSection({ formData, onChange }: LocationInfoSectionProps) {
  const { t } = useTranslation();
  const values = useMemo(
    () => ({
      country: formData.country,
      region: formData.region,
      city: formData.city,
      post_code: formData.post_code,
      street: formData.street,
      house_number: formData.house_number,
    }),
    [
      formData.city,
      formData.country,
      formData.house_number,
      formData.post_code,
      formData.region,
      formData.street,
    ]
  );
  const coordinates = useMemo(
    () =>
      formData.latitude !== null && formData.longitude !== null
        ? { latitude: formData.latitude, longitude: formData.longitude }
        : null,
    [formData.latitude, formData.longitude]
  );
  const shape = useMemo(
    () => geoLocationShapeFromFields(formData),
    [
      formData.location_boundary_source,
      formData.location_bounds,
      formData.location_geometry,
      formData.location_kind,
      formData.location_place_id,
    ]
  );
  const placeholders = useMemo(
    () => ({
      country: t('features.groups.location.countryPlaceholder'),
      region: t('features.groups.location.regionPlaceholder'),
      city: t('features.groups.location.cityPlaceholder'),
      post_code: t('features.groups.location.postCodePlaceholder'),
      street: t('features.groups.location.streetPlaceholder'),
      house_number: t('features.groups.location.houseNumberPlaceholder'),
    }),
    [t]
  );
  const handleCoordinatesChange = useCallback(
    (nextCoordinates: typeof coordinates) => {
      onChange('latitude', nextCoordinates?.latitude ?? null);
      onChange('longitude', nextCoordinates?.longitude ?? null);
    },
    [onChange]
  );
  const handleShapeChange = useCallback(
    (nextShape: typeof shape) => {
      const fields = geoLocationFieldsFromShape(nextShape);
      onChange('location_kind', fields.location_kind);
      onChange('location_place_id', fields.location_place_id);
      onChange('location_boundary_source', fields.location_boundary_source);
      onChange('location_geometry', fields.location_geometry);
      onChange('location_bounds', fields.location_bounds);
    },
    [onChange]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('features.groups.location.title')}</CardTitle>
        <CardDescription>{t('features.groups.location.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GeoAddressPicker
          idPrefix="group-location"
          values={values}
          coordinates={coordinates}
          onCoordinatesChange={handleCoordinatesChange}
          shape={shape}
          onShapeChange={handleShapeChange}
          onFieldChange={onChange}
          labels={GEO_ADDRESS_LABELS}
          placeholders={placeholders}
        />
      </CardContent>
    </Card>
  );
}

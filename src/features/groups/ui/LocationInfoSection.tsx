/**
 * Location Info Section Component
 *
 * Form section for editing group location information.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import type { GroupFormData } from '../hooks/useGroupUpdate';

interface LocationInfoSectionProps {
  formData: GroupFormData;
  onChange: <K extends keyof GroupFormData>(field: K, value: GroupFormData[K]) => void;
}

export function LocationInfoSection({ formData, onChange }: LocationInfoSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('features.groups.location.title')}</CardTitle>
        <CardDescription>{t('features.groups.location.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GeoAddressPicker
          idPrefix="group-location"
          values={{
            country: formData.country,
            region: formData.region,
            city: formData.city,
            post_code: formData.post_code,
            street: formData.street,
            house_number: formData.house_number,
          }}
          coordinates={
            formData.latitude !== null && formData.longitude !== null
              ? { latitude: formData.latitude, longitude: formData.longitude }
              : null
          }
          onCoordinatesChange={coordinates => {
            onChange('latitude', coordinates?.latitude ?? null);
            onChange('longitude', coordinates?.longitude ?? null);
          }}
          onFieldChange={onChange}
          labels={{
            country: 'Country',
            region: 'Region',
            city: 'City',
            post_code: 'Post code',
            street: 'Street',
            house_number: 'House number',
          }}
          placeholders={{
            country: t('features.groups.location.countryPlaceholder'),
            region: t('features.groups.location.regionPlaceholder'),
            city: t('features.groups.location.cityPlaceholder'),
            post_code: t('features.groups.location.postCodePlaceholder'),
            street: t('features.groups.location.streetPlaceholder'),
            house_number: t('features.groups.location.houseNumberPlaceholder'),
          }}
        />
      </CardContent>
    </Card>
  );
}

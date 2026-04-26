import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import type { GeoCoordinates } from '@/features/shared/logic/geoCoordinates';

interface LocationInformationSectionProps {
  country: string;
  region: string;
  post_code: string;
  city: string;
  street: string;
  house_number: string;
  latitude: number | null;
  longitude: number | null;
  onCountryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onPostCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onStreetChange: (value: string) => void;
  onHouseNumberChange: (value: string) => void;
  onCoordinatesChange: (coordinates: GeoCoordinates | null) => void;
}

export function LocationInformationSection({
  country,
  region,
  post_code,
  city,
  street,
  house_number,
  latitude,
  longitude,
  onCountryChange,
  onRegionChange,
  onPostCodeChange,
  onCityChange,
  onStreetChange,
  onHouseNumberChange,
  onCoordinatesChange,
}: LocationInformationSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.user.settingsForm.location.title')}</CardTitle>
        <CardDescription>{t('pages.user.settingsForm.location.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GeoAddressPicker
          idPrefix="user-location"
          values={{
            country,
            region,
            city,
            post_code,
            street,
            house_number,
          }}
          coordinates={latitude !== null && longitude !== null ? { latitude, longitude } : null}
          onCoordinatesChange={onCoordinatesChange}
          onFieldChange={(field, value) => {
            switch (field) {
              case 'country':
                onCountryChange(value);
                break;
              case 'region':
                onRegionChange(value);
                break;
              case 'city':
                onCityChange(value);
                break;
              case 'post_code':
                onPostCodeChange(value);
                break;
              case 'street':
                onStreetChange(value);
                break;
              case 'house_number':
                onHouseNumberChange(value);
                break;
            }
          }}
          labels={{
            country: t('pages.user.settingsForm.location.countryLabel'),
            region: t('pages.user.settingsForm.location.regionLabel'),
            city: t('pages.user.settingsForm.location.cityLabel'),
            post_code: t('pages.user.settingsForm.location.postCodeLabel'),
            street: t('pages.user.settingsForm.location.streetLabel'),
            house_number: t('pages.user.settingsForm.location.houseNumberLabel'),
          }}
          placeholders={{
            country: t('pages.user.settingsForm.location.countryPlaceholder'),
            region: t('pages.user.settingsForm.location.regionPlaceholder'),
            city: t('pages.user.settingsForm.location.cityPlaceholder'),
            post_code: t('pages.user.settingsForm.location.postCodePlaceholder'),
            street: t('pages.user.settingsForm.location.streetPlaceholder'),
            house_number: t('pages.user.settingsForm.location.houseNumberPlaceholder'),
          }}
        />
      </CardContent>
    </Card>
  );
}

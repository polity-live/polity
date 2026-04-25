import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface LocationInformationSectionProps {
  country: string;
  region: string;
  post_code: string;
  city: string;
  street: string;
  house_number: string;
  onCountryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onPostCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onStreetChange: (value: string) => void;
  onHouseNumberChange: (value: string) => void;
}

export function LocationInformationSection({
  country,
  region,
  post_code,
  city,
  street,
  house_number,
  onCountryChange,
  onRegionChange,
  onPostCodeChange,
  onCityChange,
  onStreetChange,
  onHouseNumberChange,
}: LocationInformationSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.user.settingsForm.location.title')}</CardTitle>
        <CardDescription>{t('pages.user.settingsForm.location.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="country">{t('pages.user.settingsForm.location.countryLabel')}</Label>
          <Input
            id="country"
            value={country}
            onChange={e => onCountryChange(e.target.value)}
            placeholder={t('pages.user.settingsForm.location.countryPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">{t('pages.user.settingsForm.location.regionLabel')}</Label>
          <Input
            id="region"
            value={region}
            onChange={e => onRegionChange(e.target.value)}
            placeholder={t('pages.user.settingsForm.location.regionPlaceholder')}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="post_code">{t('pages.user.settingsForm.location.postCodeLabel')}</Label>
            <Input
              id="post_code"
              value={post_code}
              onChange={e => onPostCodeChange(e.target.value)}
              placeholder={t('pages.user.settingsForm.location.postCodePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">{t('pages.user.settingsForm.location.cityLabel')}</Label>
            <Input
              id="city"
              value={city}
              onChange={e => onCityChange(e.target.value)}
              placeholder={t('pages.user.settingsForm.location.cityPlaceholder')}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="street">{t('pages.user.settingsForm.location.streetLabel')}</Label>
            <Input
              id="street"
              value={street}
              onChange={e => onStreetChange(e.target.value)}
              placeholder={t('pages.user.settingsForm.location.streetPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="house_number">
              {t('pages.user.settingsForm.location.houseNumberLabel')}
            </Label>
            <Input
              id="house_number"
              value={house_number}
              onChange={e => onHouseNumberChange(e.target.value)}
              placeholder={t('pages.user.settingsForm.location.houseNumberPlaceholder')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

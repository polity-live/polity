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
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { GroupFormData } from '../hooks/useGroupUpdate';

interface LocationInfoSectionProps {
  formData: GroupFormData;
  onChange: (field: keyof GroupFormData, value: string) => void;
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
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={e => onChange('country', e.target.value)}
            placeholder={t('features.groups.location.countryPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            value={formData.region}
            onChange={e => onChange('region', e.target.value)}
            placeholder={t('features.groups.location.regionPlaceholder')}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="post_code">Post code</Label>
            <Input
              id="post_code"
              value={formData.post_code}
              onChange={e => onChange('post_code', e.target.value)}
              placeholder={t('features.groups.location.postCodePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={e => onChange('city', e.target.value)}
              placeholder={t('features.groups.location.cityPlaceholder')}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="street">Street</Label>
            <Input
              id="street"
              value={formData.street}
              onChange={e => onChange('street', e.target.value)}
              placeholder={t('features.groups.location.streetPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="house_number">House number</Label>
            <Input
              id="house_number"
              value={formData.house_number}
              onChange={e => onChange('house_number', e.target.value)}
              placeholder={t('features.groups.location.houseNumberPlaceholder')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

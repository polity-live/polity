import { FormControlLabel, FormControlInput } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Video, Building2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

type LocationType = '' | 'online' | 'physical';

interface LocationData {
  locationType: LocationType;
  // Online fields
  onlineMeetingLink: string;
  meetingCode: string;
  // Physical fields
  locationName: string;
  country: string;
  region: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
}

interface LocationTypeInputProps {
  value: LocationData;
  onChange: (data: LocationData) => void;
}

export function LocationTypeInput({ value, onChange }: LocationTypeInputProps) {
  const { t } = useTranslation();

  const update = (patch: Partial<LocationData>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <FormControlLabel>{t('pages.create.event.location')}</FormControlLabel>

      {/* Location type toggle */}
      <div className="flex gap-2">
        <Button
          data-action-id="create.location-type.select.online"
          type="button"
          variant={value.locationType === 'online' ? 'default' : 'outline'}
          className="flex-1 gap-2"
          onClick={() => update({ locationType: 'online' })}
        >
          <Video className="h-4 w-4" />
          {t('pages.create.event.locationTypes.online')}
        </Button>
        <Button
          data-action-id="create.location-type.select.physical"
          type="button"
          variant={value.locationType === 'physical' ? 'default' : 'outline'}
          className="flex-1 gap-2"
          onClick={() => update({ locationType: 'physical' })}
        >
          <Building2 className="h-4 w-4" />
          {t('pages.create.event.locationTypes.physical')}
        </Button>
      </div>

      {/* Online fields */}
      {value.locationType === 'online' && (
        <div className="space-y-3">
          <div>
            <FormControlLabel>{t('pages.create.event.meetingLink')}</FormControlLabel>
            <FormControlInput
              type="url"
              placeholder={t('pages.create.event.meetingLinkPlaceholder')}
              value={value.onlineMeetingLink}
              onChange={e => update({ onlineMeetingLink: e.target.value })}
            />
          </div>
          <div>
            <FormControlLabel>{t('pages.create.event.accessCodeOptional')}</FormControlLabel>
            <FormControlInput
              placeholder="123-456-789"
              value={value.meetingCode}
              onChange={e => update({ meetingCode: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Physical fields */}
      {value.locationType === 'physical' && (
        <div className="space-y-3">
          <div>
            <FormControlLabel>{t('pages.create.event.venueName')}</FormControlLabel>
            <FormControlInput
              placeholder={t('pages.create.event.venueNamePlaceholder')}
              value={value.locationName}
              onChange={e => update({ locationName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FormControlLabel>{t('pages.create.event.country')}</FormControlLabel>
              <FormControlInput
                value={value.country}
                onChange={e => update({ country: e.target.value })}
              />
            </div>
            <div>
              <FormControlLabel>{t('pages.create.event.region')}</FormControlLabel>
              <FormControlInput
                value={value.region}
                onChange={e => update({ region: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <FormControlLabel>{t('pages.create.event.street')}</FormControlLabel>
              <FormControlInput
                value={value.street}
                onChange={e => update({ street: e.target.value })}
              />
            </div>
            <div>
              <FormControlLabel>{t('pages.create.event.houseNumber')}</FormControlLabel>
              <FormControlInput
                value={value.houseNumber}
                onChange={e => update({ houseNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FormControlLabel>{t('pages.create.event.postalCode')}</FormControlLabel>
              <FormControlInput
                value={value.postalCode}
                onChange={e => update({ postalCode: e.target.value })}
              />
            </div>
            <div>
              <FormControlLabel>{t('pages.create.event.city')}</FormControlLabel>
              <FormControlInput
                value={value.city}
                onChange={e => update({ city: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

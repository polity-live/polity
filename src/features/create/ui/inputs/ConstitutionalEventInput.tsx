import { FormControlLabel, FormControlInput, FormControlSwitch } from '@/features/shared/ui/form';
import { Card } from '@/features/shared/ui/ui/card';
import { Calendar } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export interface ConstitutionalEventData {
  enabled: boolean;
  eventName: string;
  eventLocation: string;
  eventStartDate: string;
  eventStartTime: string;
}

interface ConstitutionalEventInputProps {
  value: ConstitutionalEventData;
  onChange: (data: ConstitutionalEventData) => void;
}

export function ConstitutionalEventInput({ value, onChange }: ConstitutionalEventInputProps) {
  const { t } = useTranslation();

  const update = (patch: Partial<ConstitutionalEventData>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormControlLabel htmlFor="create-event" className="cursor-pointer">
          {t('pages.create.group.createConstitutionalEvent')}
        </FormControlLabel>
        <FormControlSwitch
          id="create-event"
          checked={value.enabled}
          onCheckedChange={checked => update({ enabled: checked })}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        {t('pages.create.group.optionalGeneralAssembly')}
      </p>

      {value.enabled && (
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <FormControlLabel>{t('pages.create.group.eventName')}</FormControlLabel>
            <FormControlInput
              placeholder={t('pages.create.group.eventNamePlaceholder')}
              value={value.eventName}
              onChange={e => update({ eventName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <FormControlLabel>{t('pages.create.group.eventLocation')}</FormControlLabel>
            <FormControlInput
              placeholder={t('pages.create.group.eventLocationPlaceholder')}
              value={value.eventLocation}
              onChange={e => update({ eventLocation: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FormControlLabel>{t('pages.create.group.eventStartDate')}</FormControlLabel>
              <FormControlInput
                type="date"
                value={value.eventStartDate}
                onChange={e => update({ eventStartDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <FormControlLabel>{t('pages.create.group.eventStartTime')}</FormControlLabel>
              <FormControlInput
                type="time"
                value={value.eventStartTime}
                onChange={e => update({ eventStartTime: e.target.value })}
              />
            </div>
          </div>

          <Card surface="muted" className="p-3">
            <div className="flex items-start gap-2">
              <Calendar className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="text-muted-foreground flex-1 text-sm">
                <p className="mb-1 font-medium">
                  {t('pages.create.group.eventTypeGeneralAssembly')}
                </p>
                <p>{t('pages.create.group.eventTypeDescription')}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

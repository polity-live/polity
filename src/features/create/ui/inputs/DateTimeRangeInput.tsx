import { Label } from '@/features/shared/ui/ui/label';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CreateInputField } from '../CreateFields';

interface DateTimeRangeInputProps {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  onChange: (field: 'startDate' | 'startTime' | 'endDate' | 'endTime', value: string) => void;
}

export function DateTimeRangeInput({
  startDate,
  startTime,
  endDate,
  endTime,
  onChange,
}: DateTimeRangeInputProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Label>{t('pages.create.event.dateTime')}</Label>
      <div className="grid grid-cols-2 gap-3">
        <CreateInputField
          label={t('pages.create.event.startDate')}
          type="date"
          value={startDate}
          onValueChange={value => onChange('startDate', value)}
        />
        <CreateInputField
          label={t('pages.create.event.startTime')}
          type="time"
          value={startTime}
          onValueChange={value => onChange('startTime', value)}
        />
        <CreateInputField
          label={t('pages.create.event.endDate')}
          type="date"
          value={endDate}
          onValueChange={value => onChange('endDate', value)}
        />
        <CreateInputField
          label={t('pages.create.event.endTime')}
          type="time"
          value={endTime}
          onValueChange={value => onChange('endTime', value)}
        />
      </div>
    </div>
  );
}

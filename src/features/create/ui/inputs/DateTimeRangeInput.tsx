import { Calendar } from '@/features/shared/ui/ui/calendar';
import { Button } from '@/features/shared/ui/ui/button';
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

function parseInputDate(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function formatInputDate(value: Date | undefined): string {
  if (!value) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateTimeRangeInput({
  startDate,
  startTime,
  endDate,
  endTime,
  onChange,
}: DateTimeRangeInputProps) {
  const { t } = useTranslation();
  const selectedStartDate = parseInputDate(startDate);
  const selectedEndDate = parseInputDate(endDate);

  return (
    <div className="space-y-4">
      <Label>{t('pages.create.event.dateTime')}</Label>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t('pages.create.event.startDate')}</Label>
              {selectedStartDate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange('startDate', '')}
                >
                  {t('common.clear', 'Clear')}
                </Button>
              ) : null}
            </div>
            <Calendar
              mode="single"
              selected={selectedStartDate}
              onSelect={value => onChange('startDate', formatInputDate(value))}
              className="rounded-md border"
            />
          </div>
          <CreateInputField
            label={t('pages.create.event.startTime')}
            type="time"
            value={startTime}
            onValueChange={value => onChange('startTime', value)}
          />
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t('pages.create.event.endDate')}</Label>
              {selectedEndDate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange('endDate', '')}
                >
                  {t('common.clear', 'Clear')}
                </Button>
              ) : null}
            </div>
            <Calendar
              mode="single"
              selected={selectedEndDate}
              onSelect={value => onChange('endDate', formatInputDate(value))}
              className="rounded-md border"
              disabled={date =>
                selectedStartDate ? date.getTime() < selectedStartDate.getTime() : false
              }
            />
          </div>
          <CreateInputField
            label={t('pages.create.event.endTime')}
            type="time"
            value={endTime}
            onValueChange={value => onChange('endTime', value)}
          />
        </div>
      </div>
    </div>
  );
}

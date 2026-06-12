import { Calendar } from '@/features/shared/ui/ui/calendar';
import { Button } from '@/features/shared/ui/ui/button';
import { Label } from '@/features/shared/ui/ui/label';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatLocalDateInput, parseLocalDateInput } from '@/features/shared/logic/localDateTime';
import { CreateInputField } from '../CreateFields';

interface DateTimeRangeInputProps {
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  onChange: (field: 'startDate' | 'startTime' | 'endDate' | 'endTime', value: string) => void;
  showEnd?: boolean;
  minDate?: string;
  maxDate?: string;
}

export function DateTimeRangeInput({
  startDate,
  startTime,
  endDate = '',
  endTime = '',
  onChange,
  showEnd = true,
  minDate = '',
  maxDate = '',
}: DateTimeRangeInputProps) {
  const { t } = useTranslation();
  const selectedStartDate = parseLocalDateInput(startDate);
  const selectedEndDate = showEnd ? parseLocalDateInput(endDate) : undefined;
  const minSelectableDate = parseLocalDateInput(minDate);
  const maxSelectableDate = parseLocalDateInput(maxDate);

  const isOutsideSchedulingWindow = (date: Date) => {
    if (minSelectableDate && date.getTime() < minSelectableDate.getTime()) {
      return true;
    }
    if (maxSelectableDate && date.getTime() > maxSelectableDate.getTime()) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Label>{t('pages.create.event.dateTime')}</Label>
        <p className="text-muted-foreground text-sm">{t('pages.create.event.tips.dateTime')}</p>
      </div>
      <div className={showEnd ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
        <div className="border-border/70 bg-background/70 space-y-3 rounded-xl border p-4">
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
              onSelect={value => onChange('startDate', formatLocalDateInput(value))}
              className="rounded-lg border"
              disabled={date => isOutsideSchedulingWindow(date)}
            />
          </div>
          <CreateInputField
            label={t('pages.create.event.startTime')}
            hint={t('common.validation.timeHint')}
            type="time"
            value={startTime}
            onValueChange={value => onChange('startTime', value)}
          />
        </div>
        {showEnd ? (
          <div className="border-border/70 bg-background/70 space-y-3 rounded-xl border p-4">
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
                onSelect={value => onChange('endDate', formatLocalDateInput(value))}
                className="rounded-lg border"
                disabled={date =>
                  isOutsideSchedulingWindow(date) ||
                  (selectedStartDate ? date.getTime() < selectedStartDate.getTime() : false)
                }
              />
            </div>
            <CreateInputField
              label={t('pages.create.event.endTime')}
              hint={t('common.validation.timeHint')}
              type="time"
              value={endTime}
              onValueChange={value => onChange('endTime', value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

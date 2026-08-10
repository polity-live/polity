import {
  FormControlInput,
  FormControlLabel,
  ChoiceCardField,
  SegmentedChoiceField,
} from '@/features/shared/ui/form';
import { Calendar } from '@/features/shared/ui/ui/calendar';
import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatLocalDateInput, parseLocalDateInput } from '@/features/shared/logic/localDateTime';

interface RecurringPatternInputProps {
  value: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'four-yearly';
  onChange: (pattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'four-yearly') => void;
  endDate?: string;
  onEndDateChange?: (date: string) => void;
  interval?: number;
  onIntervalChange?: (interval: number) => void;
  /** Selected weekdays when pattern is 'weekly'. 0=Mon..6=Sun */
  weekdays?: number[];
  onWeekdaysChange?: (weekdays: number[]) => void;
  allowedPatterns?: ('none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'four-yearly')[];
}

const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

export function RecurringPatternInput({
  value,
  onChange,
  endDate,
  onEndDateChange,
  interval = 1,
  onIntervalChange,
  weekdays = [],
  onWeekdaysChange,
  allowedPatterns,
}: RecurringPatternInputProps) {
  const { t } = useTranslation();
  const selectedEndDate = parseLocalDateInput(endDate);

  const dayLabels = [
    t('common.days.mondayShort'),
    t('common.days.tuesdayShort'),
    t('common.days.wednesdayShort'),
    t('common.days.thursdayShort'),
    t('common.days.fridayShort'),
    t('common.days.saturdayShort'),
    t('common.days.sundayShort'),
  ];

  const allOptions = [
    {
      value: 'none' as const,
      label: t('pages.create.event.recurringPatterns.none'),
      description: t('pages.create.event.recurringPatterns.noneDesc'),
    },
    {
      value: 'daily' as const,
      label: t('pages.create.event.recurringPatterns.daily'),
      description: t('pages.create.event.recurringPatterns.dailyDesc'),
    },
    {
      value: 'weekly' as const,
      label: t('pages.create.event.recurringPatterns.weekly'),
      description: t('pages.create.event.recurringPatterns.weeklyDesc'),
    },
    {
      value: 'monthly' as const,
      label: t('pages.create.event.recurringPatterns.monthly'),
      description: t('pages.create.event.recurringPatterns.monthlyDesc'),
    },
    {
      value: 'yearly' as const,
      label: t('pages.create.event.recurringPatterns.yearly'),
      description: t('pages.create.event.recurringPatterns.yearlyDesc'),
    },
    {
      value: 'four-yearly' as const,
      label: t('pages.create.event.recurringPatterns.fourYearly'),
      description: t('pages.create.event.recurringPatterns.fourYearlyDesc'),
    },
  ];
  const options = allOptions.filter(
    (option): option is (typeof allOptions)[number] =>
      !allowedPatterns || allowedPatterns.includes(option.value)
  );

  const toggleWeekday = (day: number) => {
    const next = weekdays.includes(day)
      ? weekdays.filter(d => d !== day)
      : [...weekdays, day].sort((left, right) => left - right);
    onWeekdaysChange?.(next);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <FormControlLabel>{t('pages.create.event.recurring')}</FormControlLabel>
        <p className="text-muted-foreground text-sm">{t('pages.create.event.tips.recurring')}</p>
      </div>
      <ChoiceCardField
        id="recurring"
        grid="three"
        value={value}
        onValueChange={nextValue =>
          onChange(nextValue as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'four-yearly')
        }
        options={options.map(option => ({
          value: option.value,
          label: option.label,
          description: option.description,
        }))}
      />

      {value !== 'none' && (
        <div className="border-border/70 bg-background/70 space-y-4 rounded-xl border p-4">
          {onIntervalChange && (
            <div className="space-y-2">
              <FormControlLabel>{t('pages.create.event.recurringInterval')}</FormControlLabel>
              <FormControlInput
                type="number"
                min={1}
                max={99}
                value={interval}
                onChange={event =>
                  onIntervalChange(Math.max(1, parseInt(event.target.value, 10) || 1))
                }
                className="w-24"
              />
            </div>
          )}

          {value === 'weekly' && onWeekdaysChange && (
            <SegmentedChoiceField
              label={t('pages.create.event.recurringWeekdays')}
              value=""
              columns="auto"
              size="icon"
              isOptionSelected={option => weekdays.includes(Number(option.value))}
              onValueChange={day => toggleWeekday(Number(day))}
              options={WEEKDAY_INDICES.map(day => ({
                value: String(day),
                label: dayLabels[day],
                tone: 'accent',
              }))}
            />
          )}

          {onEndDateChange && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <FormControlLabel>{t('pages.create.event.recurringEnds')}</FormControlLabel>
                {selectedEndDate ? (
                  <Button
                    data-action-id="create.recurring.end-date.clear"
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEndDateChange('')}
                  >
                    {t('common.clear')}
                  </Button>
                ) : null}
              </div>
              <Calendar
                mode="single"
                selected={selectedEndDate}
                onSelect={selectedValue => onEndDateChange(formatLocalDateInput(selectedValue))}
                className="rounded-lg border"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

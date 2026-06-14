import { Calendar } from '@/features/shared/ui/ui/calendar';
import { Button } from '@/features/shared/ui/ui/button';
import { Label } from '@/features/shared/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { Input } from '@/features/shared/ui/ui/input';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatLocalDateInput, parseLocalDateInput } from '@/features/shared/logic/localDateTime';
import { cn } from '@/features/shared/utils/utils';

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
    if (!onWeekdaysChange) return;
    const next = weekdays.includes(day)
      ? weekdays.filter(d => d !== day)
      : [...weekdays, day].sort((left, right) => left - right);
    onWeekdaysChange(next);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Label>{t('pages.create.event.recurring')}</Label>
        <p className="text-muted-foreground text-sm">{t('pages.create.event.tips.recurring')}</p>
      </div>
      <RadioGroup
        value={value}
        onValueChange={nextValue =>
          onChange(nextValue as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'four-yearly')
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {options.map(opt => (
            <Label
              key={opt.value}
              htmlFor={`recurring-${opt.value}`}
              className={`border-border/70 flex cursor-pointer flex-col rounded-xl border p-3 transition-colors ${
                value === opt.value ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`recurring-${opt.value}`} />
                <span className="text-sm font-medium">{opt.label}</span>
              </div>
              <span className="text-muted-foreground mt-1 text-xs">{opt.description}</span>
            </Label>
          ))}
        </div>
      </RadioGroup>

      {value !== 'none' && (
        <div className="border-border/70 bg-background/70 space-y-4 rounded-xl border p-4">
          {onIntervalChange && (
            <div className="space-y-2">
              <Label>{t('pages.create.event.recurringInterval')}</Label>
              <Input
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
            <div className="space-y-2">
              <Label>{t('pages.create.event.recurringWeekdays')}</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_INDICES.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-colors',
                      weekdays.includes(day)
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted border'
                    )}
                  >
                    {dayLabels[day]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onEndDateChange && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('pages.create.event.recurringEnds')}</Label>
                {selectedEndDate ? (
                  <Button
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

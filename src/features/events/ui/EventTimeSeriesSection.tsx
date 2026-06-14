import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlLabel } from '@/features/shared/ui/form';
import { AlarmClock, CalendarDays, Clock3, Repeat2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CreateInputField } from '@/features/shared/ui/form';
import { DateTimeRangeInput } from '@/features/create/ui/inputs/DateTimeRangeInput';
import { RecurringPatternInput } from '@/features/create/ui/inputs/RecurringPatternInput';
import type { RecurrencePattern } from '@/features/events/logic/rruleHelpers';
import { buildRRule, getRecurrenceDescription } from '@/features/events/logic/rruleHelpers';

interface EventTimeSeriesDeadlineField {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

interface EventTimeSeriesSectionProps {
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  onDateTimeChange: (
    field: 'startDate' | 'startTime' | 'endDate' | 'endTime',
    value: string
  ) => void;
  recurrencePattern: RecurrencePattern;
  onRecurrencePatternChange: (pattern: RecurrencePattern) => void;
  recurrenceEndDate: string;
  onRecurrenceEndDateChange: (date: string) => void;
  recurrenceInterval: number;
  onRecurrenceIntervalChange: (interval: number) => void;
  recurrenceWeekdays: number[];
  onRecurrenceWeekdaysChange: (weekdays: number[]) => void;
  deadlines?: EventTimeSeriesDeadlineField[];
  schedulingWindowMessage?: string | null;
  validationMessage?: string | null;
  minDate?: string;
  maxDate?: string;
}

function buildDateTimeLabel(date: string, time: string, fallback: string) {
  if (!date) {
    return fallback;
  }

  return `${date}${time ? ` · ${time}` : ''}`;
}

export function EventTimeSeriesSection({
  startDate,
  startTime,
  endDate = '',
  endTime = '',
  onDateTimeChange,
  recurrencePattern,
  onRecurrencePatternChange,
  recurrenceEndDate,
  onRecurrenceEndDateChange,
  recurrenceInterval,
  onRecurrenceIntervalChange,
  recurrenceWeekdays,
  onRecurrenceWeekdaysChange,
  deadlines = [],
  schedulingWindowMessage,
  validationMessage,
  minDate,
  maxDate,
}: EventTimeSeriesSectionProps) {
  const { t } = useTranslation();
  const recurrenceRule =
    recurrencePattern === 'none'
      ? null
      : buildRRule({
          pattern: recurrencePattern,
          interval: recurrenceInterval,
          weekdays: recurrenceWeekdays,
          endDate: recurrenceEndDate || null,
        });
  const recurrenceSummary =
    recurrencePattern === 'none'
      ? t('pages.create.event.recurringPatterns.none')
      : recurrenceRule
        ? getRecurrenceDescription(recurrenceRule, t)
        : t(`pages.create.event.recurringPatterns.${recurrencePattern}`);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border-border/70 bg-card/70 rounded-xl border p-4">
          <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase">
            <CalendarDays className="h-4 w-4" />
            {t('pages.create.event.timeSeriesSummary.start')}
          </div>
          <p className="text-sm font-semibold">
            {buildDateTimeLabel(
              startDate,
              startTime,
              t('pages.create.event.timeSeriesSummary.notScheduled')
            )}
          </p>
        </div>
        <div className="border-border/70 bg-card/70 rounded-xl border p-4">
          <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase">
            <Clock3 className="h-4 w-4" />
            {t('pages.create.event.timeSeriesSummary.end')}
          </div>
          <p className="text-sm font-semibold">
            {buildDateTimeLabel(
              endDate,
              endTime,
              t('pages.create.event.timeSeriesSummary.openEnded')
            )}
          </p>
        </div>
        <div className="border-border/70 bg-card/70 rounded-xl border p-4">
          <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase">
            <Repeat2 className="h-4 w-4" />
            {t('pages.create.event.timeSeriesSummary.series')}
          </div>
          <p className="text-sm font-semibold">{recurrenceSummary}</p>
          {recurrenceEndDate ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {t('pages.create.event.recurringEnds')}: {recurrenceEndDate}
            </p>
          ) : null}
        </div>
      </div>

      {schedulingWindowMessage ? (
        <div className={featureThemeClassName('eventEventTimeSeriesSectionInfoBadge')}>
          {schedulingWindowMessage}
        </div>
      ) : null}

      {validationMessage ? (
        <div className={featureThemeClassName('eventEventTimeSeriesSectionWarningBadge')}>
          {validationMessage}
        </div>
      ) : null}

      <div className="border-border/70 bg-card/60 rounded-2xl border p-4 sm:p-5">
        <DateTimeRangeInput
          startDate={startDate}
          startTime={startTime}
          endDate={endDate}
          endTime={endTime}
          onChange={onDateTimeChange}
          minDate={minDate}
          maxDate={maxDate}
        />
      </div>

      <div className="border-border/70 bg-card/60 rounded-2xl border p-4 sm:p-5">
        <RecurringPatternInput
          value={recurrencePattern}
          onChange={onRecurrencePatternChange}
          endDate={recurrenceEndDate}
          onEndDateChange={onRecurrenceEndDateChange}
          interval={recurrenceInterval}
          onIntervalChange={onRecurrenceIntervalChange}
          weekdays={recurrenceWeekdays}
          onWeekdaysChange={onRecurrenceWeekdaysChange}
        />
      </div>

      {deadlines.length > 0 ? (
        <div className="border-border/70 bg-card/60 rounded-2xl border p-4 sm:p-5">
          <div className="mb-4 space-y-1">
            <div className="flex items-center gap-2">
              <AlarmClock className="text-muted-foreground h-4 w-4" />
              <FormControlLabel>
                {t('pages.create.event.timeSeriesSummary.deadlines')}
              </FormControlLabel>
            </div>
            <p className="text-muted-foreground text-sm">
              {t('pages.create.event.timeSeriesSummary.deadlinesDescription')}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {deadlines.map(deadline => (
              <CreateInputField
                key={deadline.id}
                id={deadline.id}
                type="datetime-local"
                label={deadline.label}
                hint={deadline.hint}
                value={deadline.value}
                onValueChange={deadline.onChange}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

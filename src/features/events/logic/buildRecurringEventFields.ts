import { buildRRule, type RecurrenceFormState } from './rruleHelpers';
import { toLocalEndOfDayTimestamp } from '@/features/shared/logic/localDateTime';

interface BuildRecurringEventFieldsArgs {
  isRecurring: boolean;
  recurrence?: RecurrenceFormState | null;
}

export function buildRecurringEventFields({
  isRecurring,
  recurrence,
}: BuildRecurringEventFieldsArgs) {
  if (!isRecurring || !recurrence || recurrence.pattern === 'none') {
    return {
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_rule: null,
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
    };
  }

  const recurrenceRule = buildRRule(recurrence);

  if (!recurrenceRule) {
    return {
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_rule: null,
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
    };
  }

  return {
    is_recurring: true,
    recurrence_pattern: recurrence.pattern,
    recurrence_rule: recurrenceRule,
    recurrence_interval: recurrence.interval,
    recurrence_days:
      recurrence.pattern === 'weekly' && recurrence.weekdays.length > 0
        ? recurrence.weekdays
        : null,
    recurrence_end_date: toLocalEndOfDayTimestamp(recurrence.endDate),
  };
}

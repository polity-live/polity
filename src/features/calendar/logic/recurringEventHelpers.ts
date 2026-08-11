/**
 * Pure helper functions for recurring event date calculations.
 * Uses rrule.js for RFC 5545 RRULE parsing.
 */

import { RRule } from 'rrule';
import type { EventForCalendarRow } from '@/zero/events/queries';

type EventException = EventForCalendarRow['exceptions'][number];

/** Normalize a date value into epoch ms for comparison (strips time to date-only). */
function toDateKey(val: number | Date | string): string {
  const d = new Date(val);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type RecurringEvent = EventForCalendarRow;

type RecurringEventInstance = RecurringEvent & {
  isRecurringInstance?: boolean;
  recurringParentId?: string;
  instanceDate?: string;
};

export const generateRecurringInstances = (
  event: RecurringEvent,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions?: readonly EventException[]
): RecurringEventInstance[] => {
  if (!event.is_recurring || !event.recurrence_rule) {
    return [event];
  }

  if (!event.start_date || !event.end_date) {
    return [event];
  }

  // Build exception lookup maps
  const cancelledDates = new Set<string>();
  const modifiedDates = new Map<string, EventException>();
  if (exceptions) {
    for (const ex of exceptions) {
      const key = toDateKey(ex.original_date);
      if (ex.action === 'cancelled') {
        cancelledDates.add(key);
      } else if (ex.action === 'modified') {
        modifiedDates.set(key, ex);
      }
    }
  }

  const eventStart = new Date(event.start_date);
  const eventEnd = new Date(event.end_date);
  const duration = eventEnd.getTime() - eventStart.getTime();

  return expandWithRRule(
    event,
    event.recurrence_rule,
    eventStart,
    duration,
    rangeStart,
    rangeEnd,
    cancelledDates,
    modifiedDates
  );
};

function expandWithRRule(
  event: RecurringEvent,
  rawRule: string,
  eventStart: Date,
  duration: number,
  rangeStart: Date,
  rangeEnd: Date,
  cancelledDates: Set<string>,
  modifiedDates: Map<string, EventException>
): RecurringEventInstance[] {
  // generateRecurringInstances rejects missing rules before expansion, so this
  // helper never receives a nullable rule.
  const rruleStr = rawRule.startsWith('RRULE:') ? rawRule : `RRULE:${rawRule}`;

  const rule = RRule.fromString(rruleStr);
  // Override dtstart to match the event's actual start
  const ruleWithStart = new RRule({
    ...rule.origOptions,
    dtstart: eventStart,
  });

  const occurrences = ruleWithStart.between(rangeStart, rangeEnd, true);
  const instances: RecurringEventInstance[] = [];
  const MAX_INSTANCES = 365;

  for (let i = 0; i < occurrences.length && instances.length < MAX_INSTANCES; i++) {
    const occStart = occurrences[i];
    const dateKey = toDateKey(occStart);

    // Skip cancelled occurrences
    if (cancelledDates.has(dateKey)) continue;

    const occEnd = new Date(occStart.getTime() + duration);
    const isFirst = occStart.getTime() === eventStart.getTime();
    const modification = modifiedDates.get(dateKey);

    instances.push({
      ...event,
      id: isFirst ? event.id : `${event.id}_rrule_${i}`,
      start_date: modification?.new_start_date
        ? new Date(modification.new_start_date).getTime()
        : occStart.getTime(),
      end_date: modification?.new_end_date
        ? new Date(modification.new_end_date).getTime()
        : occEnd.getTime(),
      title: modification?.new_title ?? event.title,
      description: modification?.new_description ?? event.description,
      location_name: modification?.new_location_name ?? event.location_name,
      country: modification?.new_country ?? event.country,
      region: modification?.new_region ?? event.region,
      post_code: modification?.new_post_code ?? event.post_code,
      city: modification?.new_city ?? event.city,
      street: modification?.new_street ?? event.street,
      house_number: modification?.new_house_number ?? event.house_number,
      isRecurringInstance: !isFirst,
      recurringParentId: !isFirst ? event.id : undefined,
      instanceDate: dateKey,
    });
  }

  return instances;
}

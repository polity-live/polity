const DEFAULT_AGENDA_DURATION_MINUTES = 30;

interface AgendaCalculableItem {
  id: string;
  event_id?: string | null;
  order_index?: number | null;
  duration?: number | null;
  completed_at?: number | null;
  end_time?: number | null;
  event?: { start_date?: number | null } | null;
}

export function getAgendaDurationMinutes(item: { duration?: number | null }) {
  return typeof item.duration === 'number' && item.duration > 0
    ? item.duration
    : DEFAULT_AGENDA_DURATION_MINUTES;
}

export function getValidTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && value > 0 ? value : undefined;
}

export function withCalculatedAgendaTimes<T extends AgendaCalculableItem>(
  items: T[]
): (T & {
  calculated_start_time?: number;
  calculated_end_time?: number;
})[] {
  const timingByAgendaItemId = new Map<string, { start: number; end: number }>();
  const agendaItemsByEventId = new Map<string, T[]>();

  for (const item of items) {
    if (!item.event_id) {
      continue;
    }

    const existingItems = agendaItemsByEventId.get(item.event_id) ?? [];
    existingItems.push(item);
    agendaItemsByEventId.set(item.event_id, existingItems);
  }

  for (const eventItems of agendaItemsByEventId.values()) {
    const sortedEventItems = [...eventItems].sort(
      (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
    );

    const eventStartTime = sortedEventItems[0]?.event?.start_date;
    if (typeof eventStartTime !== 'number') {
      continue;
    }

    let currentStartTime = eventStartTime;
    for (const item of sortedEventItems) {
      const durationMinutes = getAgendaDurationMinutes(item);
      const calculatedEndTime = currentStartTime + durationMinutes * 60_000;
      const actualEndTime =
        getValidTimestamp(item.completed_at) ?? getValidTimestamp(item.end_time);

      timingByAgendaItemId.set(item.id, {
        start: currentStartTime,
        end: calculatedEndTime,
      });

      currentStartTime = actualEndTime ?? calculatedEndTime;
    }
  }

  return items.map(item => {
    const timing = timingByAgendaItemId.get(item.id);
    return {
      ...item,
      calculated_start_time: timing?.start,
      calculated_end_time: timing?.end,
    };
  });
}

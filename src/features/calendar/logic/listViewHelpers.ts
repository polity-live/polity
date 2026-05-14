import type { CalendarViewMode } from '@/features/events/hooks/useCalendarView';

interface VerticalBounds {
  top: number;
  bottom: number;
}

export type MarkerViewportState = 'visible' | 'above' | 'below';

export function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateKeyTime(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00`).getTime();
}

export function getCalendarEventsForView<T>(
  viewMode: CalendarViewMode,
  events: T[],
  filterEventsForRange: (events: T[]) => T[]
): T[] {
  if (viewMode === 'list') {
    return events;
  }

  return filterEventsForRange(events);
}

export function getListAnchorDateKey(
  dateKeys: readonly string[],
  selectedDate: Date
): string | null {
  if (dateKeys.length === 0) {
    return null;
  }

  const selectedDateKey = getDateKey(selectedDate);
  const selectedDateTime = toDateKeyTime(selectedDateKey);

  for (const dateKey of dateKeys) {
    if (toDateKeyTime(dateKey) >= selectedDateTime) {
      return dateKey;
    }
  }

  return dateKeys[dateKeys.length - 1];
}

export function getMarkerInsertionIndex(dateKeys: readonly string[], markerDate: Date): number {
  const markerDateTime = toDateKeyTime(getDateKey(markerDate));

  for (const [index, dateKey] of dateKeys.entries()) {
    if (toDateKeyTime(dateKey) >= markerDateTime) {
      return index;
    }
  }

  return dateKeys.length;
}

export function getMarkerViewportState(
  markerBounds: VerticalBounds,
  viewportBounds: VerticalBounds
): MarkerViewportState {
  if (markerBounds.bottom < viewportBounds.top) {
    return 'above';
  }

  if (markerBounds.top > viewportBounds.bottom) {
    return 'below';
  }

  return 'visible';
}

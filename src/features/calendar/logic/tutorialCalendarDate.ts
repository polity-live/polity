import type { CalendarEvent } from '../types/calendar.types';

export function getFirstTutorialEventStart(events: CalendarEvent[]): number | null {
  const starts = events
    .filter(event => Boolean(event.tutorial_run_id))
    .map(event => new Date(event.start_date).getTime())
    .filter(Number.isFinite);

  return starts.length > 0 ? Math.min(...starts) : null;
}

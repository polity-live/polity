import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { SEARCH_CARD_GRADIENTS } from '@/features/shared/utils/search-card-gradients';
import { cn } from '@/features/shared/utils/utils';

export function getCompactCalendarEventClassName(event: CalendarEvent): string {
  if (event.isMeeting && event.isBookedByMe) {
    return 'bg-green-500/15 hover:bg-green-500/25';
  }

  if (event.isMeeting && event.is_bookable) {
    return 'border border-dashed border-blue-300 bg-blue-500/10 hover:bg-blue-500/20 dark:border-blue-700';
  }

  if (event.isMeeting) {
    return 'bg-primary/10 hover:bg-primary/20';
  }

  return cn(
    SEARCH_CARD_GRADIENTS.event,
    'border border-amber-200/80 text-amber-950 shadow-sm hover:opacity-90 dark:border-amber-800/60 dark:text-amber-50'
  );
}

export function getCompactCalendarEventMetaClassName(event: CalendarEvent): string {
  if (event.isMeeting) {
    return 'text-muted-foreground';
  }

  return 'text-amber-800/90 dark:text-amber-100/90';
}

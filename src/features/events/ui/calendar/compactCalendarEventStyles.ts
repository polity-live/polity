import { featureThemeClassName } from '@/features/shared/theme';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { SEARCH_CARD_GRADIENTS } from '@/features/shared/utils/search-card-gradients';
import { cn } from '@/features/shared/utils/utils';

export function getCompactCalendarEventClassName(event: CalendarEvent): string {
  if (event.isMeeting && event.isBookedByMe) {
    return featureThemeClassName('eventCompactCalendarEventStylesSuccessBackground');
  }

  if (event.isMeeting && event.is_bookable) {
    return featureThemeClassName('eventCompactCalendarEventStylesInfoSurface');
  }

  if (event.isMeeting) {
    return 'bg-primary/10 hover:bg-primary/20';
  }

  return cn(
    SEARCH_CARD_GRADIENTS.event,
    featureThemeClassName('eventCompactCalendarEventStylesWarningBorder')
  );
}

export function getCompactCalendarEventMetaClassName(event: CalendarEvent): string {
  if (event.isMeeting) {
    return 'text-muted-foreground';
  }

  return featureThemeClassName('eventCompactCalendarEventStylesWarningText');
}

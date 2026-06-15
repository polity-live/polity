import {
  getEntityGradientClasses,
  getEntityToneClasses,
  getSemanticToneClasses,
} from '@/features/shared/theme';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { cn } from '@/features/shared/utils/utils';

export function getCompactCalendarEventClassName(event: CalendarEvent): string {
  if (event.isMeeting && event.isBookedByMe) {
    return getSemanticToneClasses('success').surface;
  }

  if (event.isMeeting && event.is_bookable) {
    return getSemanticToneClasses('info').surface;
  }

  if (event.isMeeting) {
    return getEntityToneClasses('event').softSurface;
  }

  return cn(getEntityGradientClasses('event'), getEntityToneClasses('event').border);
}

export function getCompactCalendarEventMetaClassName(event: CalendarEvent): string {
  if (event.isMeeting) {
    return 'text-muted-foreground';
  }

  return getEntityToneClasses('event').text;
}

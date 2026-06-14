import { CalendarHeader, type CalendarHeaderProps } from '@/features/shared/ui/calendar';
import type { CalendarViewMode } from '@/features/events/hooks/useCalendarView';

type SharedCalendarHeaderProps = CalendarHeaderProps<CalendarViewMode>;

export function SharedCalendarHeader(props: SharedCalendarHeaderProps) {
  return <CalendarHeader {...props} />;
}

import { createFileRoute } from '@tanstack/react-router';
import CalendarPage from '@/features/calendar/CalendarPage';
import { useCalendarPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/calendar')({
  component: CalendarRoute,
});

function CalendarRoute() {
  useCalendarPreloads();
  return <CalendarPage />;
}

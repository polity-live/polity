'use client';

import { useCalendarPage } from './hooks/useCalendarPage';
import { CalendarPageShellView } from './CalendarPageShellView';

export default function CalendarPage() {
  const cp = useCalendarPage();
  return <CalendarPageShellView cp={cp} />;
}

'use client';

import { useCalendarPage } from './hooks/useCalendarPage';
import { CalendarPageShellView } from './CalendarPageShellView';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';

export default function CalendarPage() {
  const cp = useCalendarPage();
  const { handlers: periodSwipeHandlers } = useSwipeNavigation({
    onSwipePrev: cp.goToPrevious,
    onSwipeNext: cp.goToNext,
  });

  return <CalendarPageShellView cp={cp} swipeHandlers={periodSwipeHandlers} />;
}

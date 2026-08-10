import { useEffect, useMemo, useRef } from 'react';

import {
  DEFAULT_WEEK_VIEW_SCROLL_TOP,
  getWeekGridDays,
  WEEK_VIEW_HOUR_HEIGHT,
  WEEK_VIEW_SLOT_HEIGHT,
} from '@/features/shared/ui/calendar';

interface UseMeetingWeekViewControllerArgs {
  selectedDate: Date;
  language: string;
}

export function useMeetingWeekViewController({
  selectedDate,
  language,
}: UseMeetingWeekViewControllerArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const weekDays = useMemo(() => getWeekGridDays(selectedDate), [selectedDate]);
  // getWeekGridDays always returns the complete seven-day grid.
  const weekStartKey = weekDays[0].getTime();
  const halfHourMarkers = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => hour * WEEK_VIEW_HOUR_HEIGHT + WEEK_VIEW_SLOT_HEIGHT),
    []
  );
  const hourMarkers = useMemo(() => Array.from({ length: 25 }, (_, hour) => hour), []);
  const locale = language === 'de' ? 'de-DE' : 'en-US';

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.scrollTop = DEFAULT_WEEK_VIEW_SCROLL_TOP;
  }, [weekStartKey]);

  return {
    containerRef,
    weekDays,
    halfHourMarkers,
    hourMarkers,
    locale,
  };
}

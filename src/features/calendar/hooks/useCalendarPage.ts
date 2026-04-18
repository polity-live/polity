import { useCalendarData } from './useCalendarData';
import { useCalendarView } from '@/features/events/hooks/useCalendarView';
import { useCalendarEventFilter } from '@/features/events/hooks/useCalendarEventFilter';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useCallback, useState } from 'react';
import type { CalendarEvent } from '../types/calendar.types';

export function useCalendarPage() {
  const { t } = useTranslation();
  const { events, isLoading } = useCalendarData();
  const calendar = useCalendarView('list');
  const filter = useCalendarEventFilter(events);
  const [selectedItem, setSelectedItem] = useState<CalendarEvent | null>(null);

  const filteredEvents = calendar.filterEventsForRange(filter.filteredBySearch);
  const selectItem = useCallback((item: CalendarEvent) => {
    setSelectedItem(item);
  }, []);

  const handleDetailsOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedItem(null);
    }
  }, []);

  return {
    t,
    isLoading,
    viewMode: calendar.viewMode,
    setViewMode: calendar.setViewMode,
    selectedDate: calendar.selectedDate,
    setSelectedDate: calendar.setSelectedDate,
    currentViewTitle: calendar.currentViewTitle,
    goToPrevious: calendar.goToPrevious,
    goToNext: calendar.goToNext,
    goToToday: calendar.goToToday,
    filteredEvents,
    events: filter.filteredBySearch,
    searchQuery: filter.searchQuery,
    setSearchQuery: filter.setSearchQuery,
    dateFilter: filter.dateFilter,
    setDateFilter: filter.setDateFilter,
    selectedItem,
    selectItem,
    handleDetailsOpenChange,
  };
}

import { useState, useMemo, useCallback } from 'react';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { filterCalendarEvents } from '@/features/events/logic/filterCalendarEvents';

interface CalendarEventFilterOptions {
  selectedGroupId?: string;
}

export function useCalendarEventFilter(
  events: CalendarEvent[],
  options: CalendarEventFilterOptions = {}
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const { selectedGroupId } = options;

  const filteredBySearch = useMemo(() => {
    return filterCalendarEvents(events, {
      searchQuery,
      dateFilter,
      selectedGroupId,
    });
  }, [dateFilter, events, searchQuery, selectedGroupId]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFilter('');
  }, []);

  const hasActiveFilters = searchQuery !== '' || dateFilter !== '' || !!selectedGroupId;

  return {
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    filteredBySearch,
    clearFilters,
    hasActiveFilters,
  };
}

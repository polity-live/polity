import { useCalendarData } from './useCalendarData';
import { useCalendarView } from '@/features/events/hooks/useCalendarView';
import { useCalendarEventFilter } from '@/features/events/hooks/useCalendarEventFilter';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getCalendarEventsForView } from '../logic/listViewHelpers';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toCreateEventSearch } from '@/features/create/logic/createEventSearch';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import type { CalendarEvent } from '../types/calendar.types';
import { getBaseEventId } from '../logic/eventIdUtils';

interface CalendarGroupOption {
  id: string;
  name: string;
}

export function useCalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { events, isLoading } = useCalendarData();
  const calendar = useCalendarView('week');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const groupItems = useMemo<TypeaheadItem[]>(() => {
    const uniqueGroups = new Map<string, CalendarGroupOption>();

    for (const event of events) {
      if (!event.group_id || !event.groupName || uniqueGroups.has(event.group_id)) {
        continue;
      }

      uniqueGroups.set(event.group_id, {
        id: event.group_id,
        name: event.groupName,
      });
    }

    const sortedGroups = Array.from(uniqueGroups.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );

    return toTypeaheadItems(
      sortedGroups,
      'group',
      group => group.name,
      undefined,
      undefined,
      group => `/group/${group.id}`
    );
  }, [events]);
  const filter = useCalendarEventFilter(events, { selectedGroupId });

  const filteredEvents = getCalendarEventsForView(
    calendar.viewMode,
    filter.filteredBySearch,
    calendar.filterEventsForRange
  );
  const onEventSelect = useCallback(
    (item: CalendarEvent) => {
      const baseEventId = getBaseEventId(item.id);
      navigate({ to: '/event/$id', params: { id: baseEventId } });
    },
    [navigate]
  );
  const onCreateEventRange = useCallback(
    (range: { start: Date; end: Date }) => {
      navigate({
        to: '/create/event',
        search: toCreateEventSearch(range),
      });
    },
    [navigate]
  );
  const onCreateEvent = useCallback(() => {
    navigate({ to: '/create/event' });
  }, [navigate]);

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
    selectedGroupId,
    setSelectedGroupId,
    groupItems,
    onEventSelect,
    onCreateEventRange,
    onCreateEvent,
  };
}

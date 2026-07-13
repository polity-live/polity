import { Plus } from 'lucide-react';

import { CalendarFilterBar, CalendarHeader } from '@/features/shared/ui/calendar';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { Button } from '@/features/shared/ui/ui/button';
import { CalendarExportButton } from '@/features/events/ui/calendar/CalendarExportButton';
import { CalendarViewContainer } from '@/features/events/ui/calendar/CalendarViewContainer';
import type { CalendarEvent, CalendarViewMode } from '../types/calendar.types';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { CalendarGroupFilter } from './CalendarGroupFilter';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';

export interface CalendarPageViewProps {
  isLoading: boolean;
  loadingLabel: string;
  title: string;
  createEventLabel: string;
  viewMode: CalendarViewMode;
  setViewMode: (viewMode: CalendarViewMode) => void;
  currentViewTitle: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreateEvent: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateFilter: string;
  onDateFilterChange: (date: string) => void;
  groupItems: TypeaheadItem[];
  selectedGroupId: string;
  onGroupChange: (groupId: string) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  onEventSelect: (event: CalendarEvent) => void;
  onCreateEventRange: (range: { start: Date; end: Date }) => void;
  swipeHandlers: SwipeNavigationHandlers;
}

export function CalendarPageView({
  isLoading,
  loadingLabel,
  title,
  createEventLabel,
  viewMode,
  setViewMode,
  currentViewTitle,
  onPrevious,
  onNext,
  onToday,
  onCreateEvent,
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  groupItems,
  selectedGroupId,
  onGroupChange,
  selectedDate,
  onDateSelect,
  events,
  filteredEvents,
  onEventSelect,
  onCreateEventRange,
  swipeHandlers,
}: CalendarPageViewProps) {
  if (isLoading) {
    return <PageSkeleton variant="calendar" label={loadingLabel} />;
  }

  return (
    <div style={{ touchAction: 'pan-y' }} {...swipeHandlers}>
      <CalendarHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentViewTitle={currentViewTitle}
        onPrevious={onPrevious}
        onNext={onNext}
        onToday={onToday}
        title={title}
        headingMode="sr-only"
        actions={
          <>
            <CalendarExportButton events={events} />
            <Button onClick={onCreateEvent}>
              <Plus className="mr-2 h-4 w-4" />
              {createEventLabel}
            </Button>
          </>
        }
      />

      <CalendarFilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        dateFilter={dateFilter}
        onDateFilterChange={onDateFilterChange}
        middleFilter={
          <CalendarGroupFilter
            items={groupItems}
            selectedGroupId={selectedGroupId}
            onGroupChange={onGroupChange}
          />
        }
      />

      <CalendarViewContainer
        viewMode={viewMode}
        selectedDate={selectedDate}
        events={filteredEvents}
        allEvents={events}
        onDateSelect={onDateSelect}
        onEventSelect={onEventSelect}
        onCreateEventRange={onCreateEventRange}
        listQueryScope={{ query: searchQuery }}
      />
    </div>
  );
}

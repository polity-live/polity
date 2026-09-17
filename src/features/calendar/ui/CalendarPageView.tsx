import { useCalendarCollectionView } from '@/features/shared/ui/collections/useCalendarCollectionView';
import { Plus, Filter, List, ListFilter, Grid3x3, CalendarDays } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SearchField } from '@/features/shared/ui/form/SearchField';
import { FormControlInput } from '@/features/shared/ui/form/FormControls';

import { CalendarHeader } from '@/features/shared/ui/calendar';
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
  const { t } = useTranslation();
  const changeView = useCalendarCollectionView('calendar', viewMode, setViewMode);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = useId();
  if (isLoading) {
    return <PageSkeleton variant="calendar" label={loadingLabel} />;
  }

  return (
    <div style={{ touchAction: 'pan-y' }} {...swipeHandlers}>
      <CalendarHeader
        search={
          <SearchField
            value={searchQuery}
            onValueChange={onSearchChange}
            placeholder={t('features.calendar.search.placeholder')}
            clearLabel={t('common.actions.clear')}
          />
        }
        views={[
          { value: 'list', label: t('features.calendar.views.list'), Icon: List },
          { value: 'compact', label: t('common.workspace.compactView'), Icon: ListFilter },
          { value: 'week', label: t('features.calendar.views.week'), Icon: Grid3x3 },
          { value: 'month', label: t('features.calendar.views.month'), Icon: CalendarDays },
        ]}
        viewMode={viewMode}
        setViewMode={changeView}
        currentViewTitle={currentViewTitle}
        onPrevious={onPrevious}
        onNext={onNext}
        onToday={onToday}
        title={title}
        headingMode="sr-only"
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              className="relative"
              aria-label={t('features.search.filters.title')}
              aria-expanded={filtersOpen}
              aria-controls={filterPanelId}
              onClick={() => setFiltersOpen(open => !open)}
              data-action-id="calendar.page.filters.toggle"
            >
              <Filter className="size-4" />
              {selectedGroupId || dateFilter ? (
                <span className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" />
              ) : null}
            </Button>
            <CalendarExportButton
              iconOnly
              events={events}
              data-action-id="calendar.page.events.export"
            />
            <Button
              size="icon"
              aria-label={createEventLabel}
              title={createEventLabel}
              onClick={onCreateEvent}
              data-action-id="calendar.page.event.create"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div id={filterPanelId} hidden={!filtersOpen} className="mb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <CalendarGroupFilter
              items={groupItems}
              selectedGroupId={selectedGroupId}
              onGroupChange={onGroupChange}
            />
          </div>
          <FormControlInput
            type="date"
            aria-label={t('common.labels.date')}
            value={dateFilter}
            onChange={event => onDateFilterChange(event.target.value)}
            className="w-full sm:w-44"
          />
          {dateFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDateFilterChange('')}
              data-action-id="calendar.page.date.clear"
            >
              {t('features.calendar.search.clearDate')}
            </Button>
          ) : null}
        </div>
      </div>

      <CalendarViewContainer
        viewMode={viewMode}
        selectedDate={selectedDate}
        events={filteredEvents}
        allEvents={events}
        onDateSelect={onDateSelect}
        onEventSelect={onEventSelect}
        onCreateEventRange={onCreateEventRange}
      />
    </div>
  );
}

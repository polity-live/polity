import type { CalendarViewMode, CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { SharedListView } from './SharedListView';
import { SharedWeekView } from './SharedWeekView';
import { SharedMonthView } from './SharedMonthView';

interface CalendarViewContainerProps {
  viewMode: CalendarViewMode;
  selectedDate: Date;
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  onEventSelect: (event: CalendarEvent) => void;
  onCreateEventRange?: (range: { start: Date; end: Date }) => void;
  listQueryScope?: { groupId?: string; creatorId?: string; query?: string };
}

export function CalendarViewContainer({
  viewMode,
  selectedDate,
  events,
  allEvents,
  onDateSelect,
  onEventSelect,
  onCreateEventRange,
  listQueryScope,
}: CalendarViewContainerProps) {
  if (viewMode === 'list') {
    return (
      <SharedListView
        events={events}
        selectedDate={selectedDate}
        onEventSelect={onEventSelect}
        queryScope={listQueryScope}
      />
    );
  }

  if (viewMode === 'week') {
    return (
      <SharedWeekView
        selectedDate={selectedDate}
        events={allEvents}
        onDateSelect={onDateSelect}
        onEventSelect={onEventSelect}
        onCreateEventRange={onCreateEventRange}
      />
    );
  }

  return (
    <SharedMonthView
      selectedDate={selectedDate}
      onDateSelect={onDateSelect}
      events={allEvents}
      onEventSelect={onEventSelect}
    />
  );
}

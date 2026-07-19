import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useGroupEventsPage } from '@/features/groups/hooks/useGroupEventsPage';
import { SharedCalendarHeader } from '@/features/events/ui/calendar/SharedCalendarHeader';
import { CalendarViewContainer } from '@/features/events/ui/calendar/CalendarViewContainer';
import { CalendarSearchFilter } from '@/features/events/ui/calendar/CalendarSearchFilter';
import { usePermissions } from '@/zero/rbac';
import { Button } from '@/features/shared/ui/ui/button';

export const Route = createFileRoute('/_authed/group/$id/events')({
  component: GroupEventsPage,
});

function GroupEventsPage() {
  const { id } = Route.useParams();
  const gp = useGroupEventsPage(id);
  const { canCreate } = usePermissions({ groupId: id });
  const canCreateEvents = canCreate('events');

  return (
    <div>
      <SharedCalendarHeader
        viewMode={gp.viewMode}
        setViewMode={gp.setViewMode}
        currentViewTitle={gp.currentViewTitle}
        onPrevious={gp.goToPrevious}
        onNext={gp.goToNext}
        onToday={gp.goToToday}
        title={gp.t('features.calendar.title')}
        headingMode="sr-only"
        actions={
          canCreateEvents ? (
            <Link to="/create/event" search={{ groupId: id }}>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                {gp.t('features.calendar.actions.createEvent')}
              </Button>
            </Link>
          ) : null
        }
      />

      <CalendarSearchFilter
        searchQuery={gp.searchQuery}
        onSearchChange={gp.setSearchQuery}
        dateFilter={gp.dateFilter}
        onDateFilterChange={gp.setDateFilter}
      />

      <CalendarViewContainer
        viewMode={gp.viewMode}
        selectedDate={gp.selectedDate}
        events={gp.filteredEvents}
        allEvents={gp.events}
        onDateSelect={gp.setSelectedDate}
        onEventSelect={gp.onEventSelect}
        onCreateEventRange={canCreateEvents ? gp.onCreateEventRange : undefined}
        listQueryScope={{ groupId: id, query: gp.searchQuery }}
      />
    </div>
  );
}

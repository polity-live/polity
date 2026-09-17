import { useCalendarCollectionView } from '@/features/shared/ui/collections/useCalendarCollectionView';
import { SearchField } from '@/features/shared/ui/form/SearchField';
import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useGroupEventsPage } from '@/features/groups/hooks/useGroupEventsPage';
import { SharedCalendarHeader } from '@/features/events/ui/calendar/SharedCalendarHeader';
import { CalendarViewContainer } from '@/features/events/ui/calendar/CalendarViewContainer';
import { Input } from '@/features/shared/ui/ui/input';
import { usePermissions } from '@/zero/rbac';
import { Button } from '@/features/shared/ui/ui/button';

export const Route = createFileRoute('/_authed/group/$id/events')({
  component: GroupEventsPage,
});

function GroupEventsPage() {
  const { id } = Route.useParams();
  const gp = useGroupEventsPage(id);
  const { canCreate } = usePermissions({ groupId: id });
  const changeView = useCalendarCollectionView('group.events', gp.viewMode, gp.setViewMode);
  const canCreateEvents = canCreate('events');

  return (
    <div>
      <SharedCalendarHeader
        viewMode={gp.viewMode}
        setViewMode={changeView}
        search={
          <SearchField
            value={gp.searchQuery}
            onValueChange={gp.setSearchQuery}
            placeholder={gp.t('features.calendar.search.placeholder')}
          />
        }
        views={[
          { value: 'list', label: gp.t('common.workspace.cardsView') },
          { value: 'compact', label: gp.t('common.workspace.compactView') },
          { value: 'week', label: gp.t('features.calendar.views.week') },
          { value: 'month', label: gp.t('features.calendar.views.month') },
        ]}
        currentViewTitle={gp.currentViewTitle}
        onPrevious={gp.goToPrevious}
        onNext={gp.goToNext}
        onToday={gp.goToToday}
        title={gp.t('features.calendar.title')}
        headingMode="sr-only"
        actions={
          canCreateEvents ? (
            <Button asChild size="sm" data-action-id="routes.group-events.event.create">
              <Link
                to="/create/event"
                search={{ groupId: id }}
                data-action-id="routes.group-events.event.create"
              >
                <Plus className="mr-1 h-4 w-4" />
                {gp.t('features.calendar.actions.createEvent')}
              </Link>
            </Button>
          ) : null
        }
      />

      <Input
        type="date"
        aria-label={gp.t('common.labels.date')}
        value={gp.dateFilter}
        onChange={event => gp.setDateFilter(event.target.value)}
        className="mb-3 max-w-44"
      />

      <CalendarViewContainer
        viewMode={gp.viewMode}
        selectedDate={gp.selectedDate}
        events={gp.filteredEvents}
        allEvents={gp.events}
        onDateSelect={gp.setSelectedDate}
        onEventSelect={gp.onEventSelect}
        onCreateEventRange={canCreateEvents ? gp.onCreateEventRange : undefined}
      />
    </div>
  );
}

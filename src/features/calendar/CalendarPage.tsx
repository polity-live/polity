'use client';

import { PageWrapper } from '@/layout/page-wrapper';
import { AuthGuard } from '@/features/auth/AuthGuard.tsx';
import { useCalendarPage } from './hooks/useCalendarPage';
import { CalendarPageView } from './ui/CalendarPageView';

export default function CalendarPage() {
  const cp = useCalendarPage();

  return (
    <AuthGuard requireAuth={true}>
      <PageWrapper>
        <CalendarPageView
          isLoading={cp.isLoading}
          loadingLabel={cp.t('features.calendar.loading')}
          title={cp.t('features.calendar.title')}
          createEventLabel={cp.t('features.calendar.actions.createEvent')}
          viewMode={cp.viewMode}
          setViewMode={cp.setViewMode}
          currentViewTitle={cp.currentViewTitle}
          onPrevious={cp.goToPrevious}
          onNext={cp.goToNext}
          onToday={cp.goToToday}
          onCreateEvent={cp.onCreateEvent}
          searchQuery={cp.searchQuery}
          onSearchChange={cp.setSearchQuery}
          dateFilter={cp.dateFilter}
          onDateFilterChange={cp.setDateFilter}
          groupItems={cp.groupItems}
          selectedGroupId={cp.selectedGroupId}
          onGroupChange={cp.setSelectedGroupId}
          selectedDate={cp.selectedDate}
          onDateSelect={cp.setSelectedDate}
          events={cp.events}
          filteredEvents={cp.filteredEvents}
          onEventSelect={cp.onEventSelect}
          onCreateEventRange={cp.onCreateEventRange}
        />
      </PageWrapper>
    </AuthGuard>
  );
}

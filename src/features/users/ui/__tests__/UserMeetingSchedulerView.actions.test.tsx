/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserMeetingSchedulerView } from '../UserMeetingSchedulerView';

vi.mock('@/features/events/ui/calendar/SharedCalendarHeader', () => ({
  SharedCalendarHeader: ({
    actions,
    onPrevious,
  }: {
    actions?: ReactNode;
    onPrevious: () => void;
  }) => (
    <header>
      <button type="button" onClick={onPrevious}>
        Previous
      </button>
      {actions}
    </header>
  ),
}));

vi.mock('@/features/meet/ui/MeetingCalendarViews', () => ({
  MeetingListView: (props: Record<string, unknown>) => (
    <div
      data-testid="meeting-list"
      data-book={String(Boolean(props.onBook))}
      data-cancel={String(Boolean(props.onCancel))}
      data-delete={String(Boolean(props.onDelete))}
      data-select={String(Boolean(props.onSelectInstance))}
    />
  ),
  MeetingWeekView: () => <div data-testid="meeting-week" />,
  MeetingMonthView: () => <div data-testid="meeting-month" />,
}));

vi.mock('@/features/meet/ui/MeetingInstanceCard', () => ({
  MeetingInstanceCard: () => <div data-testid="meeting-card" />,
}));

afterEach(() => cleanup());

function props(overrides: Record<string, unknown> = {}) {
  return {
    allInstances: [],
    canSaveMeeting: false,
    currentViewTitle: 'Meetings',
    filteredInstances: [],
    getInstancesForDate: vi.fn(() => []),
    goToNext: vi.fn(),
    goToPrevious: vi.fn(),
    goToToday: vi.fn(),
    handleBookMeeting: vi.fn(),
    handleCancelBooking: vi.fn(),
    handleDeleteMeeting: vi.fn(),
    handleEditDialogOpenChange: vi.fn(),
    handleSubmitEdit: vi.fn(),
    isAuthenticated: false,
    isBookingDialogOpen: false,
    isEditDialogOpen: false,
    isLoading: false,
    isOwner: false,
    meetings: [],
    openBookingDialog: vi.fn(),
    openCreateEventFlow: vi.fn(),
    openEditDialog: vi.fn(),
    owner: { first_name: 'Ada' },
    selectedDate: new Date('2026-07-19T12:00:00Z'),
    selectedInstance: null,
    setEditDate: vi.fn(),
    setEditDescription: vi.fn(),
    setEditDuration: vi.fn(),
    setEditLocation: vi.fn(),
    setEditLocationUrl: vi.fn(),
    setEditMaxBookings: vi.fn(),
    setEditTime: vi.fn(),
    setEditTitle: vi.fn(),
    setEditType: vi.fn(),
    setIsBookingDialogOpen: vi.fn(),
    setSelectedDate: vi.fn(),
    setView: vi.fn(),
    userId: 'user-1',
    view: 'list',
    ...overrides,
  } as any;
}

describe('UserMeetingSchedulerView actions', () => {
  it('keeps calendar controls but removes every meeting mutation for guests', () => {
    render(<UserMeetingSchedulerView {...props()} />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeTruthy();
    const list = screen.getByTestId('meeting-list');
    expect(list.dataset.book).toBe('false');
    expect(list.dataset.cancel).toBe('false');
    expect(list.dataset.delete).toBe('false');
    expect(list.dataset.select).toBe('false');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('keeps booking capabilities for an authenticated visitor', () => {
    render(<UserMeetingSchedulerView {...props({ isAuthenticated: true })} />);

    const list = screen.getByTestId('meeting-list');
    expect(list.dataset.book).toBe('true');
    expect(list.dataset.cancel).toBe('true');
    expect(list.dataset.select).toBe('true');
    expect(screen.getByRole('tab')).toBeTruthy();
  });
});

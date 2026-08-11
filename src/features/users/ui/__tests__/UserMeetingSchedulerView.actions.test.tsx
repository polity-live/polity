/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  FormControlTextarea: (props: any) => <textarea {...props} />,
}));
vi.mock('@/features/shared/ui/ui/calendar', () => ({ Calendar: () => null }));

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

  it('dispatches owner creation, booking, and editing through stable scheduler intents', () => {
    const viewProps = props({
      isAuthenticated: true,
      isOwner: true,
      isBookingDialogOpen: true,
      isEditDialogOpen: true,
      canSaveMeeting: true,
      editDate: '2026-07-20',
      editDescription: '',
      editDuration: '30',
      editLocation: '',
      editLocationUrl: '',
      editMaxBookings: '3',
      editTime: '12:00',
      editTitle: 'Meeting',
      editType: 'one-on-one',
      selectedInstance: {
        id: 'instance-1',
        title: 'Meeting',
        startDate: new Date('2026-07-20T12:00:00Z').getTime(),
        endDate: new Date('2026-07-20T12:30:00Z').getTime(),
        locationName: 'Online',
        locationUrl: 'https://example.test/meeting',
        bookingCount: 0,
        maxBookings: 3,
        isBookedByMe: false,
      },
    });
    render(<UserMeetingSchedulerView {...viewProps} />);

    const creates = document.querySelectorAll('[data-action-id="users.meet.offer.create"]');
    expect(creates).toHaveLength(2);
    creates.forEach(action => fireEvent.click(action));
    for (const id of ['manage', 'bookings']) {
      expect(document.querySelector(`[data-action-id="users.meet.tab.${id}"]`)).toBeTruthy();
    }
    expect(document.querySelector('[data-action-id="users.meet.online.open"]')?.tagName).toBe('A');
    fireEvent.click(document.querySelector('[data-action-id="users.meet.booking.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.booking.confirm"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit-type.one-on-one"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit-type.public"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit.save"]')!);

    expect(viewProps.openCreateEventFlow).toHaveBeenCalledTimes(2);
    expect(viewProps.handleBookMeeting).toHaveBeenCalledWith(viewProps.selectedInstance);
    expect(viewProps.setEditType).toHaveBeenCalledWith('public-meeting');
    expect(viewProps.handleSubmitEdit).toHaveBeenCalledOnce();
  });
});

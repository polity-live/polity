/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProps: undefined as Record<string, any> | undefined,
  weekProps: undefined as Record<string, any> | undefined,
  monthProps: undefined as Record<string, any> | undefined,
  calendarProps: undefined as Record<string, any> | undefined,
  cards: [] as Record<string, any>[],
}));

vi.mock('@/features/events/ui/calendar/SharedCalendarHeader', () => ({
  SharedCalendarHeader: ({ actions }: { actions?: ReactNode }) => <header>{actions}</header>,
}));
vi.mock('@/features/meet/ui/MeetingCalendarViews', () => ({
  MeetingListView: (props: Record<string, any>) => {
    mocks.listProps = props;
    return <div data-testid="list-view" />;
  },
  MeetingWeekView: (props: Record<string, any>) => {
    mocks.weekProps = props;
    return <div data-testid="week-view" />;
  },
  MeetingMonthView: (props: Record<string, any>) => {
    mocks.monthProps = props;
    return <div data-testid="month-view" />;
  },
}));
vi.mock('@/features/meet/ui/MeetingInstanceCard', () => ({
  MeetingInstanceCard: (props: Record<string, any>) => {
    mocks.cards.push(props);
    return <div data-testid="meeting-card" />;
  },
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-testid="loading" />,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
  FormControlTextarea: (props: any) => <textarea {...props} />,
  FormControlLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));
vi.mock('@/features/shared/ui/ui/calendar', () => ({
  Calendar: (props: Record<string, any>) => {
    mocks.calendarProps = props;
    return <div data-testid="calendar" />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { UserMeetingSchedulerView } from '../UserMeetingSchedulerView';

function props(overrides: Record<string, unknown> = {}) {
  return {
    allInstances: [],
    canSaveMeeting: true,
    currentViewTitle: 'August',
    editDate: new Date('2026-08-20T12:00:00Z'),
    editDescription: 'Description',
    editDuration: '30',
    editLocation: 'Hall',
    editLocationUrl: 'https://meeting.example',
    editMaxBookings: '5',
    editTime: '12:00',
    editTitle: 'Meeting',
    editType: 'one-on-one',
    editingRecurringSeries: false,
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
    isBookingDialogOpen: false,
    isEditDialogOpen: false,
    isLoading: false,
    isAuthenticated: false,
    isOwner: false,
    meetings: [],
    openBookingDialog: vi.fn(),
    openCreateEventFlow: vi.fn(),
    openEditDialog: vi.fn(),
    owner: null,
    selectedDate: new Date('2026-08-20T12:00:00Z'),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProps = undefined;
  mocks.weekProps = undefined;
  mocks.monthProps = undefined;
  mocks.calendarProps = undefined;
  mocks.cards = [];
});

afterEach(cleanup);

describe('UserMeetingSchedulerView branch campaign A07', () => {
  it('renders the loading state', () => {
    render(<UserMeetingSchedulerView {...props({ isLoading: true })} />);
    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('renders unauthenticated week and month views with fallback owner text and no handlers', () => {
    const view = render(<UserMeetingSchedulerView {...props({ view: 'week', owner: {} })} />);
    expect(screen.getByTestId('week-view')).toBeTruthy();
    expect(mocks.weekProps?.onSelectInstance).toBeUndefined();
    view.rerender(<UserMeetingSchedulerView {...props({ view: 'month', owner: {} })} />);
    expect(screen.getByTestId('month-view')).toBeTruthy();
    expect(mocks.monthProps?.onSelectInstance).toBeUndefined();
  });

  it('provides visitor booking handlers and filters booked instances by personal booking', () => {
    const openBookingDialog = vi.fn();
    const viewProps = props({
      isAuthenticated: true,
      view: 'month',
      owner: { first_name: '' },
      openBookingDialog,
      allInstances: [
        { id: 'mine', isBookedByMe: true, endDate: Date.now() + 10_000 },
        { id: 'other', isBookedByMe: false, endDate: Date.now() + 10_000 },
      ],
    });
    const view = render(<UserMeetingSchedulerView {...viewProps} />);
    expect(mocks.monthProps?.onSelectInstance).toBe(openBookingDialog);
    expect(mocks.cards.some(card => card.instance.id === 'mine')).toBe(true);
    expect(mocks.cards.some(card => card.instance.id === 'other')).toBe(false);
    expect(mocks.cards.find(card => card.instance.id === 'mine')?.onSelect).toBeUndefined();

    view.rerender(<UserMeetingSchedulerView {...props({ isAuthenticated: true, view: 'week' })} />);
    expect(mocks.weekProps?.onSelectInstance).toBeDefined();
    view.rerender(
      <UserMeetingSchedulerView
        {...props({ isAuthenticated: true, isOwner: true, view: 'month' })}
      />
    );
    expect(mocks.monthProps?.onSelectInstance).toBeDefined();
  });

  it('covers owner bookings, future instances, recurring public edit fields, and callbacks', () => {
    const selectedInstance = {
      id: 'selected',
      title: 'Selected meeting',
      startDate: Date.now() + 20_000,
      endDate: Date.now() + 30_000,
      locationName: 'Hall',
      locationUrl: null,
      streamUrl: 'https://stream.example',
      bookingCount: 2,
      maxBookings: 5,
      isBookedByMe: false,
    };
    const viewProps = props({
      isAuthenticated: true,
      isOwner: true,
      view: 'week',
      owner: { first_name: 'Ada' },
      meetings: [{ id: 'meeting-1' }],
      allInstances: [
        { ...selectedInstance, id: 'future', bookingCount: 1 },
        { ...selectedInstance, id: 'empty', bookingCount: 0 },
        { ...selectedInstance, id: 'past', endDate: Date.now() - 10_000 },
      ],
      selectedInstance,
      editType: 'public-meeting',
      editingRecurringSeries: true,
      isBookingDialogOpen: true,
      isEditDialogOpen: true,
    });
    render(<UserMeetingSchedulerView {...viewProps} />);
    expect(mocks.weekProps?.onSelectInstance).toBe(viewProps.openEditDialog);
    expect(mocks.cards.filter(card => card.instance.id === 'future')).toHaveLength(2);
    expect(mocks.cards.filter(card => card.instance.id === 'past')).toHaveLength(1);
    expect(mocks.cards.find(card => card.instance.id === 'future')?.onSelect).toBe(
      viewProps.openEditDialog
    );
    expect(
      document.querySelector('[data-action-id="users.meet.online.open"]')?.getAttribute('href')
    ).toBe('https://stream.example');
    expect(screen.getByText(/2 \/ 5/)).toBeTruthy();
    expect(document.querySelector('#edit-max-bookings')).toBeTruthy();

    fireEvent.change(document.querySelector('#edit-meeting-title')!, { target: { value: 'T' } });
    fireEvent.change(document.querySelector('#edit-meeting-description')!, {
      target: { value: 'D' },
    });
    fireEvent.change(document.querySelector('#edit-meeting-location')!, {
      target: { value: 'L' },
    });
    fireEvent.change(document.querySelector('#edit-meeting-location-url')!, {
      target: { value: 'U' },
    });
    fireEvent.change(document.querySelector('#edit-max-bookings')!, { target: { value: '9' } });
    fireEvent.change(document.querySelector('#edit-meeting-time')!, { target: { value: '10:00' } });
    fireEvent.change(document.querySelector('#edit-meeting-duration')!, {
      target: { value: '45' },
    });
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit-type.one-on-one"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit-type.public"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.booking.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.booking.confirm"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.meet.edit.save"]')!);
    mocks.calendarProps?.onSelect(new Date('2026-08-21'));
    expect(mocks.calendarProps?.disabled(new Date('2000-01-01'))).toBe(true);

    expect(viewProps.setEditTitle).toHaveBeenCalledWith('T');
    expect(viewProps.setEditDescription).toHaveBeenCalledWith('D');
    expect(viewProps.setEditLocation).toHaveBeenCalledWith('L');
    expect(viewProps.setEditLocationUrl).toHaveBeenCalledWith('U');
    expect(viewProps.setEditMaxBookings).toHaveBeenCalledWith('9');
    expect(viewProps.setEditTime).toHaveBeenCalledWith('10:00');
    expect(viewProps.setEditDuration).toHaveBeenCalledWith('45');
    expect(viewProps.setEditType).toHaveBeenCalledWith('one-on-one');
    expect(viewProps.setEditType).toHaveBeenCalledWith('public-meeting');
    expect(viewProps.setIsBookingDialogOpen).toHaveBeenCalledWith(false);
    expect(viewProps.handleBookMeeting).toHaveBeenCalledWith(selectedInstance);
    expect(viewProps.handleEditDialogOpenChange).toHaveBeenCalledWith(false);
    expect(viewProps.handleSubmitEdit).toHaveBeenCalledOnce();
  });
});

/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  viewProps: undefined as Record<string, unknown> | undefined,
  meet: {
    isAuthenticated: true,
    isOwner: true,
    isLoading: false,
    owner: { id: 'owner-1' },
    meetings: [] as Record<string, unknown>[],
    view: 'month',
    setView: vi.fn(),
    selectedDate: new Date('2026-08-01T00:00:00Z'),
    setSelectedDate: vi.fn(),
    currentViewTitle: 'August 2026',
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    goToToday: vi.fn(),
    allInstances: [],
    filteredInstances: [],
    getInstancesForDate: vi.fn(),
    isBookingDialogOpen: false,
    setIsBookingDialogOpen: vi.fn(),
    selectedInstance: null,
    handleBookMeeting: vi.fn(),
    handleCancelBooking: vi.fn(),
    handleUpdateMeeting: vi.fn(async () => undefined),
    handleDeleteMeeting: vi.fn(),
    openBookingDialog: vi.fn(),
  },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/features/meet/hooks/useMeetPage', () => ({
  useMeetPage: () => mocks.meet,
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('../UserMeetingSchedulerView', () => ({
  UserMeetingSchedulerView: (props: Record<string, unknown>) => {
    mocks.viewProps = props;
    return <div data-testid="meeting-scheduler-view" />;
  },
}));

import { UserMeetingScheduler } from '../UserMeetingScheduler';

interface SchedulerProps {
  canSaveMeeting: boolean;
  editDate?: Date;
  editDescription: string;
  editDuration: string;
  editLocation: string;
  editLocationUrl: string;
  editMaxBookings: string;
  editTime: string;
  editTitle: string;
  editType: 'one-on-one' | 'public-meeting';
  editingMeetingId: string | null;
  editingRecurringSeries: boolean;
  isEditDialogOpen: boolean;
  handleEditDialogOpenChange: (open: boolean) => void;
  handleSubmitEdit: () => Promise<void>;
  openCreateEventFlow: () => void;
  openEditDialog: (instance: {
    parentEventId: string;
    startDate: number;
    endDate: number;
    title: string;
  }) => void;
  resetEditForm: () => void;
  setEditDate: (value?: Date) => void;
  setEditDescription: (value: string) => void;
  setEditDuration: (value: string) => void;
  setEditLocation: (value: string) => void;
  setEditLocationUrl: (value: string) => void;
  setEditMaxBookings: (value: string) => void;
  setEditTime: (value: string) => void;
  setEditTitle: (value: string) => void;
  setEditType: (value: 'one-on-one' | 'public-meeting') => void;
  setEditingMeetingId: (value: string | null) => void;
  setEditingRecurringSeries: (value: boolean) => void;
  setIsEditDialogOpen: (value: boolean) => void;
}

function props() {
  return mocks.viewProps as unknown as SchedulerProps;
}

describe('UserMeetingScheduler branch campaign A07', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.viewProps = undefined;
    mocks.meet.meetings = [];
    mocks.meet.handleUpdateMeeting.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('passes the meeting-page contract through and opens the create-event flow', () => {
    render(<UserMeetingScheduler userId="user-7" />);

    expect(screen.getByTestId('meeting-scheduler-view')).toBeTruthy();
    expect(mocks.viewProps).toMatchObject({
      userId: 'user-7',
      isAuthenticated: true,
      isOwner: true,
      currentViewTitle: 'August 2026',
      view: 'month',
    });

    act(() => props().openCreateEventFlow());
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/create/event',
      search: { eventType: 'meeting' },
    });
  });

  it('derives save eligibility from every form boundary and resets all fields', () => {
    render(<UserMeetingScheduler userId="user-7" />);
    expect(props().canSaveMeeting).toBe(false);

    act(() => props().setEditDate(new Date('2026-08-20T00:00:00Z')));
    expect(props().canSaveMeeting).toBe(false);
    act(() => props().setEditTitle('  Assembly  '));
    expect(props().canSaveMeeting).toBe(true);
    act(() => props().setEditTime(''));
    expect(props().canSaveMeeting).toBe(false);
    act(() => {
      props().setEditTime('10:30');
      props().setEditDuration('14');
    });
    expect(props().canSaveMeeting).toBe(false);
    act(() => props().setEditDuration('15'));
    expect(props().canSaveMeeting).toBe(true);

    act(() => {
      props().setEditingMeetingId('meeting-1');
      props().setEditDescription('Description');
      props().setEditType('public-meeting');
      props().setEditMaxBookings('25');
      props().setEditLocation('Hall');
      props().setEditLocationUrl('https://meet.example');
      props().setEditingRecurringSeries(true);
      props().setIsEditDialogOpen(true);
    });
    act(() => props().resetEditForm());

    expect(props()).toMatchObject({
      editingMeetingId: null,
      editTitle: '',
      editDescription: '',
      editTime: '09:00',
      editDuration: '60',
      editType: 'one-on-one',
      editMaxBookings: '1',
      editLocation: '',
      editLocationUrl: '',
      editingRecurringSeries: false,
    });
    expect(props().editDate).toBeUndefined();
  });

  it('ignores missing meetings and populates complete and fallback edit forms', () => {
    const view = render(<UserMeetingScheduler userId="user-7" />);
    act(() =>
      props().openEditDialog({
        parentEventId: 'missing',
        startDate: Date.parse('2026-08-20T09:00:00Z'),
        endDate: Date.parse('2026-08-20T10:00:00Z'),
        title: 'Missing',
      })
    );
    expect(props().isEditDialogOpen).toBe(false);

    mocks.meet.meetings = [
      {
        id: 'meeting-complete',
        start_date: Date.parse('2026-08-20T09:00:00Z'),
        end_date: Date.parse('2026-08-20T10:30:00Z'),
        title: 'Council',
        description: 'Discuss plans',
        meeting_type: 'public-meeting',
        max_bookings: 20,
        location_name: 'City Hall',
        location_url: 'https://hall.example',
        is_recurring: true,
      },
    ];
    view.rerender(<UserMeetingScheduler userId="user-7" />);
    act(() =>
      props().openEditDialog({
        parentEventId: 'meeting-complete',
        startDate: 0,
        endDate: 0,
        title: 'Fallback title',
      })
    );
    expect(props()).toMatchObject({
      editingMeetingId: 'meeting-complete',
      editTitle: 'Council',
      editDescription: 'Discuss plans',
      editDuration: '90',
      editType: 'public-meeting',
      editMaxBookings: '20',
      editLocation: 'City Hall',
      editLocationUrl: 'https://hall.example',
      editingRecurringSeries: true,
      isEditDialogOpen: true,
    });

    act(() => props().handleEditDialogOpenChange(false));
    expect(props().editingMeetingId).toBeNull();
    act(() => props().handleEditDialogOpenChange(true));
    expect(props().isEditDialogOpen).toBe(true);

    mocks.meet.meetings = [
      {
        id: 'meeting-fallback',
        start_date: null,
        end_date: null,
        title: null,
        description: null,
        meeting_type: null,
        max_bookings: null,
        location_name: null,
        location_url: null,
        is_recurring: false,
      },
    ];
    view.rerender(<UserMeetingScheduler userId="user-7" />);
    const instant = Date.parse('2026-08-21T12:00:00Z');
    act(() =>
      props().openEditDialog({
        parentEventId: 'meeting-fallback',
        startDate: instant,
        endDate: instant,
        title: 'Instance title',
      })
    );
    expect(props()).toMatchObject({
      editingMeetingId: 'meeting-fallback',
      editTitle: 'Instance title',
      editDuration: '60',
      editType: 'one-on-one',
      editMaxBookings: '1',
      editLocation: '',
      editLocationUrl: '',
      editingRecurringSeries: false,
    });
  });

  it('guards incomplete submissions and normalizes one-on-one and public booking limits', async () => {
    const view = render(<UserMeetingScheduler userId="user-7" />);
    await act(async () => props().handleSubmitEdit());
    expect(mocks.meet.handleUpdateMeeting).not.toHaveBeenCalled();

    act(() => props().setEditingMeetingId('meeting-1'));
    await act(async () => props().handleSubmitEdit());
    expect(mocks.meet.handleUpdateMeeting).not.toHaveBeenCalled();

    act(() => {
      props().setEditDate(new Date('2026-08-22T00:00:00Z'));
      props().setEditTitle('   ');
    });
    await act(async () => props().handleSubmitEdit());
    expect(mocks.meet.handleUpdateMeeting).not.toHaveBeenCalled();

    act(() => {
      props().setEditTitle('  Personal meeting  ');
      props().setEditTime('13:45');
      props().setEditDuration('30');
      props().setEditType('one-on-one');
      props().setEditMaxBookings('99');
    });
    await act(async () => props().handleSubmitEdit());
    expect(mocks.meet.handleUpdateMeeting).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'meeting-1',
        title: 'Personal meeting',
        durationMinutes: 30,
        maxBookings: 1,
      })
    );
    expect(props().editingMeetingId).toBeNull();

    mocks.meet.meetings = [
      {
        id: 'meeting-public',
        start_date: Date.parse('2026-08-23T10:00:00Z'),
        end_date: Date.parse('2026-08-23T11:00:00Z'),
        title: 'Public',
        meeting_type: 'public-meeting',
      },
    ];
    view.rerender(<UserMeetingScheduler userId="user-7" />);
    act(() =>
      props().openEditDialog({
        parentEventId: 'meeting-public',
        startDate: 0,
        endDate: 0,
        title: 'Public',
      })
    );
    act(() => props().setEditMaxBookings('0'));
    await act(async () => props().handleSubmitEdit());
    expect(mocks.meet.handleUpdateMeeting).toHaveBeenLastCalledWith(
      expect.objectContaining({ meetingType: 'public-meeting', maxBookings: 10 })
    );

    act(() =>
      props().openEditDialog({
        parentEventId: 'meeting-public',
        startDate: 0,
        endDate: 0,
        title: 'Public',
      })
    );
    act(() => props().setEditMaxBookings('3'));
    await act(async () => props().handleSubmitEdit());
    expect(mocks.meet.handleUpdateMeeting).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxBookings: 3 })
    );
  });
});

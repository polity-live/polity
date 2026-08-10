/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const names = [
    'create',
    'createFull',
    'update',
    'cancel',
    'createOfflineParticipant',
    'updateOfflineParticipant',
    'deleteOfflineParticipant',
    'importOfflineParticipants',
    'joinEvent',
    'inviteParticipant',
    'leaveEvent',
    'updateParticipant',
    'addParticipantRole',
    'removeParticipantRole',
    'syncParticipantRoles',
    'finalizeDelegates',
    'createRole',
    'updateRole',
    'deleteRole',
    'createException',
    'updateException',
    'deleteException',
    'bookMeeting',
    'cancelMeetingBooking',
  ];
  const mutators = Object.fromEntries(
    names.map(name => [name, vi.fn((args: unknown) => ({ name, args }))])
  ) as Record<string, ReturnType<typeof vi.fn>>;
  const mutationResult = {
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  };
  return {
    mutators,
    mutationResult,
    mutate: vi.fn(() => mutationResult),
    onServerError: vi.fn(),
    trackCreationUnlessSilent: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: { events: mocks.mutators } }));
vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (...args: unknown[]) => mocks.onServerError(...args),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: (...args: unknown[]) => mocks.trackCreationUnlessSilent(...args),
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

import { useEventActions } from '../useEventActions';
import { useMeetingActions } from '../useMeetingActions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutate.mockReturnValue(mocks.mutationResult);
});

afterEach(cleanup);

describe('event action hooks', () => {
  it('dispatches every event command and executes all feedback callbacks', () => {
    const { result } = renderHook(() => useEventActions());
    const args = { id: 'row-1', event_id: 'event-1', event: { id: 'event-1' } } as never;

    act(() => {
      result.current.createEvent(args);
      result.current.createFullEvent(args);
      result.current.updateEvent(args);
      result.current.updateEvent(args, { monitorServerError: false });
      result.current.cancelEvent(args);
      result.current.createOfflineParticipant(args);
      result.current.updateOfflineParticipant(args);
      result.current.deleteOfflineParticipant(args);
      result.current.importOfflineParticipants(args);
      result.current.joinEvent(args);
      result.current.inviteParticipant(args);
      result.current.leaveEvent(args);
      result.current.updateParticipant(args);
      result.current.addParticipantRole(args);
      result.current.removeParticipantRole(args);
      result.current.syncParticipantRoles(args);
      result.current.finalizeDelegates(args);
      result.current.createRole(args);
      result.current.updateRole(args);
      result.current.deleteRole(args);
      result.current.createException(args);
      result.current.updateException(args);
      result.current.deleteException(args);
    });

    expect(mocks.mutate).toHaveBeenCalledTimes(23);
    expect(mocks.trackCreationUnlessSilent).toHaveBeenCalledTimes(6);
    for (const callback of mocks.onServerError.mock.calls.map(call => call[1])) callback();
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('normalizes omitted meeting instances and handles explicit instances', () => {
    const { result } = renderHook(() => useMeetingActions());

    act(() => {
      result.current.bookMeeting('event-1');
      result.current.bookMeeting('event-1', 123);
      result.current.cancelMeetingBooking('event-1', null);
      result.current.cancelMeetingBooking('event-1', 456);
    });

    expect(mocks.mutators.bookMeeting).toHaveBeenNthCalledWith(1, {
      event_id: 'event-1',
      instance_date: null,
    });
    expect(mocks.mutators.bookMeeting).toHaveBeenNthCalledWith(2, {
      event_id: 'event-1',
      instance_date: 123,
    });
    for (const callback of mocks.onServerError.mock.calls.map(call => call[1])) callback();
    expect(mocks.toastError).toHaveBeenCalled();
  });
});

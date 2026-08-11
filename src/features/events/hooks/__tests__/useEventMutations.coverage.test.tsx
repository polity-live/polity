/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ATTENDANCE_MODE_CHANGE_LOCKED_MESSAGE } from '@/zero/events/attendance-mode';
import { useEventMutations } from '../useEventMutations';

const mocks = vi.hoisted(() => ({
  inviteParticipant: vi.fn(),
  updateParticipant: vi.fn(),
  syncParticipantRoles: vi.fn(),
  leaveEvent: vi.fn(),
  updateEvent: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  serverConfirmed: vi.fn(async (value: unknown) => await value),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    inviteParticipant: mocks.inviteParticipant,
    updateParticipant: mocks.updateParticipant,
    syncParticipantRoles: mocks.syncParticipantRoles,
    leaveEvent: mocks.leaveEvent,
    updateEvent: mocks.updateEvent,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
  serverConfirmed: mocks.serverConfirmed,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  for (const operation of [
    mocks.inviteParticipant,
    mocks.updateParticipant,
    mocks.syncParticipantRoles,
    mocks.leaveEvent,
    mocks.updateEvent,
  ]) {
    operation.mockResolvedValue(undefined);
  }
});

describe('useEventMutations coverage', () => {
  it('normalizes invite roles and handles empty and failed invitations', async () => {
    const { result } = renderHook(() => useEventMutations('event-1'));
    await expect(result.current.inviteParticipants([])).resolves.toEqual({
      success: false,
      error: 'No users selected',
    });

    await act(async () => {
      await expect(
        result.current.inviteParticipants(
          ['user-1', 'user-2'],
          ['role-1', '', 'role-2'],
          'sender',
          'Title'
        )
      ).resolves.toEqual({ success: true });
    });
    expect(mocks.inviteParticipant).toHaveBeenCalledTimes(2);
    expect(mocks.inviteParticipant).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ user_id: 'user-1', initial_role_ids: ['role-1', 'role-2'] })
    );

    await act(async () => {
      await result.current.inviteParticipants(['user-3'], 'role-3');
      await result.current.inviteParticipants(['user-4'], '');
    });
    expect(mocks.inviteParticipant).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ initial_role_ids: ['role-3'] })
    );
    expect(mocks.inviteParticipant).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ initial_role_ids: [] })
    );

    const failure = new Error('invite failed');
    mocks.inviteParticipant.mockRejectedValueOnce(failure);
    await act(async () => {
      await expect(result.current.inviteParticipants(['user-5'])).resolves.toEqual({
        success: false,
        error: failure,
      });
    });
    expect(mocks.error).toHaveBeenCalled();
  });

  it('approves, rejects, removes, and changes roles on success and failure', async () => {
    const { result } = renderHook(() => useEventMutations('event-1'));
    await act(async () => {
      await expect(
        result.current.approveParticipation('participation-1', 'user', 'sender', 'Title')
      ).resolves.toEqual({ success: true });
      await expect(
        result.current.rejectParticipation('participation-2', 'user', 'sender', 'Title')
      ).resolves.toEqual({ success: true });
      await expect(
        result.current.removeParticipant('participation-3', 'user', 'sender', 'Title')
      ).resolves.toEqual({ success: true });
      await expect(
        result.current.changeParticipantRole(
          'participation-4',
          'role-1',
          'user',
          'sender',
          'Title',
          true
        )
      ).resolves.toEqual({ success: true });
      await expect(result.current.changeParticipantRole('participation-5', '')).resolves.toEqual({
        success: true,
      });
      await expect(
        result.current.changeParticipantRoles(
          'participation-6',
          ['role-2'],
          'user',
          undefined,
          'Title',
          false
        )
      ).resolves.toEqual({ success: true });
    });
    expect(mocks.updateParticipant).toHaveBeenCalledWith({
      id: 'participation-1',
      status: 'active',
    });
    expect(mocks.leaveEvent).toHaveBeenCalledTimes(2);
    expect(mocks.syncParticipantRoles).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role_ids: ['role-1'], assigned_by_id: 'sender' })
    );
    expect(mocks.syncParticipantRoles).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role_ids: [], assigned_by_id: null })
    );

    for (const [operation, call] of [
      [mocks.updateParticipant, () => result.current.approveParticipation('failed-approve')],
      [mocks.leaveEvent, () => result.current.rejectParticipation('failed-reject')],
      [mocks.leaveEvent, () => result.current.removeParticipant('failed-remove')],
      [mocks.syncParticipantRoles, () => result.current.changeParticipantRoles('failed-role', [])],
    ] as const) {
      const failure = new Error('failed');
      operation.mockRejectedValueOnce(failure);
      await act(async () => {
        await expect(call()).resolves.toEqual({ success: false, error: failure });
      });
    }
    expect(mocks.error).toHaveBeenCalledTimes(4);
  });

  it('updates events and distinguishes locked, ordinary, and non-Error failures', async () => {
    const { result } = renderHook(() => useEventMutations('event-1'));
    await act(async () => {
      await expect(
        result.current.updateEvent(
          { title: 'Updated' },
          { actorId: 'actor', eventTitle: 'Old title', visibility: 'public' }
        )
      ).resolves.toEqual({ success: true });
    });
    expect(mocks.updateEvent).toHaveBeenCalledWith(
      { id: 'event-1', title: 'Updated' },
      { monitorServerError: false }
    );
    expect(mocks.serverConfirmed).toHaveBeenCalled();

    for (const failure of [
      new Error(ATTENDANCE_MODE_CHANGE_LOCKED_MESSAGE),
      new Error('ordinary'),
      'non-error',
    ]) {
      mocks.updateEvent.mockRejectedValueOnce(failure);
      await act(async () => {
        await expect(result.current.updateEvent({ title: 'Failed' })).resolves.toEqual({
          success: false,
          error: failure,
        });
      });
    }
    expect(mocks.error.mock.calls.at(-3)?.[0]).toContain('attendanceModeLockedDescription');
    expect(mocks.error.mock.calls.at(-2)?.[0]).toContain('failed_to_update_event');
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('failed_to_update_event');
  });
});

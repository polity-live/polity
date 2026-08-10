/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventParticipation } from '../useEventParticipation';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  event: null as any,
  eventLoading: false,
  participants: [] as any[],
  participantsLoading: false,
  byIdArgs: [] as unknown[],
  participantArgs: [] as unknown[],
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  updateParticipant: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    joinEvent: mocks.joinEvent,
    leaveEvent: mocks.leaveEvent,
    updateParticipant: mocks.updateParticipant,
  }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventById: (id: unknown) => {
    mocks.byIdArgs.push(id);
    return { event: mocks.event, isLoading: mocks.eventLoading };
  },
  useEventParticipantsQuery: (id: unknown) => {
    mocks.participantArgs.push(id);
    return { participants: mocks.participants, isLoading: mocks.participantsLoading };
  },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    event_type: 'open',
    visibility: 'private',
    group: { id: 'group-1', memberships: [] },
    delegates: [],
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.event = event();
  mocks.eventLoading = false;
  mocks.participants = [];
  mocks.participantsLoading = false;
  mocks.byIdArgs = [];
  mocks.participantArgs = [];
  for (const operation of [mocks.joinEvent, mocks.leaveEvent, mocks.updateParticipant]) {
    operation.mockResolvedValue(undefined);
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useEventParticipation coverage', () => {
  it('derives projected and queried statuses, counts, memberships, and delegates', () => {
    const projected = {
      event: event({
        event_type: 'general_assembly',
        group: {
          id: 'group-1',
          memberships: [
            { user: { id: 'other' }, user_id: 'user-1', status: 'member' },
            { user: { id: 'user-1' }, status: 'inactive' },
            { user: { id: 'user-1' }, status: 'admin' },
          ],
        },
        delegates: [
          { user: { id: 'other' }, user_id: 'user-1', status: 'confirmed' },
          { user: { id: 'user-1' }, status: 'pending' },
        ],
      }),
      participants: [
        { id: 'mine', user_id: 'user-1', status: 'admin' },
        { id: 'active', user_id: 'two', status: 'active' },
        { id: 'member', user_id: 'three', status: 'member' },
        { id: 'confirmed', user_id: 'four', status: 'confirmed' },
        { id: 'invited', user_id: 'five', status: 'invited' },
        { id: 'requested', user_id: 'six', status: 'requested' },
      ],
      participantCount: 99,
      isLoading: true,
    } as any;
    const { result } = renderHook(() => useEventParticipation('event-1', projected));
    expect(mocks.byIdArgs).toEqual([undefined]);
    expect(mocks.participantArgs).toEqual([undefined]);
    expect(result.current).toMatchObject({
      status: 'admin',
      isParticipant: true,
      isAdmin: true,
      hasRequested: false,
      isInvited: false,
      participantCount: 99,
      isLoading: true,
      isGroupMember: true,
      isConfirmedDelegate: true,
      canParticipate: true,
    });

    const adminMemberProjection = {
      event: event({
        event_type: 'general_assembly',
        group: { id: 'group-1', memberships: [{ user_id: 'user-1', status: 'admin' }] },
      }),
      participants: [],
      isLoading: false,
    } as any;
    const adminMember = renderHook(() => useEventParticipation('event-1', adminMemberProjection));
    expect(adminMember.result.current.isGroupMember).toBe(true);
    adminMember.unmount();

    mocks.participants = [
      { id: 'mine', user_id: 'user-1', status: 'requested' },
      { id: 'active', user_id: 'two', status: 'active' },
    ];
    const queried = renderHook(() => useEventParticipation('event-1'));
    expect(queried.result.current).toMatchObject({
      status: 'requested',
      hasRequested: true,
      isParticipant: false,
      participantCount: 1,
      isLoading: false,
    });
    queried.unmount();

    mocks.participantsLoading = true;
    const participantsLoading = renderHook(() => useEventParticipation('event-1'));
    expect(participantsLoading.result.current.isLoading).toBe(true);
    participantsLoading.unmount();

    mocks.participants = null as any;
    mocks.participantsLoading = false;
    const absentRows = renderHook(() => useEventParticipation('event-1'));
    expect(absentRows.result.current.participantCount).toBe(0);
  });

  it('guards request attempts for identity, existing rows, invalid ids, and ineligible types', async () => {
    mocks.user = null;
    const anonymous = renderHook(() => useEventParticipation('event-1'));
    await act(async () => anonymous.result.current.requestParticipation());
    expect(mocks.joinEvent).not.toHaveBeenCalled();
    anonymous.unmount();

    mocks.user = { id: 'user-1' };
    mocks.participants = [{ id: 'existing', user_id: 'user-1', status: 'invited' }];
    const existing = renderHook(() => useEventParticipation('event-1'));
    expect(existing.result.current.isInvited).toBe(true);
    await act(async () => existing.result.current.requestParticipation());
    existing.unmount();

    mocks.participants = [];
    const invalid = renderHook(() => useEventParticipation(null as any));
    await act(async () => invalid.result.current.requestParticipation());
    invalid.unmount();

    for (const [type, expectedMessage] of [
      ['delegate_assembly', 'only_confirmed_delegates'],
      ['general_assembly', 'only_members'],
      ['on_invite', 'invitation_only'],
    ]) {
      mocks.event = event({ event_type: type });
      const hook = renderHook(() => useEventParticipation('event-1'));
      await act(async () => hook.result.current.requestParticipation());
      expect(mocks.error.mock.calls.at(-1)?.[0]).toContain(expectedMessage);
      hook.unmount();
    }
    expect(mocks.joinEvent).not.toHaveBeenCalled();
  });

  it('requests eligible participation with relation and fallback fields and reports failures', async () => {
    for (const eligibleEvent of [
      event({ event_type: 'open' }),
      event({
        event_type: 'delegate_assembly',
        delegates: [{ user: { id: 'user-1' }, status: 'confirmed' }],
      }),
      event({
        event_type: 'general_assembly',
        group: { id: 'group-1', memberships: [{ user: { id: 'user-1' }, status: 'active' }] },
      }),
    ]) {
      mocks.event = eligibleEvent;
      const hook = renderHook(() => useEventParticipation('event-1'));
      await act(async () => hook.result.current.requestParticipation());
      hook.unmount();
    }
    expect(mocks.joinEvent).toHaveBeenCalledTimes(3);
    expect(mocks.joinEvent).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-1', visibility: 'private' })
    );

    mocks.event = event({ group: null, visibility: null });
    mocks.joinEvent.mockRejectedValueOnce(new Error('join failed'));
    const failed = renderHook(() => useEventParticipation('event-1'));
    await act(async () => failed.result.current.requestParticipation());
    expect(mocks.joinEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ group_id: null, visibility: 'public' })
    );
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('failed_to_request');
  });

  it('leaves and accepts invitations through guards, success, and failure', async () => {
    const none = renderHook(() => useEventParticipation('event-1'));
    await act(async () => {
      await none.result.current.leaveEvent();
      await none.result.current.acceptInvitation();
    });
    none.unmount();

    mocks.participants = [{ id: 'mine', user_id: 'user-1', status: 'invited' }];
    const invited = renderHook(() => useEventParticipation('event-1'));
    await act(async () => invited.result.current.acceptInvitation());
    expect(mocks.updateParticipant).toHaveBeenCalledWith({ id: 'mine', status: 'active' });
    await act(async () => invited.result.current.leaveEvent());
    expect(mocks.leaveEvent).toHaveBeenCalledWith({ id: 'mine' });
    invited.unmount();

    mocks.updateParticipant.mockRejectedValueOnce(new Error('accept failed'));
    const failedAccept = renderHook(() => useEventParticipation('event-1'));
    await act(async () => failedAccept.result.current.acceptInvitation());
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('failed_to_accept');
    failedAccept.unmount();

    mocks.leaveEvent.mockRejectedValueOnce(new Error('leave failed'));
    const failedLeave = renderHook(() => useEventParticipation('event-1'));
    await act(async () => failedLeave.result.current.leaveEvent());
    expect(mocks.error.mock.calls.at(-1)?.[0]).toContain('failed_to_leave');

    mocks.participants = [{ id: 'mine', user_id: 'user-1', status: 'active' }];
    const active = renderHook(() => useEventParticipation('event-1'));
    await act(async () => active.result.current.acceptInvitation());
    expect(active.result.current.status).toBe('active');
  });
});

/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChangeRequestVoting } from '../useChangeRequestVoting';

const mocks = vi.hoisted(() => ({
  allowed: true,
  changeRequests: [] as any[],
  crLoading: false,
  updateChangeRequest: vi.fn(),
  updateAgendaItem: vi.fn(),
  createTimelineEvent: vi.fn(),
  mutate: vi.fn(),
  triggerSupporterConfirmation: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: () => mocks.allowed }),
}));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ updateChangeRequest: mocks.updateChangeRequest }),
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ updateAgendaItem: mocks.updateAgendaItem }),
}));
vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ createTimelineEvent: mocks.createTimelineEvent }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useChangeRequestsByAmendment: () => ({
    changeRequests: mocks.changeRequests,
    isLoading: mocks.crLoading,
  }),
}));
vi.mock('@/features/amendments/hooks/useSupportConfirmation', () => ({
  triggerSupporterConfirmation: (...args: unknown[]) =>
    mocks.triggerSupporterConfirmation(args[0], args[1]),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(args[0]),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.crLoading = false;
  mocks.changeRequests = [
    { id: 'cr-next', title: 'Next', status: 'pending', voting_status: '', created_at: 2 },
    { id: 'cr-active', title: 'Active', status: 'pending', voting_status: 'voting', created_at: 1 },
    { id: 'cr-done', title: 'Done', status: 'approved', voting_status: 'approved', created_at: 0 },
  ];
  mocks.updateChangeRequest.mockResolvedValue(undefined);
  mocks.updateAgendaItem.mockResolvedValue(undefined);
  mocks.createTimelineEvent.mockResolvedValue(undefined);
  mocks.mutate.mockResolvedValue(undefined);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000010');
});

function subject() {
  return useChangeRequestVoting({
    eventId: 'event-1',
    votingSessionId: 'agenda-1',
    userId: 'user-1',
    amendmentId: 'amendment-1',
  });
}

describe('useChangeRequestVoting', () => {
  it('sorts the pending queue and advances or closes it with permission checks', async () => {
    const { result, rerender } = renderHook(subject);
    expect(result.current).toMatchObject({
      currentChangeRequest: expect.objectContaining({ id: 'cr-active' }),
      currentIndex: 0,
      totalChangeRequests: 2,
      progress: 0.5,
      canManage: true,
      canVote: true,
    });
    await act(async () => result.current.startChangeRequestVote('cr-active'));
    expect(mocks.updateChangeRequest).toHaveBeenCalledWith({
      id: 'cr-active',
      voting_status: 'voting',
    });
    expect(mocks.createTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'change_request_voting_started' })
    );
    await expect(result.current.moveToNextChangeRequest()).resolves.toEqual({
      hasNext: true,
      nextId: 'cr-next',
    });

    mocks.allowed = false;
    rerender();
    await expect(result.current.startChangeRequestVote('cr-next')).rejects.toThrow(
      'Permission denied'
    );
  });

  it('casts once, resolves the active request, and skips through the same mutation boundary', async () => {
    const { result } = renderHook(subject);
    await expect(result.current.castVote('accept')).resolves.toBe(
      '00000000-0000-4000-8000-000000000010'
    );
    const resolution = await result.current.completeChangeRequestVote(50, 'simple', 3);
    expect(resolution).toMatchObject({ passed: false, quorumReached: false, result: 'tie' });
    expect(mocks.updateChangeRequest).toHaveBeenCalledWith({
      id: 'cr-active',
      status: 'rejected',
      voting_status: 'rejected',
    });
    expect(mocks.createTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'change_request_resolved' })
    );
    await act(async () => result.current.skipChangeRequest());
    expect(mocks.updateChangeRequest).toHaveBeenCalledWith({ id: 'cr-active', status: 'skipped' });
  });

  it('handles loading, missing rows, null timestamps, and an absent amendment id', async () => {
    mocks.crLoading = true;
    mocks.changeRequests = undefined as never;
    const empty = renderHook(() =>
      useChangeRequestVoting({ eventId: 'event-1', votingSessionId: 'agenda-1', userId: 'user-1' })
    );
    expect(empty.result.current).toMatchObject({
      isLoading: true,
      changeRequests: [],
      progress: 0,
    });
    await expect(empty.result.current.castVote('accept')).rejects.toThrow(
      'No active change request'
    );
    await expect(empty.result.current.skipChangeRequest()).resolves.toEqual({
      hasNext: false,
      nextId: null,
    });

    mocks.crLoading = false;
    mocks.changeRequests = [
      { id: 'later', title: 'Later', status: 'pending', voting_status: '', created_at: null },
      {
        id: 'active',
        title: 'Active',
        status: 'pending',
        voting_status: 'voting',
        created_at: undefined,
      },
    ];
    const noAmendment = renderHook(() =>
      useChangeRequestVoting({ eventId: 'event-1', votingSessionId: 'agenda-1', userId: 'user-1' })
    );
    await noAmendment.result.current.startChangeRequestVote('active');
    await noAmendment.result.current.completeChangeRequestVote(0, 'absolute', 0);
    expect(mocks.createTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ amendmentId: '' }),
        amendment_id: '',
      })
    );
  });

  it('closes the queue after the final request', async () => {
    mocks.changeRequests = [
      { id: 'only', title: 'Only', status: 'pending', voting_status: 'voting', created_at: 1 },
    ];
    const { result } = renderHook(subject);
    await expect(result.current.moveToNextChangeRequest()).resolves.toEqual({
      hasNext: false,
      nextId: null,
    });
    expect(mocks.updateAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({ voting_phase: 'closed', completed_at: expect.any(Number) })
    );
  });

  it('enforces management and voting permissions on every action', async () => {
    mocks.allowed = false;
    const { result } = renderHook(subject);
    await expect(result.current.moveToNextChangeRequest()).rejects.toThrow('Permission denied');
    await expect(result.current.castVote('accept')).rejects.toThrow('Permission denied');
    await expect(result.current.completeChangeRequestVote(50, undefined, 3)).rejects.toThrow(
      'Permission denied'
    );
    await expect(result.current.skipChangeRequest()).rejects.toThrow('Permission denied');
  });

  it('rejects completion without an active request', async () => {
    mocks.changeRequests = [{ id: 'pending', status: 'pending', voting_status: '', created_at: 1 }];
    const { result } = renderHook(subject);
    await expect(result.current.completeChangeRequestVote(50, 'two_thirds', 3)).rejects.toThrow(
      'No active change request'
    );
  });
});

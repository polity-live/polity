/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventState: {
    event: null as any,
    isLoading: false,
  },
  user: { id: 'user-1' } as { id: string } | null,
  canManage: true,
  reportTutorialAction: vi.fn(),
  tutorialIsActive: vi.fn(() => true),
  serverConfirmed: vi.fn(async (_result: unknown) => undefined),
  trackServerFinalization: vi.fn(),
  updateAgendaItem: vi.fn((args: unknown) => ({ kind: 'agenda', args })),
  updateEvent: vi.fn((args: unknown) => ({ kind: 'event', args })),
  waitForClientApply: vi.fn(async (_result: unknown) => undefined),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ updateAgendaItem: mocks.updateAgendaItem }),
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({ updateEvent: mocks.updateEvent }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventWithAgendaAndParticipants: () => mocks.eventState,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: () => mocks.canManage }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: mocks.toastError,
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: (result: unknown) => mocks.serverConfirmed(result),
  trackServerFinalization: (result: unknown, options: unknown) =>
    mocks.trackServerFinalization(result, options),
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  isAppTutorialActiveInDocument: () => mocks.tutorialIsActive(),
  reportAppTutorialAction: (detail: unknown) => mocks.reportTutorialAction(detail),
}));

import { useAgendaNavigation } from '../useAgendaNavigation';

const agendaItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'agenda-1',
  title: 'First item',
  type: 'amendment',
  status: 'pending',
  order_index: 1,
  activated_at: null,
  completed_at: null,
  ...overrides,
});

const eventWith = (items: Record<string, unknown>[], currentId: string | null = null) => ({
  id: 'event-1',
  current_agenda_item_id: currentId,
  tutorial_run_id: null,
  agenda_items: items,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventState.event = eventWith([agendaItem()]);
  mocks.eventState.isLoading = false;
  mocks.user = { id: 'user-1' };
  mocks.canManage = true;
  mocks.tutorialIsActive.mockReturnValue(true);
  mocks.serverConfirmed.mockResolvedValue(undefined);
  mocks.waitForClientApply.mockResolvedValue(undefined);
});

describe('useAgendaNavigation', () => {
  it('reports a successful event start even while tutorial metadata is absent', async () => {
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(async () => {
      await result.current.startFirstPendingItem();
    });

    expect(mocks.updateEvent).toHaveBeenCalledWith({
      id: 'event-1',
      current_agenda_item_id: 'agenda-1',
      status: 'active',
    });
    expect(mocks.serverConfirmed).not.toHaveBeenCalled();
    expect(mocks.trackServerFinalization).toHaveBeenCalledTimes(2);
    for (const [, options] of mocks.trackServerFinalization.mock.calls) {
      (options as { onError: (error: Error) => void }).onError(new Error('server rejected'));
    }
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
    expect(mocks.reportTutorialAction).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'event.started',
    });
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('returns an empty loading state when the event agenda has not hydrated', () => {
    mocks.eventState.event = null;
    mocks.eventState.isLoading = true;

    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    expect(result.current).toMatchObject({
      currentAgendaItem: null,
      startableAgendaItem: null,
      currentIndex: -1,
      totalItems: 0,
      isLoading: true,
      hasNextItem: false,
      hasPreviousItem: false,
      hasStartableItem: false,
      canMoveToNextItem: false,
    });
  });

  it('maps, sorts, and selects active items while ignoring completed candidates', () => {
    mocks.eventState.event = eventWith(
      [
        agendaItem({
          id: 'completed-active',
          status: 'active',
          order_index: 4,
          completed_at: 40,
        }),
        agendaItem({
          id: 'active',
          status: 'in-progress',
          order_index: 2,
          activated_at: 20,
        }),
        agendaItem({
          id: 'first',
          order_index: null,
          activated_at: 'not-a-number',
          completed_at: 'not-a-number',
        }),
      ],
      'first'
    );

    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    expect(result.current.currentAgendaItem).toMatchObject({
      id: 'active',
      order: 2,
      activatedAt: 20,
    });
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.totalItems).toBe(3);
    expect(result.current.hasNextItem).toBe(true);
    expect(result.current.hasPreviousItem).toBe(true);
    expect(result.current.hasStartableItem).toBe(false);
  });

  it.each([
    ['active', 'active'],
    ['legacy pointer', 'pending'],
  ])('uses the %s item as the current item', (_label, status) => {
    mocks.eventState.event = eventWith([agendaItem({ status })], 'agenda-1');

    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    expect(result.current.currentAgendaItem?.id).toBe('agenda-1');
  });

  it('rejects a missing current-item pointer', () => {
    mocks.eventState.event = eventWith([agendaItem()], 'missing');

    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    expect(result.current.currentAgendaItem).toBeNull();
  });

  it.each([
    ['completed status', 'completed', null],
    ['completed timestamp', 'pending', 5],
  ])('preserves an explicit %s pointer for next-item navigation', (_label, status, completedAt) => {
    mocks.eventState.event = eventWith(
      [agendaItem({ status, completed_at: completedAt })],
      'agenda-1'
    );

    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    expect(result.current.currentAgendaItem?.id).toBe('agenda-1');
    expect(result.current.isCurrentItemCompleted).toBe(true);
  });

  it('reports when no remaining item can be started', async () => {
    mocks.eventState.event = eventWith([agendaItem({ status: 'completed', completed_at: 10 })]);
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.startFirstPendingItem());

    expect(mocks.toastInfo).toHaveBeenCalled();
    expect(mocks.updateAgendaItem).not.toHaveBeenCalled();
  });

  it.each([
    ['missing user', null, true],
    ['missing permission', { id: 'user-1' }, false],
  ])('rejects activation with %s', async (_label, user, canManage) => {
    mocks.user = user;
    mocks.canManage = canManage;
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.activateAgendaItem('agenda-1'));

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.updateAgendaItem).not.toHaveBeenCalled();
  });

  it('rejects activation of an unknown item', async () => {
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.activateAgendaItem('missing'));

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.updateAgendaItem).not.toHaveBeenCalled();
  });

  it.each([
    ['pending', null, 'pending'],
    ['completed timestamp', 30, 'completed'],
  ])('deactivates the current %s item before activation', async (_label, completedAt, expected) => {
    mocks.tutorialIsActive.mockReturnValue(false);
    mocks.eventState.event = eventWith(
      [
        agendaItem({ id: 'current', status: 'active', completed_at: completedAt }),
        agendaItem({ id: 'next', order_index: 2 }),
      ],
      'current'
    );
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.activateAgendaItem('next'));

    expect(mocks.updateAgendaItem).toHaveBeenNthCalledWith(1, {
      id: 'current',
      status: expected,
    });
    expect(mocks.serverConfirmed).toHaveBeenCalledTimes(3);
    expect(mocks.trackServerFinalization).not.toHaveBeenCalled();
  });

  it('surfaces asynchronous activation failures and restores loading state', async () => {
    const failure = new Error('client apply failed');
    mocks.waitForClientApply.mockRejectedValueOnce(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await expect(
      act(async () => {
        await result.current.activateAgendaItem('agenda-1');
      })
    ).rejects.toThrow('client apply failed');

    expect(result.current.isLoading).toBe(false);
    expect(mocks.toastError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('guards moving next until a completed current item has a successor', async () => {
    mocks.eventState.event = eventWith([agendaItem({ status: 'active' })], 'agenda-1');
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.moveToNextItem());

    expect(mocks.toastInfo).toHaveBeenCalled();

    mocks.eventState.event = eventWith(
      [agendaItem({ status: 'active' }), agendaItem({ id: 'next', order_index: 2 })],
      'agenda-1'
    );
    const incomplete = renderHook(() => useAgendaNavigation('event-1'));
    await act(() => incomplete.result.current.moveToNextItem());

    expect(mocks.toastInfo).toHaveBeenCalledTimes(2);
    expect(mocks.updateAgendaItem).not.toHaveBeenCalled();
  });

  it('moves to the next item after the current item is complete', async () => {
    mocks.eventState.event = eventWith(
      [
        agendaItem({ status: 'active', completed_at: 10 }),
        agendaItem({ id: 'next', order_index: 2 }),
      ],
      'agenda-1'
    );
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.moveToNextItem());

    expect(mocks.updateAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'next', status: 'in-progress' })
    );
  });

  it('guards moving backward and activates the previous item when available', async () => {
    mocks.eventState.event = eventWith([agendaItem({ status: 'active' })], 'agenda-1');
    const first = renderHook(() => useAgendaNavigation('event-1'));
    await act(() => first.result.current.moveToPreviousItem());
    expect(mocks.toastInfo).toHaveBeenCalled();

    mocks.eventState.event = eventWith(
      [agendaItem({ id: 'previous' }), agendaItem({ status: 'active', order_index: 2 })],
      'agenda-1'
    );
    const second = renderHook(() => useAgendaNavigation('event-1'));
    await act(() => second.result.current.moveToPreviousItem());
    expect(mocks.updateAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'previous', status: 'in-progress' })
    );
  });

  it.each([
    ['missing user', null, true, true],
    ['missing permission', { id: 'user-1' }, false, true],
    ['missing current item', { id: 'user-1' }, true, false],
  ])('rejects completion with %s', async (_label, user, canManage, hasCurrent) => {
    mocks.user = user;
    mocks.canManage = canManage;
    mocks.eventState.event = hasCurrent
      ? eventWith([agendaItem({ status: 'active' })], 'agenda-1')
      : eventWith([agendaItem()]);
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.completeCurrentItem());

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.updateAgendaItem).not.toHaveBeenCalled();
  });

  it.each([
    ['existing activation time', 25],
    ['fallback activation time', null],
  ])('completes the current item with %s', async (_label, activatedAt) => {
    mocks.eventState.event = eventWith(
      [agendaItem({ status: 'active', activated_at: activatedAt })],
      'agenda-1'
    );
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(() => result.current.completeCurrentItem());

    expect(mocks.updateAgendaItem).toHaveBeenCalledWith({
      id: 'agenda-1',
      status: 'completed',
      start_time: expect.any(Number),
      end_time: expect.any(Number),
      completed_at: expect.any(Number),
    });
    expect(mocks.updateEvent).toHaveBeenCalledWith({
      id: 'event-1',
      current_agenda_item_id: null,
    });
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('surfaces completion failures and restores loading state', async () => {
    mocks.eventState.event = eventWith([agendaItem({ status: 'active' })], 'agenda-1');
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('completion failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await expect(
      act(async () => {
        await result.current.completeCurrentItem();
      })
    ).rejects.toThrow('completion failed');

    expect(result.current.isLoading).toBe(false);
    expect(mocks.toastError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

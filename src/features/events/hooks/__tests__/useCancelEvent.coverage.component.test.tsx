/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCancelEvent } from '../useCancelEvent';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  event: null as any,
  cancelEvent: vi.fn(),
  updateAgendaItem: vi.fn(),
  updateRole: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({ cancelEvent: mocks.cancelEvent }),
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ updateAgendaItem: mocks.updateAgendaItem }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ updateRole: mocks.updateRole }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventForCancel: () => ({ event: mocks.event }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.event = null;
  mocks.cancelEvent.mockResolvedValue(undefined);
  mocks.updateAgendaItem.mockResolvedValue(undefined);
  mocks.updateRole.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useCancelEvent coverage', () => {
  it('normalizes and sorts every agenda-item variant', () => {
    mocks.event = {
      agenda_items: [
        {
          amendment: { id: 'amendment-1', title: null },
          election: [],
          id: 'later',
          order_index: 3,
          title: null,
        },
        {
          election: [{ id: 'election-1', role: { id: 'role-1', name: null } }],
          id: 'first',
          order_index: null,
          title: 'First',
        },
        {
          election: [{ id: 'election-2', role: null }],
          id: 'middle',
          order_index: 2,
          title: 'Middle',
        },
      ],
    };

    const { result } = renderHook(() => useCancelEvent('event-1'));

    expect(result.current.agendaItems).toEqual([
      {
        amendment: undefined,
        election: {
          id: 'election-1',
          role: { id: 'role-1', name: '' },
        },
        id: 'first',
        order_index: 0,
        title: 'First',
      },
      {
        amendment: undefined,
        election: { id: 'election-2', role: undefined },
        id: 'middle',
        order_index: 2,
        title: 'Middle',
      },
      {
        amendment: { id: 'amendment-1', title: '' },
        election: undefined,
        id: 'later',
        order_index: 3,
        title: '',
      },
    ]);
  });

  it('returns an empty agenda and guards both actions for anonymous users', async () => {
    mocks.user = null;
    mocks.event = { agenda_items: null };
    const { result } = renderHook(() => useCancelEvent('event-1'));
    expect(result.current.agendaItems).toEqual([]);

    await act(() => result.current.cancelEvent({ eventId: 'event-1', reason: 'reason' }));
    await act(() =>
      result.current.scheduleRevote('role-1', new Date('2026-08-10'), 'group-1', 'Group', 'Role')
    );
    expect(mocks.cancelEvent).not.toHaveBeenCalled();
    expect(mocks.updateRole).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledTimes(2);
  });

  it('cancels and sequentially reassigns selected agenda items', async () => {
    const { result } = renderHook(() => useCancelEvent('event-1'));

    await act(() =>
      result.current.cancelEvent({
        eventId: 'event-1',
        reason: 'Rescheduled',
        reassignToEventId: 'event-2',
        itemsToReassign: ['item-1', 'item-2'],
      })
    );

    expect(mocks.cancelEvent).toHaveBeenCalledWith({
      id: 'event-1',
      cancel_reason: 'Rescheduled',
    });
    expect(mocks.updateAgendaItem).toHaveBeenNthCalledWith(1, {
      id: 'item-1',
      event_id: 'event-2',
      order_index: 1,
    });
    expect(mocks.updateAgendaItem).toHaveBeenNthCalledWith(2, {
      id: 'item-2',
      event_id: 'event-2',
      order_index: 2,
    });
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(result.current.isLoading).toBe(false);
  });

  it('cancels without reassignment for missing and empty item selections', async () => {
    const { result } = renderHook(() => useCancelEvent('event-1'));
    await act(() =>
      result.current.cancelEvent({
        eventId: 'event-1',
        reason: 'No target',
        itemsToReassign: ['item-1'],
      })
    );
    await act(() =>
      result.current.cancelEvent({
        eventId: 'event-1',
        reason: 'No items',
        reassignToEventId: 'event-2',
        itemsToReassign: [],
      })
    );
    await act(() =>
      result.current.cancelEvent({
        eventId: 'event-1',
        reason: 'Undefined items',
        reassignToEventId: 'event-2',
      })
    );
    expect(mocks.updateAgendaItem).not.toHaveBeenCalled();
  });

  it('reports and rethrows cancellation and revote errors', async () => {
    const cancelError = new Error('cancel failed');
    mocks.cancelEvent.mockRejectedValueOnce(cancelError);
    const { result } = renderHook(() => useCancelEvent('event-1'));

    await expect(
      act(() => result.current.cancelEvent({ eventId: 'event-1', reason: 'reason' }))
    ).rejects.toBe(cancelError);
    expect(result.current.isLoading).toBe(false);

    const revoteError = new Error('revote failed');
    mocks.updateRole.mockRejectedValueOnce(revoteError);
    await expect(
      act(() =>
        result.current.scheduleRevote(
          'role-1',
          new Date('2026-08-10T12:00:00Z'),
          'group-1',
          'Group',
          'Role'
        )
      )
    ).rejects.toBe(revoteError);
    expect(mocks.error).toHaveBeenCalledTimes(2);
  });

  it('schedules a revote and exposes loading while the mutation is pending', async () => {
    let finish!: () => void;
    mocks.updateRole.mockReturnValueOnce(new Promise<void>(resolve => (finish = resolve)));
    const { result } = renderHook(() => useCancelEvent('event-1'));
    const revoteDate = new Date('2026-08-11T14:30:00Z');
    let pending!: Promise<void>;

    act(() => {
      pending = result.current.scheduleRevote('role-1', revoteDate, 'group-1', 'Group', 'Role');
    });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    finish();
    await act(() => pending);

    expect(mocks.updateRole).toHaveBeenCalledWith({
      id: 'role-1',
      scheduled_revote_date: revoteDate.getTime(),
    });
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(result.current.isLoading).toBe(false);
  });
});

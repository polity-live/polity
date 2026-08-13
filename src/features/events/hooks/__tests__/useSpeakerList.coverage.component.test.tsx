/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSpeakerList } from '../useSpeakerList';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  canJoin: true,
  addSpeaker: vi.fn(),
  removeSpeaker: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ can: vi.fn() }) }));
vi.mock('@/features/agendas/logic/speakerListPermissions', () => ({
  canJoinEventSpeakerList: () => mocks.canJoin,
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ addSpeaker: mocks.addSpeaker, removeSpeaker: mocks.removeSpeaker }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.canJoin = true;
  mocks.addSpeaker.mockResolvedValue(undefined);
  mocks.removeSpeaker.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSpeakerList coverage', () => {
  it('guards identity, agenda, and permission and defaults permission without an event', async () => {
    mocks.user = null;
    const anonymous = renderHook(() => useSpeakerList('agenda-1', 'event-1'));
    await act(async () => anonymous.result.current.handleAddToSpeakerList());
    await act(async () => anonymous.result.current.handleRemoveFromSpeakerList('speaker-1'));
    anonymous.unmount();

    mocks.user = { id: 'user-1' };
    const missingAgenda = renderHook(() => useSpeakerList(undefined, 'event-1'));
    await act(async () => missingAgenda.result.current.handleAddToSpeakerList());
    missingAgenda.unmount();

    mocks.canJoin = false;
    const denied = renderHook(() => useSpeakerList('agenda-1', 'event-1'));
    expect(denied.result.current.canJoinSpeakerList).toBe(false);
    await act(async () => denied.result.current.handleAddToSpeakerList());
    denied.unmount();

    const withoutEvent = renderHook(() => useSpeakerList('agenda-1'));
    expect(withoutEvent.result.current.canJoinSpeakerList).toBe(true);
    await act(async () => withoutEvent.result.current.handleAddToSpeakerList());
    expect(mocks.addSpeaker).toHaveBeenCalled();
  });

  it('adds after empty and ordered lists and removes speakers', async () => {
    const { result } = renderHook(() => useSpeakerList('agenda-1', 'event-1'));
    await act(async () => result.current.handleAddToSpeakerList([]));
    expect(mocks.addSpeaker).toHaveBeenLastCalledWith(
      expect.objectContaining({ order_index: 1, user_id: 'user-1', agenda_item_id: 'agenda-1' })
    );
    await act(async () =>
      result.current.handleAddToSpeakerList([{ order: 4 }, { order: undefined }, { order: 2 }])
    );
    expect(mocks.addSpeaker).toHaveBeenLastCalledWith(expect.objectContaining({ order_index: 5 }));
    await act(async () => result.current.handleRemoveFromSpeakerList('speaker-1'));
    expect(mocks.removeSpeaker).toHaveBeenCalledWith('speaker-1');
    expect(result.current).toMatchObject({ addingSpeaker: false, removingSpeaker: null });
  });

  it('resets state and rethrows add and remove failures', async () => {
    mocks.addSpeaker.mockRejectedValueOnce(new Error('add failed'));
    const { result } = renderHook(() => useSpeakerList('agenda-1', 'event-1'));
    await act(async () => {
      await expect(result.current.handleAddToSpeakerList()).rejects.toThrow('add failed');
    });
    expect(result.current.addingSpeaker).toBe(false);

    mocks.removeSpeaker.mockRejectedValueOnce(new Error('remove failed'));
    await act(async () => {
      await expect(result.current.handleRemoveFromSpeakerList('speaker-1')).rejects.toThrow(
        'remove failed'
      );
    });
    expect(result.current.removingSpeaker).toBeNull();
  });
});

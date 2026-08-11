/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user' } as any,
  confirmations: null as any,
  queryLoading: false,
  update: vi.fn(),
  waitForClientApply: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  createSupportConfirmation: vi.fn((value: any) => ({ kind: 'confirmation', value })),
  createAgendaItem: vi.fn((value: any) => ({ kind: 'agenda', value })),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ updateSupportConfirmation: mocks.update }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    supportConfirmationsByGroup: mocks.confirmations,
    isLoading: mocks.queryLoading,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: any[]) => mocks.waitForClientApply(...args),
}));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    amendments: { createSupportConfirmation: mocks.createSupportConfirmation },
    agendas: { createAgendaItem: mocks.createAgendaItem },
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key),
}));

import {
  createConfirmationAgendaItem,
  triggerSupporterConfirmation,
  useSupportConfirmation,
} from '../useSupportConfirmation';

describe('useSupportConfirmation A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'user' };
    mocks.confirmations = [{ id: 'confirmation' }];
    mocks.queryLoading = false;
    mocks.update.mockImplementation(value => value);
    mocks.waitForClientApply.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('falls back to an empty query and reports query loading', () => {
    mocks.confirmations = null;
    mocks.queryLoading = true;
    const { result } = renderHook(() => useSupportConfirmation('group'));
    expect(result.current.pendingConfirmations).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('guards confirmation and decline for authentication and unknown ids', async () => {
    mocks.user = null;
    const anonymous = renderHook(() => useSupportConfirmation('group'));
    await act(async () => anonymous.result.current.confirmSupport('confirmation'));
    await act(async () => anonymous.result.current.declineSupport('confirmation'));
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
    anonymous.unmount();

    mocks.user = { id: 'user' };
    const missing = renderHook(() => useSupportConfirmation('group'));
    await act(async () => missing.result.current.confirmSupport('missing'));
    await act(async () => missing.result.current.declineSupport('missing'));
    expect(mocks.toastError).toHaveBeenCalledTimes(4);
  });

  it('confirms and declines support successfully', async () => {
    const { result } = renderHook(() => useSupportConfirmation('group'));
    await act(async () => result.current.confirmSupport('confirmation'));
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'confirmation', status: 'confirmed' })
    );
    await act(async () => result.current.declineSupport('confirmation'));
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'confirmation', status: 'declined' })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
  });

  it('rethrows mutation failures and clears local loading', async () => {
    const { result } = renderHook(() => useSupportConfirmation('group'));
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('confirm failed'));
    await expect(act(async () => result.current.confirmSupport('confirmation'))).rejects.toThrow(
      'confirm failed'
    );
    expect(result.current.isLoading).toBe(false);

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('decline failed'));
    await expect(act(async () => result.current.declineSupport('confirmation'))).rejects.toThrow(
      'decline failed'
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('exposes local loading while an update is pending', async () => {
    let resolveApply: (() => void) | undefined;
    mocks.waitForClientApply.mockImplementationOnce(
      () => new Promise<void>(resolve => (resolveApply = resolve))
    );
    const { result } = renderHook(() => useSupportConfirmation('group'));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.confirmSupport('confirmation');
    });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    await act(async () => resolveApply?.());
    await act(async () => pending);
    expect(result.current.isLoading).toBe(false);
  });
});

describe('support confirmation orchestration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing without supporter groups', async () => {
    const mutate = vi.fn();
    await triggerSupporterConfirmation(mutate, {
      amendmentId: 'amendment',
      changeRequestId: 'request',
      userId: 'user',
    });
    await triggerSupporterConfirmation(mutate, {
      amendmentId: 'amendment',
      changeRequestId: 'request',
      userId: 'user',
      supporterGroups: [],
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('creates confirmations and agenda items with explicit and fallback titles', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined);
    await triggerSupporterConfirmation(mutate, {
      amendmentId: 'amendment',
      changeRequestId: 'request',
      userId: 'user',
      amendmentTitle: 'Title',
      supporterGroups: [{ id: 'one' }, { id: 'two' }],
    });
    await triggerSupporterConfirmation(mutate, {
      amendmentId: 'amendment',
      changeRequestId: 'request',
      userId: 'user',
      amendmentTitle: '',
      supporterGroups: [{ id: 'three' }],
    });
    expect(mutate).toHaveBeenCalledTimes(6);
    expect(mocks.createSupportConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'one' })
    );
    expect(mocks.createAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'support_confirmation' })
    );
  });

  it('creates a group event agenda item and returns its id', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined);
    const id = await createConfirmationAgendaItem(mutate, {
      confirmationId: 'confirmation',
      amendmentTitle: 'Title',
      eventId: 'event',
      groupId: 'group',
    });
    expect(id).toEqual(expect.any(String));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'agenda',
        value: expect.objectContaining({ event_id: 'event' }),
      })
    );
  });
});

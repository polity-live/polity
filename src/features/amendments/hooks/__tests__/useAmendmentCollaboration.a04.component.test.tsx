/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user' } as any,
  state: {} as any,
  request: vi.fn(),
  leave: vi.fn(),
  accept: vi.fn(),
  waitForClientApply: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    requestCollaboration: mocks.request,
    leaveCollaboration: mocks.leave,
    acceptInvitation: mocks.accept,
  }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => mocks.state,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: any[]) => mocks.waitForClientApply(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { useAmendmentCollaboration } from '../useAmendmentCollaboration';

describe('useAmendmentCollaboration A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'user' };
    mocks.state = {
      collaboration: null,
      status: null,
      isCollaborator: false,
      isAdmin: false,
      hasRequested: false,
      isInvited: false,
      collaboratorCount: 2,
      isLoading: false,
    };
    mocks.request.mockReturnValue('request-result');
    mocks.leave.mockReturnValue('leave-result');
    mocks.accept.mockReturnValue('accept-result');
    mocks.waitForClientApply.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it('returns facade state and requests collaboration successfully', async () => {
    const { result } = renderHook(() => useAmendmentCollaboration('amendment'));
    expect(result.current.collaboratorCount).toBe(2);
    expect(result.current.isLoading).toBe(false);

    await act(async () => result.current.requestCollaboration());
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'requested',
        user_id: 'user',
        amendment_id: 'amendment',
      })
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('covers request guards, invalid ids, rejection, and pending loading', async () => {
    mocks.user = null;
    const unauthenticated = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => unauthenticated.result.current.requestCollaboration());
    expect(mocks.request).not.toHaveBeenCalled();
    unauthenticated.unmount();

    mocks.user = { id: 'user' };
    mocks.state.collaboration = { id: 'existing' };
    const existing = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => existing.result.current.requestCollaboration());
    expect(mocks.request).not.toHaveBeenCalled();
    existing.unmount();

    mocks.state.collaboration = null;
    const invalid = renderHook(() => useAmendmentCollaboration('' as any));
    await act(async () => invalid.result.current.requestCollaboration());
    expect(mocks.request).not.toHaveBeenCalled();
    invalid.unmount();

    const wrongType = renderHook(() => useAmendmentCollaboration(23 as any));
    await act(async () => wrongType.result.current.requestCollaboration());
    expect(mocks.request).not.toHaveBeenCalled();
    wrongType.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('request failed'));
    const rejected = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => rejected.result.current.requestCollaboration());
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    rejected.unmount();

    let resolveApply: (() => void) | undefined;
    mocks.waitForClientApply.mockImplementationOnce(
      () => new Promise<void>(resolve => (resolveApply = resolve))
    );
    const pending = renderHook(() => useAmendmentCollaboration('amendment'));
    let requestPromise: Promise<void> = Promise.resolve();
    act(() => {
      requestPromise = pending.result.current.requestCollaboration();
    });
    await waitFor(() => expect(pending.result.current.isLoading).toBe(true));
    await act(async () => resolveApply?.());
    await act(async () => requestPromise);
    expect(pending.result.current.isLoading).toBe(false);
  });

  it('leaves directly and handles missing ids and failures', async () => {
    const missing = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => missing.result.current.leaveCollaboration());
    expect(mocks.leave).not.toHaveBeenCalled();
    missing.unmount();

    mocks.state.collaboration = { id: 'collaboration' };
    const success = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => success.result.current.leaveCollaboration());
    expect(mocks.leave).toHaveBeenCalledWith('collaboration');
    success.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('leave failed'));
    const failure = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => failure.result.current.leaveCollaboration());
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('accepts invitations and covers both invitation guards and failure', async () => {
    const missing = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => missing.result.current.acceptInvitation());
    expect(mocks.accept).not.toHaveBeenCalled();
    missing.unmount();

    mocks.state.collaboration = { id: 'collaboration' };
    mocks.state.status = 'active';
    const wrongStatus = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => wrongStatus.result.current.acceptInvitation());
    expect(mocks.accept).not.toHaveBeenCalled();
    wrongStatus.unmount();

    mocks.state.status = 'invited';
    const success = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => success.result.current.acceptInvitation());
    expect(mocks.accept).toHaveBeenCalledWith('collaboration');
    success.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('accept failed'));
    const failure = renderHook(() => useAmendmentCollaboration('amendment'));
    await act(async () => failure.result.current.acceptInvitation());
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['member', true, false, false, false],
    ['admin', true, true, false, false],
    ['active', true, false, false, false],
    ['collaborator', true, false, false, false],
    ['requested', false, false, true, false],
    ['invited', false, false, false, true],
    ['declined', false, false, false, false],
    [undefined, false, false, false, false],
  ])('derives projected status %s', (status, isCollaborator, isAdmin, hasRequested, isInvited) => {
    const projected = {
      collaborations: status === undefined ? [] : [{ id: 'projected', status }],
      collaboratorCount: 7,
      isLoading: true,
    } as any;
    const { result } = renderHook(() => useAmendmentCollaboration('amendment', projected));

    expect(result.current.status).toBe(status ?? null);
    expect(result.current.isCollaborator).toBe(isCollaborator);
    expect(result.current.isAdmin).toBe(isAdmin);
    expect(result.current.hasRequested).toBe(hasRequested);
    expect(result.current.isInvited).toBe(isInvited);
    expect(result.current.collaboratorCount).toBe(7);
    expect(result.current.isLoading).toBe(true);
  });

  it('falls back from absent projected metadata', () => {
    mocks.state.collaboratorCount = 3;
    mocks.state.isLoading = true;
    const projected = {
      collaborations: [{ id: 'projected', status: 'member' }],
      collaboratorCount: null,
      isLoading: null,
    } as any;
    const { result } = renderHook(() => useAmendmentCollaboration('amendment', projected));

    expect(result.current.collaboratorCount).toBe(3);
    expect(result.current.isLoading).toBe(true);
  });
});

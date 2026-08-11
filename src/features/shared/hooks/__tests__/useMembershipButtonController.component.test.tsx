/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useMembershipButtonController } from '../useMembershipButtonController';

function args(overrides: Record<string, unknown> = {}) {
  return {
    actionType: 'join' as const,
    hasRequested: false,
    isInvited: false,
    isMember: false,
    onAcceptInvitation: vi.fn(),
    onLeave: vi.fn(),
    onRequest: vi.fn(),
    ...overrides,
  } as any;
}

describe('useMembershipButtonController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([
    ['join', 'components.actionBar.requestToJoin', 'common.checks.membership'],
    ['participate', 'components.actionBar.requestToParticipate', 'common.checks.participation'],
    ['collaborate', 'components.actionBar.requestCollaboration', 'common.checks.collaboration'],
  ] as const)('builds %s labels and default loading copy', (actionType, request, loading) => {
    const view = renderHook(() => useMembershipButtonController(args({ actionType })));
    expect(view.result.current.labels.request).toBe(request);
    expect(view.result.current.loadingLabel).toBe(loading);
    expect(view.result.current.buttonConfig.onClick).toBeTypeOf('function');
  });

  it('selects invitation, pending, member, and request button configurations', () => {
    const state = args({ isInvited: true, loadingLabel: 'Custom loading' });
    const view = renderHook(props => useMembershipButtonController(props), {
      initialProps: state,
    });
    expect(view.result.current.buttonConfig.label).toBe('components.actionBar.acceptInvitation');
    expect(view.result.current.loadingLabel).toBe('Custom loading');
    act(() => view.result.current.buttonConfig.onClick());
    expect(state.onAcceptInvitation).toHaveBeenCalled();

    const pending = args({ hasRequested: true });
    view.rerender(pending);
    act(() => view.result.current.buttonConfig.onClick());
    expect(pending.onLeave).toHaveBeenCalled();

    const member = args({ isMember: true });
    view.rerender(member);
    act(() => view.result.current.buttonConfig.onClick());
    expect(member.onLeave).toHaveBeenCalled();

    const request = args({ disabledReason: 'Not allowed' });
    view.rerender(request);
    act(() => view.result.current.buttonConfig.onClick());
    expect(request.onRequest).toHaveBeenCalled();
    expect(view.result.current.disabledAriaLabel).toContain('Not allowed');
    view.rerender(args());
    expect(view.result.current.disabledAriaLabel).toBe(view.result.current.buttonConfig.label);
  });

  it('opens on a touch long press and clears every timeout path', () => {
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const view = renderHook(() => useMembershipButtonController(args()));
    act(() => view.result.current.onDisabledPointerDown({ pointerType: 'mouse' } as any));
    act(() => view.result.current.onDisabledPointerDown({ pointerType: 'touch' } as any));
    act(() => vi.advanceTimersByTime(350));
    expect(view.result.current.showDisabledReason).toBe(true);
    act(() => view.result.current.onDisabledPointerUp());
    expect(view.result.current.showDisabledReason).toBe(false);

    act(() => view.result.current.onDisabledReasonOpenChange(true));
    act(() => view.result.current.onDisabledBlur());
    expect(view.result.current.showDisabledReason).toBe(false);
    act(() => view.result.current.onDisabledPointerDown({ pointerType: 'touch' } as any));
    act(() => view.result.current.onDisabledPointerLeave());
    expect(clearTimeout).toHaveBeenCalled();
    act(() => view.result.current.onDisabledPointerDown({ pointerType: 'touch' } as any));
    act(() => view.result.current.onDisabledPointerCancel());
    expect(view.result.current.showDisabledReason).toBe(false);
  });

  it('clears a pending long press during unmount', () => {
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const view = renderHook(() => useMembershipButtonController(args()));
    act(() => view.result.current.onDisabledPointerDown({ pointerType: 'touch' } as any));
    view.unmount();
    expect(clearTimeout).toHaveBeenCalled();
  });
});

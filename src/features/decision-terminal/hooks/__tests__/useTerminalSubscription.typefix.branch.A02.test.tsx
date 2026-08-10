/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ triggerFlash: vi.fn() }));

vi.mock('../useDecisionFlash', () => ({
  useDecisionFlash: () => ({
    flashStates: new Map(),
    triggerFlash: mocks.triggerFlash,
    isFlashing: vi.fn(),
    getFlashState: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

import { useTerminalSubscription } from '../useTerminalSubscription';

afterEach(() => vi.restoreAllMocks());

describe('terminal subscription post-typefix cleanup', () => {
  it('cleans up when the timer host returned a falsy interval handle', () => {
    vi.spyOn(globalThis, 'setInterval').mockReturnValue(0 as unknown as NodeJS.Timeout);
    const subscription = renderHook(() => useTerminalSubscription([], { enabled: true }));

    expect(subscription.result.current.isSubscribed).toBe(true);
    subscription.unmount();
  });
});

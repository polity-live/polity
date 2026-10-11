/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const preload = vi.fn();
  return { cleanup: vi.fn(), preload, zero: { preload } };
});
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => mocks.zero,
}));

import { useDerivedZeroPreloads, useZeroPreloads } from '../preload-registry';

describe('preload registry hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preload.mockReturnValue({ cleanup: mocks.cleanup, complete: Promise.resolve() });
  });

  it('skips empty lists and releases retained entries on unmount', async () => {
    const empty = renderHook(() => useZeroPreloads([]));
    expect(mocks.preload).not.toHaveBeenCalled();
    empty.unmount();

    const populated = renderHook(() => useZeroPreloads([{ key: 'one', query: { id: 'one' } }]));
    expect(mocks.preload).toHaveBeenCalledOnce();
    populated.unmount();
    await Promise.resolve();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it('supports enabled, disabled, and default derived preloads', async () => {
    const entries = [{ key: 'one', query: {} }];
    const enabled = renderHook(() => useDerivedZeroPreloads(entries));
    const disabled = renderHook(() => useDerivedZeroPreloads(entries, false));
    const explicit = renderHook(() => useDerivedZeroPreloads(entries, true));
    expect(mocks.preload).toHaveBeenCalledTimes(1);
    enabled.unmount();
    disabled.unmount();
    explicit.unmount();
    await Promise.resolve();
  });

  it('does not resubscribe when renders create equivalent entry arrays', async () => {
    const hook = renderHook(({ id }) => useZeroPreloads([{ key: id, query: { id } }]), {
      initialProps: { id: 'one' },
    });
    hook.rerender({ id: 'one' });
    expect(mocks.preload).toHaveBeenCalledOnce();
    expect(mocks.cleanup).not.toHaveBeenCalled();
    await Promise.resolve();
    hook.rerender({ id: 'two' });
    expect(mocks.preload).toHaveBeenCalledTimes(2);
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    hook.unmount();
    await Promise.resolve();
  });
});

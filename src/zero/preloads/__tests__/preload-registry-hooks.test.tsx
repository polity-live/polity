/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cleanup: vi.fn(), preload: vi.fn() }));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ preload: mocks.preload }),
}));

import { useDerivedZeroPreloads, useZeroPreloads } from '../preload-registry';

describe('preload registry hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preload.mockReturnValue({ cleanup: mocks.cleanup, complete: Promise.resolve() });
  });

  it('skips empty lists and releases retained entries on unmount', () => {
    const empty = renderHook(() => useZeroPreloads([]));
    expect(mocks.preload).not.toHaveBeenCalled();
    empty.unmount();

    const populated = renderHook(() => useZeroPreloads([{ key: 'one', query: { id: 'one' } }]));
    expect(mocks.preload).toHaveBeenCalledOnce();
    populated.unmount();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it('supports enabled, disabled, and default derived preloads', () => {
    const entries = [{ key: 'one', query: {} }];
    const enabled = renderHook(() => useDerivedZeroPreloads(entries));
    const disabled = renderHook(() => useDerivedZeroPreloads(entries, false));
    const explicit = renderHook(() => useDerivedZeroPreloads(entries, true));
    expect(mocks.preload).toHaveBeenCalledTimes(2);
    enabled.unmount();
    disabled.unmount();
    explicit.unmount();
  });
});

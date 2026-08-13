/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoSave } from '../useAutoSave';

describe('auto-save post-typefix pending-data guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('ignores a throttle callback after its pending value was cleared', async () => {
    const onSave = vi.fn();
    const clearTimeout = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => undefined);
    const { result } = renderHook(() => useAutoSave({ onSave, throttleMs: 1_000 }));

    act(() => result.current.save('pending'));
    act(() => result.current.cancel());
    await act(async () => vi.advanceTimersByTimeAsync(900));

    expect(clearTimeout).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

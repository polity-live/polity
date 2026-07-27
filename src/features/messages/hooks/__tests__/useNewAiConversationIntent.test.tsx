/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useNewAiConversationIntent } from '../useNewAiConversationIntent';

describe('useNewAiConversationIntent', () => {
  it('consumes one enabled intent exactly once across repeated effects', () => {
    const onConsume = vi.fn();
    const onCreate = vi.fn();
    const { rerender } = renderHook(
      ({ enabled, ready }) =>
        useNewAiConversationIntent({
          enabled,
          ready,
          onConsume,
          onCreate,
        }),
      { initialProps: { enabled: true, ready: false } }
    );

    expect(onConsume).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();

    act(() => rerender({ enabled: true, ready: true }));
    act(() => rerender({ enabled: true, ready: true }));

    expect(onConsume).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('allows a later intent after the consumed intent is removed', () => {
    const onConsume = vi.fn();
    const onCreate = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) =>
        useNewAiConversationIntent({
          enabled,
          ready: true,
          onConsume,
          onCreate,
        }),
      { initialProps: { enabled: true } }
    );

    act(() => rerender({ enabled: false }));
    act(() => rerender({ enabled: true }));

    expect(onConsume).toHaveBeenCalledTimes(2);
    expect(onCreate).toHaveBeenCalledTimes(2);
  });
});

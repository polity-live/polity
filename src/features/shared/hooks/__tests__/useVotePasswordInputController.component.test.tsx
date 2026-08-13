/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVotePasswordInputController } from '../useVotePasswordInputController';

describe('useVotePasswordInputController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('edits, navigates, resets, and submits a complete PIN once', () => {
    const onSubmit = vi.fn();
    const view = renderHook(
      ({ error, isLoading }) => useVotePasswordInputController({ error, isLoading, onSubmit }),
      { initialProps: { error: null as string | null, isLoading: false } }
    );
    const focus = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    view.result.current.inputRefs.current = focus.map(handler => ({ focus: handler }) as any);

    act(() => view.result.current.onChange(0, 'a1'));
    act(() => view.result.current.onChange(1, '2'));
    act(() => view.result.current.onChange(2, '3'));
    act(() => view.result.current.onChange(3, '4'));
    act(() => view.result.current.onChange(3, '4'));
    expect(view.result.current.digits).toEqual(['1', '2', '3', '4']);
    expect(focus[1]).toHaveBeenCalled();
    act(() => vi.runAllTimers());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('1234');

    const backspace = { key: 'Backspace' } as any;
    act(() => view.result.current.onChange(1, ''));
    act(() => view.result.current.onKeyDown(1, backspace));
    expect(focus[0]).toHaveBeenCalled();
    act(() => view.result.current.onKeyDown(0, backspace));
    act(() => view.result.current.onKeyDown(2, { key: 'Enter' } as any));

    view.rerender({ error: 'Wrong PIN', isLoading: false });
    expect(view.result.current.digits).toEqual(['', '', '', '']);
    expect(focus[0]).toHaveBeenCalled();
  });

  it('handles empty, partial, complete, and loading paste states', () => {
    const onSubmit = vi.fn();
    const view = renderHook(
      ({ isLoading }) => useVotePasswordInputController({ isLoading, onSubmit }),
      { initialProps: { isLoading: false } }
    );
    const focus = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    view.result.current.inputRefs.current = focus.map(handler => ({ focus: handler }) as any);
    const paste = (text: string) =>
      ({
        clipboardData: { getData: () => text },
        preventDefault: vi.fn(),
      }) as any;

    const empty = paste('letters');
    act(() => view.result.current.onPaste(empty));
    expect(empty.preventDefault).toHaveBeenCalled();
    expect(view.result.current.digits).toEqual(['', '', '', '']);

    act(() => view.result.current.onPaste(paste('12')));
    expect(view.result.current.digits).toEqual(['1', '2', '', '']);
    expect(focus[2]).toHaveBeenCalled();
    act(() => view.result.current.onPaste(paste('9-8-7-6-5')));
    act(() => vi.runAllTimers());
    expect(onSubmit).toHaveBeenCalledWith('9876');

    view.rerender({ isLoading: true });
    act(() => view.result.current.onChange(0, '4'));
    act(() => view.result.current.onPaste(paste('1111')));
    expect(view.result.current.digits).toEqual(['9', '8', '7', '6']);
  });
});

/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommentInputController } from '../useCommentInputController';

describe('useCommentInputController', () => {
  it('ignores empty text and externally busy submissions', async () => {
    const onSubmit = vi.fn();
    const { result, rerender } = renderHook(
      ({ isSubmitting }) => useCommentInputController({ onSubmit, isSubmitting }),
      { initialProps: { isSubmitting: false } }
    );

    await act(() => result.current.onSubmit());
    act(() => result.current.setText('Draft'));
    rerender({ isSubmitting: true });
    expect(result.current.isBusy).toBe(true);
    await act(() => result.current.onSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('trims successful submissions, exposes internal busy state, and clears text', async () => {
    let resolveSubmission!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSubmission = resolve;
        })
    );
    const { result } = renderHook(() =>
      useCommentInputController({ onSubmit, isSubmitting: false })
    );
    act(() => result.current.setText('  Useful comment  '));

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.onSubmit();
    });
    expect(result.current.isBusy).toBe(true);
    await act(async () => {
      resolveSubmission();
      await submission;
    });

    expect(onSubmit).toHaveBeenCalledWith('Useful comment');
    expect(result.current.text).toBe('');
    expect(result.current.isBusy).toBe(false);
  });

  it('clears internal busy state but preserves text after failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() =>
      useCommentInputController({ onSubmit, isSubmitting: false })
    );
    act(() => result.current.setText('Keep me'));

    await expect(act(() => result.current.onSubmit())).rejects.toThrow('failed');
    expect(result.current.text).toBe('Keep me');
    expect(result.current.isBusy).toBe(false);
  });

  it('submits only Enter with Control or Meta and prevents the matched event', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useCommentInputController({ onSubmit, isSubmitting: false })
    );
    act(() => result.current.setText('Keyboard comment'));
    const plain = buildKeyboardEvent({ key: 'Enter' });
    const other = buildKeyboardEvent({ key: 'a', ctrlKey: true });
    act(() => result.current.onKeyDown(plain as never));
    act(() => result.current.onKeyDown(other as never));
    expect(onSubmit).not.toHaveBeenCalled();

    const control = buildKeyboardEvent({ key: 'Enter', ctrlKey: true });
    act(() => result.current.onKeyDown(control as never));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(control.preventDefault).toHaveBeenCalledOnce();

    act(() => result.current.setText('Meta comment'));
    const meta = buildKeyboardEvent({ key: 'Enter', metaKey: true });
    act(() => result.current.onKeyDown(meta as never));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(meta.preventDefault).toHaveBeenCalledOnce();
  });
});

function buildKeyboardEvent(overrides: Record<string, unknown>) {
  return {
    key: '',
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

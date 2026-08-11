/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateFormConfig, CreateSubmitContext } from '../../types/create-form.types';

let preferenceStyle: 'carousel' | 'one_page' | 'auto' = 'carousel';
const updateFormStyle = vi.fn();

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ createFormStyle: preferenceStyle }),
}));
vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({ updateFormStyle }),
}));
vi.mock('../useFormStyle', () => ({
  useFormStyle: (style: string) => ({ formMode: style === 'one_page' ? 'one-page' : 'carousel' }),
}));

import { useCreateFormShellController } from '../useCreateFormShellController';

function makeConfig(onSubmit: CreateFormConfig['onSubmit']): CreateFormConfig {
  return {
    entityType: 'statement',
    title: 'create.title',
    isSubmitting: false,
    onSubmit,
    steps: [{ label: 'Step', isValid: () => true, fields: [] }],
  };
}

beforeEach(() => {
  preferenceStyle = 'carousel';
  updateFormStyle.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCreateFormShellController remaining state branches', () => {
  it('clears the optimistic style once the preference catches up and changes steps', () => {
    const { result, rerender } = renderHook(() =>
      useCreateFormShellController({ config: makeConfig(vi.fn()) })
    );

    act(() => {
      result.current.onFormStyleChange('one_page');
      result.current.onStepChange(2);
    });
    expect(result.current.selectedFormStyle).toBe('one_page');
    expect(result.current.currentStep).toBe(2);
    expect(updateFormStyle).toHaveBeenCalledWith('one_page');

    preferenceStyle = 'one_page';
    rerender();
    expect(result.current.selectedFormStyle).toBe('one_page');
  });

  it('ignores progress and recovery updates while a blocked submit is still idle', async () => {
    const target = { kind: 'route', entityType: 'statement', to: '/create' } as const;
    const onSubmit = vi.fn(async (context?: CreateSubmitContext) => {
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.setRecoveryTarget(target);
      return { status: 'blocked' as const };
    });
    const { result } = renderHook(() =>
      useCreateFormShellController({ config: makeConfig(onSubmit) })
    );

    await act(async () => result.current.onSubmit());
    expect(result.current.submission).toMatchObject({ status: 'idle', target: null });
  });

  it('guards duplicate submissions while the first call remains in flight', async () => {
    let resolveSubmit: ((value: { status: 'blocked' }) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<{ status: 'blocked' }>(resolve => {
          resolveSubmit = resolve;
        })
    );
    const { result } = renderHook(() =>
      useCreateFormShellController({ config: makeConfig(onSubmit) })
    );

    let first: Promise<void> | undefined;
    await act(async () => {
      first = result.current.onSubmit();
      await result.current.onSubmit();
    });
    expect(onSubmit).toHaveBeenCalledOnce();

    await act(async () => {
      resolveSubmit?.({ status: 'blocked' });
      await first;
    });
  });

  it('handles progress, target, and failure after the overlay timer has fired', async () => {
    vi.useFakeTimers();
    let context: CreateSubmitContext | undefined;
    let rejectSubmit: ((error: Error) => void) | undefined;
    const onSubmit = vi.fn(
      (nextContext?: CreateSubmitContext) =>
        new Promise<never>((_resolve, reject) => {
          context = nextContext;
          rejectSubmit = reject;
        })
    );
    const { result } = renderHook(() =>
      useCreateFormShellController({ config: makeConfig(onSubmit) })
    );

    let submission: Promise<void> | undefined;
    act(() => {
      submission = result.current.onSubmit();
      vi.advanceTimersByTime(120);
    });
    expect(result.current.submission.status).toBe('submitting');

    act(() => {
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.setRecoveryTarget({ kind: 'route', entityType: 'statement', to: '/statement/1' });
    });
    expect(result.current.submission.target).toMatchObject({ to: '/statement/1' });

    await act(async () => {
      rejectSubmit?.(new Error('late failure'));
      await submission;
    });
    expect(result.current.submission).toMatchObject({
      status: 'error',
      error: new Error('late failure'),
    });

    act(() => result.current.submission.onBack());
    expect(result.current.submission.status).toBe('idle');
  });
});

/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useValidatedFieldController } from '../useValidatedFieldController';

describe('useValidatedFieldController', () => {
  it('normalizes null, numeric, and string values', () => {
    const view = renderHook(({ value }) => useValidatedFieldController({ value }), {
      initialProps: { value: null as string | number | null | undefined },
    });
    expect(view.result.current.normalizedValue).toBe('');
    expect(view.result.current.isValid).toBe(false);
    view.rerender({ value: 42 });
    expect(view.result.current.normalizedValue).toBe('42');
    expect(view.result.current.isValid).toBe(true);
    view.rerender({ value: ' value ' });
    expect(view.result.current.normalizedValue).toBe(' value ');
  });

  it('shows required and validator errors only in their touched states', () => {
    const validator = vi.fn((value: string) => (value === 'bad' ? 'Invalid' : null));
    const view = renderHook(
      ({ required, value }) =>
        useValidatedFieldController({
          description: 'Required field',
          required,
          validator,
          value,
        }),
      { initialProps: { required: true, value: '' } }
    );
    expect(view.result.current.error).toBeNull();
    act(() => view.result.current.markTouched());
    expect(view.result.current.error).toBe('Required field');
    expect(view.result.current.isValid).toBe(false);

    view.rerender({ required: true, value: 'bad' });
    expect(view.result.current.error).toBe('Invalid');
    expect(view.result.current.isValid).toBe(false);
    view.rerender({ required: false, value: 'good' });
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.isValid).toBe(true);
  });

  it('supports an absent validator and untouched empty optional field', () => {
    const view = renderHook(() => useValidatedFieldController({ value: undefined }));
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.isValid).toBe(false);
    act(() => view.result.current.markTouched());
    expect(view.result.current.error).toBeNull();
  });
});

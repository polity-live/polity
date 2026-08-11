// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-debounce', () => ({ useDebounce: (value: string) => value }));

import { useValidatedInputFieldController } from '../useValidatedInputFieldController';

function input(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Name',
    onChange: vi.fn(),
    value: ' value ',
    ...overrides,
  } as any;
}

function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as any;
}

afterEach(cleanup);

describe('useValidatedInputFieldController', () => {
  it('derives ids, defaults, trimmed values, and empty validation state', () => {
    const provided = renderHook(() =>
      useValidatedInputFieldController(input({ id: 'provided', value: '   ' }))
    );
    expect(provided.result.current.inputId).toBe('provided');
    expect(provided.result.current.evaluationValue).toBe('');
    expect(provided.result.current.hasValue).toBe(false);
    expect(provided.result.current.computedValid).toBe(false);
    expect(provided.result.current.computedInvalid).toBe(false);
    expect(provided.result.current.suggestions).toEqual([]);
    expect(provided.result.current.showHint).toBe('focus');
    provided.unmount();

    const generated = renderHook(() => useValidatedInputFieldController(input()));
    expect(generated.result.current.inputId).toBe(generated.result.current.generatedId);
    expect(generated.result.current.immediateValue).toBe('value');
  });

  it('honors explicit validity and invalidity flags', () => {
    const truthy = renderHook(() =>
      useValidatedInputFieldController(input({ invalid: true, valid: true }))
    );
    expect(truthy.result.current.computedValid).toBe(true);
    expect(truthy.result.current.computedInvalid).toBe(true);
    truthy.unmount();

    const falsey = renderHook(() =>
      useValidatedInputFieldController(input({ invalid: false, valid: false }))
    );
    expect(falsey.result.current.computedValid).toBe(false);
    expect(falsey.result.current.computedInvalid).toBe(false);
  });

  it('uses validator results and handles a missing validator', () => {
    const valid = renderHook(() =>
      useValidatedInputFieldController(input({ validator: (value: string) => value === 'value' }))
    );
    expect(valid.result.current.evaluationValue).toBe('value');
    expect(valid.result.current.computedValid).toBe(true);
    expect(valid.result.current.computedInvalid).toBe(false);
    valid.unmount();

    const invalid = renderHook(() =>
      useValidatedInputFieldController(input({ validator: () => false }))
    );
    expect(invalid.result.current.computedValid).toBe(false);
    expect(invalid.result.current.computedInvalid).toBe(true);
    invalid.unmount();

    const unspecified = renderHook(() => useValidatedInputFieldController(input()));
    expect(unspecified.result.current.computedValid).toBe(false);
    expect(unspecified.result.current.computedInvalid).toBe(false);
  });

  it('caps suggestions and resets state when suggestions disappear', () => {
    const suggestions = Array.from({ length: 8 }, (_, index) => ({
      label: `Suggestion ${index}`,
      value: `${index}`,
    }));
    const { result, rerender } = renderHook(
      ({ currentSuggestions }) =>
        useValidatedInputFieldController(input({ suggestions: currentSuggestions })),
      { initialProps: { currentSuggestions: suggestions } }
    );
    expect(result.current.visibleSuggestions).toHaveLength(6);

    act(() => {
      result.current.setSelectedSuggestionIndex(5);
      result.current.setIsSuggestionMenuOpen(true);
    });
    rerender({ currentSuggestions: suggestions.slice(0, 2) });
    expect(result.current.selectedSuggestionIndex).toBe(1);

    rerender({ currentSuggestions: [] });
    expect(result.current.selectedSuggestionIndex).toBe(0);
    expect(result.current.isSuggestionMenuOpen).toBe(false);
  });

  it('requires focus, an open menu, text, and options to show suggestions', () => {
    const suggestions = [{ label: 'Ada', value: 'ada' }];
    const { result, rerender } = renderHook(
      ({ value, currentSuggestions }) =>
        useValidatedInputFieldController(input({ suggestions: currentSuggestions, value })),
      { initialProps: { currentSuggestions: suggestions, value: 'a' } }
    );
    expect(result.current.showSuggestions).toBe(false);

    act(() => result.current.setIsFocused(true));
    expect(result.current.showSuggestions).toBe(false);
    act(() => result.current.setIsSuggestionMenuOpen(true));
    expect(result.current.showSuggestions).toBe(true);

    rerender({ currentSuggestions: suggestions, value: ' ' });
    expect(result.current.showSuggestions).toBe(false);
    rerender({ currentSuggestions: [], value: 'a' });
    expect(result.current.showSuggestions).toBe(false);
  });

  it('applies a suggestion and closes the menu', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useValidatedInputFieldController(input({ onChange, suggestions: [{ value: 'ada' }] }))
    );
    act(() => {
      result.current.setIsSuggestionMenuOpen(true);
      result.current.applySuggestion({ label: 'Ada', value: 'ada' });
    });
    expect(onChange).toHaveBeenCalledWith('ada');
    expect(result.current.hasEdited).toBe(true);
    expect(result.current.isSuggestionMenuOpen).toBe(false);
    expect(result.current.selectedSuggestionIndex).toBe(0);
  });

  it('opens and navigates suggestions from the keyboard', () => {
    const onKeyDown = vi.fn();
    const suggestions = [{ value: 'ada' }, { value: 'grace' }];
    const { result } = renderHook(() =>
      useValidatedInputFieldController(input({ onKeyDown, suggestions, value: 'a' }))
    );

    act(() => result.current.setIsFocused(true));
    const open = keyEvent('ArrowDown');
    act(() => result.current.handleKeyDown(open));
    expect(open.preventDefault).toHaveBeenCalled();
    expect(result.current.showSuggestions).toBe(true);

    const down = keyEvent('ArrowDown');
    act(() => result.current.handleKeyDown(down));
    act(() => result.current.handleKeyDown(down));
    expect(result.current.selectedSuggestionIndex).toBe(1);

    const up = keyEvent('ArrowUp');
    act(() => result.current.handleKeyDown(up));
    act(() => result.current.handleKeyDown(up));
    expect(result.current.selectedSuggestionIndex).toBe(0);
    expect(onKeyDown).toHaveBeenCalled();
  });

  it('selects, escapes, and ignores non-actionable keyboard input', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useValidatedInputFieldController(
        input({ onChange, suggestions: [{ value: 'ada' }], value: 'a' })
      )
    );
    act(() => {
      result.current.setIsFocused(true);
      result.current.setIsSuggestionMenuOpen(true);
    });

    const enter = keyEvent('Enter');
    act(() => result.current.handleKeyDown(enter));
    expect(onChange).toHaveBeenCalledWith('ada');

    act(() => result.current.setIsSuggestionMenuOpen(true));
    const escape = keyEvent('Escape');
    act(() => result.current.handleKeyDown(escape));
    expect(escape.preventDefault).toHaveBeenCalled();

    const other = keyEvent('Tab');
    act(() => result.current.handleKeyDown(other));
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it('does not open or submit when no suggestion is available', () => {
    const { result } = renderHook(() =>
      useValidatedInputFieldController(input({ suggestions: [] }))
    );
    const down = keyEvent('ArrowDown');
    act(() => result.current.handleKeyDown(down));
    expect(down.preventDefault).not.toHaveBeenCalled();

    act(() => {
      result.current.setIsFocused(true);
      result.current.setIsSuggestionMenuOpen(true);
      result.current.setSelectedSuggestionIndex(10);
    });
    const enter = keyEvent('Enter');
    act(() => result.current.handleKeyDown(enter));
    expect(enter.preventDefault).not.toHaveBeenCalled();
  });
});

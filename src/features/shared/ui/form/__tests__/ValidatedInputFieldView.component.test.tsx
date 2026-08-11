/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ValidatedInputFieldView,
  type ValidatedInputFieldViewProps,
} from '../ValidatedInputFieldView';

afterEach(() => cleanup());

describe('ValidatedInputFieldView', () => {
  it('handles input and suggestion interactions with validation feedback', () => {
    const props = buildProps({
      icon: <span>Icon</span>,
      visibleSuggestions: [
        { value: 'Alpha', label: 'First choice' },
        { value: 'Beta', label: 'Beta' },
        { value: 'Gamma' },
      ],
      showSuggestions: true,
      computedInvalid: true,
      showHint: 'always',
      onFocus: vi.fn(),
      onBlur: vi.fn(),
    });
    render(<ValidatedInputFieldView {...props} />);

    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: 'new value' } });
    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.mouseEnter(screen.getByRole('option', { name: /Beta/ }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /Alpha/ }));

    expect(props.setHasEdited).toHaveBeenCalledWith(true);
    expect(props.setIsSuggestionMenuOpen.mock.calls).toEqual([[true], [true], [false]]);
    expect(props.setIsFocused.mock.calls).toEqual([[true], [false]]);
    expect(props.setSelectedSuggestionIndex.mock.calls).toEqual([[0], [1]]);
    expect(props.onChange).toHaveBeenCalledWith('new value');
    expect(props.onFocus).toHaveBeenCalledOnce();
    expect(props.onBlur).toHaveBeenCalledOnce();
    expect(props.handleKeyDown).toHaveBeenCalledOnce();
    expect(props.applySuggestion).toHaveBeenCalledWith({
      value: 'Alpha',
      label: 'First choice',
    });
    expect(screen.getByText('First choice')).toBeTruthy();
    expect(screen.queryAllByText('Beta')).toHaveLength(1);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('supports a valid plain input without suggestions or optional focus callbacks', () => {
    const props = buildProps({
      icon: null,
      visibleSuggestions: [],
      showSuggestions: false,
      computedValid: true,
      computedInvalid: false,
      hasEdited: true,
      isFocused: true,
      showHint: 'edited',
      onFocus: undefined,
      onBlur: undefined,
    });
    render(<ValidatedInputFieldView {...props} />);

    const input = screen.getByLabelText('Name');
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(input.getAttribute('data-valid')).toBe('true');
    expect(input.getAttribute('aria-autocomplete')).toBeNull();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-controls')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('Helpful hint')).toBeTruthy();
  });

  it('hides feedback without a hint and before an edited field is focused', () => {
    const first = render(
      <ValidatedInputFieldView {...buildProps({ hint: null, showHint: 'always' })} />
    );
    expect(screen.queryByText('Helpful hint')).toBeNull();
    first.unmount();

    render(
      <ValidatedInputFieldView
        {...buildProps({ showHint: 'edited', hasEdited: false, isFocused: false })}
      />
    );
    expect(screen.queryByText('Helpful hint')).toBeNull();
  });
});

function buildProps(
  overrides: Partial<ValidatedInputFieldViewProps> = {}
): ValidatedInputFieldViewProps {
  return {
    id: 'name',
    label: 'Name',
    value: 'current',
    onChange: vi.fn(),
    hint: 'Helpful hint',
    validator: undefined,
    valid: undefined,
    invalid: undefined,
    icon: null,
    suggestions: [],
    showHint: 'always',
    className: 'custom',
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onKeyDown: vi.fn(),
    inputProps: { name: 'name' },
    generatedId: 'generated',
    inputId: 'name-input',
    suggestionsId: 'name-suggestions',
    hasEdited: false,
    setHasEdited: vi.fn(),
    isFocused: false,
    setIsFocused: vi.fn(),
    isSuggestionMenuOpen: false,
    setIsSuggestionMenuOpen: vi.fn(),
    selectedSuggestionIndex: 0,
    setSelectedSuggestionIndex: vi.fn(),
    debouncedValue: '',
    immediateValue: '',
    evaluationValue: '',
    hasValue: true,
    visibleSuggestions: [],
    computedValid: false,
    computedInvalid: false,
    showSuggestions: false,
    applySuggestion: vi.fn(),
    handleKeyDown: vi.fn(),
    ...overrides,
  };
}

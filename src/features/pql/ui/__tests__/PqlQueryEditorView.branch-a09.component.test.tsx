/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { PqlQueryEditorView } from '../PqlQueryEditorView';

afterEach(cleanup);

function baseProps() {
  return {
    fields: [] as any[],
    issues: [] as any[],
    onBlur: vi.fn(),
    onChange: vi.fn(),
    onClick: vi.fn(),
    onFocus: vi.fn(),
    onKeyDown: vi.fn(),
    onKeyUp: vi.fn(),
    onSelect: vi.fn(),
    onSuggestionHover: vi.fn(),
    onSuggestionSelect: vi.fn(),
    selectedSuggestionIndex: 0,
    suggestions: [] as any[],
    suggestionsOpen: false,
    textareaRef: createRef<HTMLTextAreaElement>(),
    value: '',
  };
}

describe('PqlQueryEditorView remaining branches A09', () => {
  it('renders closed empty states and opens suggestions with selected and unselected details', () => {
    const initial = render(<PqlQueryEditorView {...baseProps()} />);
    expect(
      document.querySelector('[data-action-id="pql.query-editor.suggestion.select"]')
    ).toBeNull();
    initial.unmount();

    const props = baseProps();
    props.suggestionsOpen = true;
    props.selectedSuggestionIndex = 1;
    props.suggestions = [
      { kind: 'field', label: 'No detail', insertText: 'a', replaceStart: 0, replaceEnd: 0 },
      {
        kind: 'value',
        label: 'Detailed',
        detail: 'Description',
        insertText: 'b',
        replaceStart: 0,
        replaceEnd: 0,
      },
    ];
    render(<PqlQueryEditorView {...props} />);
    const suggestions = document.querySelectorAll<HTMLElement>(
      '[data-action-id="pql.query-editor.suggestion.select"]'
    );
    fireEvent.mouseEnter(suggestions[0]);
    fireEvent.mouseDown(suggestions[1]);
    expect(props.onSuggestionHover).toHaveBeenCalledWith(0);
    expect(props.onSuggestionSelect).toHaveBeenCalledWith(props.suggestions[1]);
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('limits field and issue displays and renders overflow badges', () => {
    const props = baseProps();
    props.fields = Array.from({ length: 11 }, (_, index) => ({ key: `field-${index}` }));
    props.issues = Array.from({ length: 4 }, (_, index) => ({
      start: index,
      end: index + 1,
      message: `Issue ${index}`,
    }));
    render(<PqlQueryEditorView {...props} />);
    expect(screen.getByText('+1generated.inline.0142_more_e7c95b4c')).toBeTruthy();
    expect(screen.getByText('Issue 0')).toBeTruthy();
    expect(screen.queryByText('Issue 3')).toBeNull();
  });
});

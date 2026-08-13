/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { PqlQueryEditorView } from '../PqlQueryEditorView';

afterEach(cleanup);

describe('PqlQueryEditorView actions', () => {
  it('routes query editing, focus, keyboard, and suggestion selection through stable actions', () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();
    const onSuggestionSelect = vi.fn();
    const { container } = render(
      <PqlQueryEditorView
        fields={[]}
        issues={[]}
        onBlur={vi.fn()}
        onChange={onChange}
        onClick={vi.fn()}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onKeyUp={vi.fn()}
        onSelect={vi.fn()}
        onSuggestionHover={vi.fn()}
        onSuggestionSelect={onSuggestionSelect}
        placeholder="Write PQL"
        selectedSuggestionIndex={0}
        suggestions={[
          {
            kind: 'field',
            label: 'Status',
            insertText: 'status',
            detail: 'Status field',
            replaceStart: 0,
            replaceEnd: 3,
          },
        ]}
        suggestionsOpen
        textareaRef={createRef<HTMLTextAreaElement>()}
        value="sta"
      />
    );

    const query = container.querySelector<HTMLTextAreaElement>(
      '[data-action-id="pql.query-editor.query.change"]'
    )!;
    const suggestion = container.querySelector<HTMLElement>(
      '[data-action-id="pql.query-editor.suggestion.select"]'
    )!;
    query.focus();
    fireEvent.change(query, { target: { value: 'status' } });
    fireEvent.keyDown(query, { key: 'ArrowDown' });
    fireEvent.mouseDown(suggestion);

    expect(document.activeElement).toBe(query);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onSuggestionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ insertText: 'status' })
    );
  });
});

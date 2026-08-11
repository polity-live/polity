// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useHashtagInputController } from '../useHashtagInputController';

function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as ReactKeyboardEvent;
}

describe('useHashtagInputController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes defaults and filters suggestions with and without input', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useHashtagInputController({
        value: ['Taken'],
        onChange,
        suggestions: ['Taken', 'Alpha', 'Beta'],
      })
    );

    expect(result.current).toMatchObject({
      label: 'Hashtags',
      showLabel: true,
      maxTags: undefined,
      inputId: undefined,
      inputClassName: undefined,
      resolvedInputId: 'hashtag-input',
      filteredSuggestions: ['Alpha', 'Beta'],
    });

    act(() => result.current.setInputValue(' #AL '));
    expect(result.current.trimmed).toBe('AL');
    expect(result.current.filteredSuggestions).toEqual(['Alpha']);
  });

  it('honors explicit presentation props and adds or rejects tags', () => {
    const onChange = vi.fn();
    const props = {
      value: ['existing'],
      onChange,
      label: 'Topics',
      showLabel: false,
      placeholder: 'Add topic',
      maxTags: 2,
      suggestions: ['new'],
      inputId: 'topics',
      inputClassName: 'wide',
    };
    const { result, rerender } = renderHook(
      ({ value, maxTags }: { value: string[]; maxTags?: number }) =>
        useHashtagInputController({ ...props, value, maxTags }),
      {
        initialProps: { value: props.value, maxTags: props.maxTags } as {
          value: string[];
          maxTags?: number;
        },
      }
    );

    expect(result.current).toMatchObject({
      label: 'Topics',
      showLabel: false,
      placeholder: 'Add topic',
      resolvedInputId: 'topics',
      inputClassName: 'wide',
    });

    act(() => {
      result.current.setInputValue('typed');
      result.current.setShowSuggestions(true);
      result.current.setSelectedIndex(1);
    });
    act(() => result.current.addHashtag('new'));
    expect(onChange).toHaveBeenLastCalledWith(['existing', 'new']);
    expect(result.current.inputValue).toBe('');
    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.selectedIndex).toBe(0);

    act(() => result.current.addHashtag('existing'));
    act(() => result.current.addHashtag(''));
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender({ value: ['one', 'two'], maxTags: 2 });
    act(() => result.current.addHashtag('blocked'));
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender({ value: [], maxTags: undefined });
    act(() => result.current.setInputValue('#fallback'));
    act(() => result.current.addHashtag());
    expect(onChange).toHaveBeenLastCalledWith(['fallback']);
  });

  it('removes tags and handles suggestion navigation and selection', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useHashtagInputController({ value: ['one', 'two'], onChange, suggestions: ['Alpha', 'Beta'] })
    );

    act(() => result.current.removeHashtag('one'));
    expect(onChange).toHaveBeenLastCalledWith(['two']);

    act(() => result.current.setShowSuggestions(true));
    act(() => result.current.handleKeyDown(keyEvent('Tab')));
    const down = keyEvent('ArrowDown');
    act(() => result.current.handleKeyDown(down));
    expect(down.preventDefault).toHaveBeenCalled();
    expect(result.current.selectedIndex).toBe(1);

    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')));
    expect(result.current.selectedIndex).toBe(1);

    const up = keyEvent('ArrowUp');
    act(() => result.current.handleKeyDown(up));
    expect(up.preventDefault).toHaveBeenCalled();
    expect(result.current.selectedIndex).toBe(0);

    act(() => result.current.handleKeyDown(keyEvent('ArrowUp')));
    expect(result.current.selectedIndex).toBe(0);

    act(() => result.current.setSelectedIndex(1));
    const enter = keyEvent('Enter');
    act(() => result.current.handleKeyDown(enter));
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(['one', 'two', 'Beta']);
  });

  it('handles free entry, deletion, escape, and ignored keys', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useHashtagInputController({ value: ['one'], onChange, suggestions: [] })
    );

    act(() => result.current.setInputValue('free'));
    const enter = keyEvent('Enter');
    act(() => result.current.handleKeyDown(enter));
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(['one', 'free']);

    const backspace = keyEvent('Backspace');
    act(() => result.current.handleKeyDown(backspace));
    expect(onChange).toHaveBeenLastCalledWith([]);

    act(() => result.current.setInputValue('kept'));
    act(() => result.current.handleKeyDown(keyEvent('Backspace')));
    expect(onChange).toHaveBeenCalledTimes(2);

    act(() => result.current.setShowSuggestions(true));
    act(() => result.current.handleKeyDown(keyEvent('Escape')));
    expect(result.current.showSuggestions).toBe(false);

    act(() => result.current.handleKeyDown(keyEvent('Tab')));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('closes suggestions only for clicks outside and removes its listener', () => {
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = renderHook(() =>
      useHashtagInputController({ value: [], onChange: vi.fn() })
    );

    act(() => result.current.setShowSuggestions(true));
    act(() => document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(result.current.showSuggestions).toBe(true);

    const container = document.createElement('div');
    const child = document.createElement('span');
    container.appendChild(child);
    document.body.appendChild(container);
    (result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
      container;

    act(() => child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(result.current.showSuggestions).toBe(true);

    act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(result.current.showSuggestions).toBe(false);

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    container.remove();
  });
});

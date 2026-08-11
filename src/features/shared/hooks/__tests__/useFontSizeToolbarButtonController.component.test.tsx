// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: { mark: string | undefined; block: { type?: string } | undefined } = {
    mark: undefined,
    block: undefined,
  };
  return {
    state,
    addMark: vi.fn(),
    focus: vi.fn(),
    editor: {
      api: {
        marks: () => (state.mark ? { fontSize: state.mark } : undefined),
        block: () => (state.block ? [state.block] : undefined),
      },
      tf: { focus: vi.fn() },
    },
  };
});

vi.mock('@platejs/basic-styles', () => ({
  toUnitLess: (value: string) => String(value).replace(/px$/, ''),
}));

vi.mock('@platejs/basic-styles/react', () => ({ FontSizePlugin: {} }));

vi.mock('platejs', () => ({ KEYS: { fontSize: 'fontSize' } }));

vi.mock('platejs/react', () => ({
  useEditorPlugin: () => ({
    editor: mocks.editor,
    tf: { fontSize: { addMark: mocks.addMark } },
  }),
  useEditorSelector: (selector: (editor: typeof mocks.editor) => unknown) => selector(mocks.editor),
}));

import { useFontSizeToolbarButtonController } from '../useFontSizeToolbarButtonController';

beforeEach(() => {
  mocks.state.mark = undefined;
  mocks.state.block = undefined;
  mocks.editor.tf.focus.mockReset();
  mocks.addMark.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('useFontSizeToolbarButtonController', () => {
  it('uses the default size and switches between cursor and focused input values', () => {
    const { result } = renderHook(() => useFontSizeToolbarButtonController());
    expect(result.current.displayValue).toBe('16');
    expect(result.current.fontSizes).toContain('96');

    act(() => result.current.onFocus());
    expect(result.current.isFocused).toBe(true);
    act(() => result.current.onInputChange('20'));
    expect(result.current.displayValue).toBe('20');
    act(() => result.current.onInputCommit());
    expect(mocks.addMark).toHaveBeenCalledWith('20px');
    expect(mocks.editor.tf.focus).toHaveBeenCalled();

    act(() => result.current.onSelectFontSize('24'));
    expect(mocks.addMark).toHaveBeenLastCalledWith('24px');
    expect(result.current.isFocused).toBe(false);
    expect(result.current.displayValue).toBe('16');
  });

  it('uses a marked cursor size and does not reapply the same value on blur', () => {
    mocks.state.mark = '18px';
    const { result } = renderHook(() => useFontSizeToolbarButtonController());
    expect(result.current.displayValue).toBe('18');

    act(() => result.current.onFocus());
    act(() => result.current.onBlur());
    expect(result.current.isFocused).toBe(false);
    expect(mocks.addMark).not.toHaveBeenCalled();
    expect(mocks.editor.tf.focus).toHaveBeenCalled();
  });

  it('derives heading sizes and falls back for ordinary blocks', () => {
    mocks.state.block = { type: 'h1' };
    const { result, rerender } = renderHook(() => useFontSizeToolbarButtonController());
    expect(result.current.displayValue).toBe('36');

    mocks.state.block = { type: 'paragraph' };
    rerender();
    expect(result.current.displayValue).toBe('16');
  });

  it('rejects both invalid bounds and increments valid display values', () => {
    const { result } = renderHook(() => useFontSizeToolbarButtonController());

    act(() => result.current.onDecrease());
    expect(mocks.addMark).toHaveBeenLastCalledWith('15px');
    act(() => result.current.onIncrease());
    expect(mocks.addMark).toHaveBeenLastCalledWith('17px');

    mocks.addMark.mockClear();
    act(() => result.current.onInputChange('0'));
    act(() => result.current.onInputCommit());
    act(() => result.current.onInputChange('101'));
    act(() => result.current.onInputCommit());
    expect(mocks.addMark).not.toHaveBeenCalled();

    act(() => result.current.onInputChange('12'));
    act(() => result.current.onInputCommit());
    expect(mocks.addMark).toHaveBeenCalledWith('12px');
  });
});

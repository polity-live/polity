/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useHistoryToolbarButtonController } from '../useHistoryToolbarButtonController';

const editor = vi.hoisted(() => ({
  history: { redos: [] as unknown[], undos: [] as unknown[] },
  redo: vi.fn(),
  undo: vi.fn(),
}));
vi.mock('platejs/react', () => ({
  useEditorRef: () => editor,
  useEditorSelector: (selector: (value: typeof editor) => unknown) => selector(editor),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('useHistoryToolbarButtonController', () => {
  it('handles disabled redo and enabled undo actions', () => {
    editor.history.redos = [];
    editor.history.undos = [{}];
    const redo = renderHook(() => useHistoryToolbarButtonController('redo')).result.current;
    expect(redo.disabled).toBe(true);
    redo.onClick();
    expect(editor.redo).toHaveBeenCalledOnce();
    const preventDefault = vi.fn();
    redo.onMouseDown({ preventDefault } as never);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(redo.tooltip).toBe('plateJs.toolbar.redo');

    const undo = renderHook(() => useHistoryToolbarButtonController('undo')).result.current;
    expect(undo.disabled).toBe(false);
    undo.onClick();
    expect(editor.undo).toHaveBeenCalledOnce();
    expect(undo.tooltip).toBe('plateJs.toolbar.undo');
  });

  it('handles enabled redo and disabled undo states', () => {
    editor.history.redos = [{}];
    editor.history.undos = [];
    expect(
      renderHook(() => useHistoryToolbarButtonController('redo')).result.current.disabled
    ).toBe(false);
    expect(
      renderHook(() => useHistoryToolbarButtonController('undo')).result.current.disabled
    ).toBe(true);
  });
});

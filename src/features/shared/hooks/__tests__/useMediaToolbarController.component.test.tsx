/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  collapsed: true,
  editing: false,
  preview: false,
  readOnly: false,
  selected: true,
  setEditing: vi.fn(),
}));

vi.mock('@platejs/media/react', () => ({
  FloatingMediaStore: { set: mocks.setEditing },
  useFloatingMediaValue: () => mocks.editing,
  useImagePreviewValue: () => mocks.preview,
}));

vi.mock('platejs/react', () => ({
  useEditorRef: () => ({ id: 'editor-1' }),
  useEditorSelector: (selector: any) => selector({ api: { isExpanded: () => !mocks.collapsed } }),
  useElement: () => ({ id: 'media-1' }),
  useReadOnly: () => mocks.readOnly,
  useRemoveNodeButton: () => ({ props: { 'data-remove': true } }),
  useSelected: () => mocks.selected,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useMediaToolbarController } from '../useMediaToolbarController';

describe('useMediaToolbarController', () => {
  beforeEach(() => {
    mocks.collapsed = true;
    mocks.editing = false;
    mocks.preview = false;
    mocks.readOnly = false;
    mocks.selected = true;
    vi.clearAllMocks();
  });

  it('opens only for a selected editable collapsed media node outside preview', () => {
    const view = renderHook(() => useMediaToolbarController());
    expect(view.result.current.isOpen).toBe(true);
    expect(view.result.current.removeButtonProps).toEqual({ 'data-remove': true });
    expect(view.result.current.labels.caption).toBe('plateJs.media.toolbar.caption');

    for (const state of [
      { readOnly: true },
      { selected: false },
      { collapsed: false },
      { preview: true },
    ]) {
      Object.assign(mocks, {
        collapsed: true,
        preview: false,
        readOnly: false,
        selected: true,
        ...state,
      });
      view.rerender();
      expect(view.result.current.isOpen).toBe(false);
    }
  });

  it('closes floating editing only when editing remains active while hidden', () => {
    mocks.editing = true;
    mocks.readOnly = true;
    const view = renderHook(() => useMediaToolbarController());
    expect(mocks.setEditing).toHaveBeenCalledWith('isEditing', false);
    mocks.setEditing.mockClear();

    mocks.editing = false;
    view.rerender();
    expect(mocks.setEditing).not.toHaveBeenCalled();
    mocks.editing = true;
    mocks.readOnly = false;
    view.rerender();
    expect(view.result.current.isOpen).toBe(true);
    expect(mocks.setEditing).not.toHaveBeenCalled();
  });
});

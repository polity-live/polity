/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  editor: undefined as any,
  externalChange: undefined as (() => void) | undefined,
  plateOptions: [] as any[],
}));

vi.mock('@/features/shared/ui/kit-platejs/editor-kit', () => ({
  EditorKit: [
    { key: 'fixed-toolbar' },
    { key: 'floating-toolbar' },
    { key: 'paragraph' },
    { key: 7 },
  ],
}));

vi.mock('platejs/react', () => ({
  usePlateEditor: (options: any) => {
    mocks.plateOptions.push(options);
    return mocks.editor;
  },
}));

import { useSimpleRichTextEditorController } from '../useSimpleRichTextEditorController';

describe('useSimpleRichTextEditorController', () => {
  beforeEach(() => {
    mocks.externalChange = undefined;
    mocks.plateOptions = [];
    mocks.editor = {
      children: [],
      onChange: () => mocks.externalChange?.(),
      selection: { anchor: {}, focus: {} },
    };
  });

  it('uses the empty fallback and forwards local changes to the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderHook(
      ({ onChange, value }) => useSimpleRichTextEditorController({ onChange, value }),
      { initialProps: { onChange: first, value: [] as any } }
    );
    expect(mocks.plateOptions[0].plugins.map((plugin: any) => plugin.key)).toEqual([
      'paragraph',
      7,
    ]);
    expect(mocks.plateOptions[0].value).toBeTruthy();
    act(() => view.result.current.onChange({ value: [{ text: 'Local' }] as any }));
    expect(first).toHaveBeenCalled();

    view.rerender({ onChange: second, value: [] as any });
    act(() => view.result.current.onChange({ value: [{ text: 'Latest' }] as any }));
    expect(second).toHaveBeenCalled();
  });

  it('applies changed external values once and suppresses the synchronous echo', () => {
    const onChange = vi.fn();
    const initial = [{ type: 'p', children: [{ text: 'Initial' }] }] as any;
    const view = renderHook(({ value }) => useSimpleRichTextEditorController({ onChange, value }), {
      initialProps: { value: initial },
    });
    expect(mocks.plateOptions[0].value).toEqual(initial);
    mocks.externalChange = () => view.result.current.onChange({ value: [{ text: 'Echo' }] as any });
    const external = [{ type: 'p', children: [{ text: 'External' }] }] as any;
    view.rerender({ value: external });
    expect(mocks.editor.children).toEqual(external);
    expect(mocks.editor.selection).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    view.rerender({ value: external });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies external values safely when the editor has no onChange callback', () => {
    delete mocks.editor.onChange;
    const view = renderHook(
      ({ value }) => useSimpleRichTextEditorController({ onChange: vi.fn(), value }),
      { initialProps: { value: [{ text: 'One' }] as any } }
    );
    view.rerender({ value: [{ text: 'Two' }] as any });
    expect(mocks.editor.children[0].children[0].text).toBe('Two');
  });
});

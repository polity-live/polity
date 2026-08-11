/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useLineHeightToolbarButtonController } from '../useLineHeightToolbarButtonController';

const mocks = vi.hoisted(() => ({
  focus: vi.fn(),
  getInjectProps: vi.fn(),
  selection: vi.fn(),
  setNodes: vi.fn(),
}));

vi.mock('@platejs/basic-styles/react', () => ({ LineHeightPlugin: Symbol('line-height') }));
vi.mock('platejs/react', () => ({
  useEditorRef: () => ({
    getInjectProps: mocks.getInjectProps,
    getTransforms: () => ({ lineHeight: { setNodes: mocks.setNodes } }),
    tf: { focus: mocks.focus },
  }),
  useSelectionFragmentProp: (options: { getProp: (node: { lineHeight: number }) => number }) => {
    mocks.selection(options);
    return options.getProp({ lineHeight: 1.5 });
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('useLineHeightToolbarButtonController', () => {
  it('defaults missing values and changes the line height', () => {
    mocks.getInjectProps.mockReturnValue({ defaultNodeValue: 1 });
    const { result } = renderHook(() => useLineHeightToolbarButtonController());

    expect(result.current.values).toEqual([]);
    expect(result.current.value).toBe(1.5);
    expect(result.current.label).toBe('plateJs.toolbar.lineHeight');
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.onValueChange('2'));
    expect(mocks.setNodes).toHaveBeenCalledWith(2);
    expect(mocks.focus).toHaveBeenCalledOnce();
  });

  it('preserves configured values', () => {
    mocks.getInjectProps.mockReturnValue({ defaultNodeValue: 1, validNodeValues: [1, 2] });
    const { result } = renderHook(() => useLineHeightToolbarButtonController());
    expect(result.current.values).toEqual([1, 2]);
  });
});

/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTurnIntoToolbarButtonController } from '../useTurnIntoToolbarButtonController';

const mocks = vi.hoisted(() => ({
  focus: vi.fn(),
  setBlockType: vi.fn(),
  value: undefined as string | undefined,
}));
vi.mock('platejs', () => ({
  KEYS: {
    p: 'p',
    ul: 'ul',
    ol: 'ol',
    listTodo: 'todo',
    toggle: 'toggle',
    codeBlock: 'code',
    blockquote: 'quote',
  },
}));
vi.mock('platejs/react', () => ({
  useEditorRef: () => ({ tf: { focus: mocks.focus } }),
  useSelectionFragmentProp: (options: { getProp: (node: object) => unknown }) => {
    options.getProp({ type: 'p' });
    return mocks.value;
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/ui/kit-platejs/transforms.ts', () => ({
  getBlockType: (node: { type?: string }) => node.type,
  setBlockType: mocks.setBlockType,
}));

beforeEach(() => {
  mocks.value = undefined;
  vi.clearAllMocks();
});

describe('useTurnIntoToolbarButtonController', () => {
  it('uses the paragraph fallback and handles menu actions', () => {
    const { result } = renderHook(() => useTurnIntoToolbarButtonController());
    expect(result.current.value).toBe('p');
    expect(result.current.selectedItem).toBe(result.current.turnIntoItems[0]);
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    const preventDefault = vi.fn();
    result.current.onCloseAutoFocus({ preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.focus).toHaveBeenCalledOnce();
    result.current.onValueChange('h1');
    expect(mocks.setBlockType).toHaveBeenCalledWith(expect.anything(), 'h1');
  });

  it('selects known values and falls back to the first item for unknown values', () => {
    mocks.value = 'h2';
    expect(
      renderHook(() => useTurnIntoToolbarButtonController()).result.current.selectedItem.value
    ).toBe('h2');
    mocks.value = 'unknown';
    expect(
      renderHook(() => useTurnIntoToolbarButtonController()).result.current.selectedItem.value
    ).toBe('p');
  });
});

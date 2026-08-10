/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAlignToolbarButtonController } from '../useAlignToolbarButtonController';
import { useEmojiInputElementController } from '../useEmojiInputElementController';

const mocks = vi.hoisted(() => ({
  alignValue: undefined as string | undefined,
  emojiGet: vi.fn(() => [{ id: 'wave' }]),
  emojiSearch: vi.fn(),
  focus: vi.fn(),
  setNodes: vi.fn(),
}));

vi.mock('@platejs/basic-styles/react', () => ({ TextAlignPlugin: Symbol('align') }));
vi.mock('@platejs/emoji/react', () => ({ EmojiPlugin: Symbol('emoji') }));
vi.mock('@platejs/emoji', () => ({
  EmojiInlineIndexSearch: {
    getInstance: () => ({
      search: (value: string) => {
        mocks.emojiSearch(value);
        return { get: mocks.emojiGet };
      },
    }),
  },
}));
vi.mock('platejs/react', () => ({
  useEditorPlugin: () => ({
    editor: { tf: { focus: mocks.focus } },
    tf: { textAlign: { setNodes: mocks.setNodes } },
  }),
  useSelectionFragmentProp: (options: { getProp: (node: { align: string }) => string }) => {
    options.getProp({ align: 'center' });
    return mocks.alignValue;
  },
  usePluginOption: () => [{ id: 'wave' }],
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../use-debounce.ts', () => ({ useDebounce: (value: string) => value }));

beforeEach(() => {
  mocks.alignValue = undefined;
  vi.clearAllMocks();
});

describe('shared toolbar and emoji controllers', () => {
  it('falls back to left alignment and applies changes', () => {
    const { result } = renderHook(() => useAlignToolbarButtonController());
    expect(result.current.value).toBe('left');
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.onValueChange('center'));
    expect(mocks.setNodes).toHaveBeenCalledWith('center');
    expect(mocks.focus).toHaveBeenCalledOnce();
  });

  it('preserves a selected alignment', () => {
    mocks.alignValue = 'end';
    const { result } = renderHook(() => useAlignToolbarButtonController());
    expect(result.current.value).toBe('end');
  });

  it('returns no emoji results for empty input and searches normalized input', () => {
    const { result } = renderHook(() => useEmojiInputElementController());
    expect(result.current.filteredEmojis).toEqual([]);
    expect(result.current.isPending).toBe(false);
    act(() => result.current.setValue(':wave:'));
    expect(mocks.emojiSearch).toHaveBeenCalledWith(':wave');
    expect(result.current.filteredEmojis).toEqual([{ id: 'wave' }]);
  });
});

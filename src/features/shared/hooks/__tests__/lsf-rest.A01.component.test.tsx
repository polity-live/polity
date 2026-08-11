/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toggleMark: vi.fn(),
  collapse: vi.fn(),
  focus: vi.fn(),
}));

vi.mock('platejs', () => ({ KEYS: { kbd: 'kbd', sup: 'sup', sub: 'sub' } }));
vi.mock('platejs/react', () => ({
  useEditorRef: () => ({
    tf: { toggleMark: mocks.toggleMark, collapse: mocks.collapse, focus: mocks.focus },
  }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/global-state/theme.store.tsx', () => ({
  useThemeStore: (selector: (state: { theme: string }) => unknown) => selector({ theme: 'dark' }),
}));

import { useDebounce } from '../use-debounce';
import { useContactDialogController } from '../useContactDialogController';
import { useMoreToolbarButtonController } from '../useMoreToolbarButtonController';
import { useToasterController } from '../useToasterController';

describe('remaining shared hook facades', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('debounces updates and cancels the prior timer', () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(({ value }) => useDebounce(value, 10), {
      initialProps: { value: 'first' },
    });
    rerender({ value: 'second' });
    expect(result.current).toBe('first');
    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toBe('second');
    unmount();
  });

  it('exposes contact, toaster, and all toolbar controller callbacks', () => {
    const contact = renderHook(() => useContactDialogController());
    act(() => contact.result.current.onOpenChange(true));
    expect(contact.result.current.open).toBe(true);

    expect(renderHook(() => useToasterController()).result.current.theme).toBe('dark');

    const toolbar = renderHook(() => useMoreToolbarButtonController());
    act(() => toolbar.result.current.onOpenChange(true));
    toolbar.result.current.onKeyboardInput();
    toolbar.result.current.onSuperscript();
    toolbar.result.current.onSubscript();
    expect(toolbar.result.current.open).toBe(true);
    expect(mocks.toggleMark).toHaveBeenNthCalledWith(1, 'kbd');
    expect(mocks.toggleMark).toHaveBeenNthCalledWith(2, 'sup', { remove: 'sub' });
    expect(mocks.toggleMark).toHaveBeenNthCalledWith(3, 'sub', { remove: 'sup' });
    expect(mocks.collapse).toHaveBeenCalledWith({ edge: 'end' });
    expect(mocks.focus).toHaveBeenCalledTimes(3);
  });
});

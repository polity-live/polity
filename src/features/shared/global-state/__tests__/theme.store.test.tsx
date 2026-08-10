// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyAppearanceTheme: vi.fn(),
  applyThemeMetadata: vi.fn(),
  appearanceTheme: { id: 'polity', slug: 'polity' },
}));

vi.mock('@/features/shared/appearance-theme', () => ({
  applyAppearanceTheme: mocks.applyAppearanceTheme,
  applyThemeMetadata: mocks.applyThemeMetadata,
  POLITY_THEME: mocks.appearanceTheme,
}));

import { useSystemThemeDetector, useThemeInitializer, useThemeStore } from '../theme.store';

function resetStore() {
  useThemeStore.setState({
    theme: 'system',
    systemTheme: 'light',
    isMounted: false,
    isDark: false,
    appearanceTheme: mocks.appearanceTheme as any,
  });
}

function installMatchMedia(matches: boolean) {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;
  const addEventListener = vi.fn(
    (_type: string, callback: (event: MediaQueryListEvent) => void) => {
      listener = callback;
    }
  );
  const removeEventListener = vi.fn();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches, addEventListener, removeEventListener })),
  });
  return {
    addEventListener,
    removeEventListener,
    emit: (next: boolean) => listener?.({ matches: next } as MediaQueryListEvent),
  };
}

beforeEach(() => {
  resetStore();
  document.documentElement.classList.remove('light', 'dark');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.applyAppearanceTheme.mockReset();
  mocks.applyThemeMetadata.mockReset();
});

describe('theme store', () => {
  it('updates explicit and system themes and applies only after mounting', () => {
    const store = useThemeStore.getState();
    store.applyTheme('custom');
    expect(document.documentElement.classList.contains('light')).toBe(false);

    store.setMounted(true);
    store.setTheme('dark');
    expect(useThemeStore.getState().isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().isDark).toBe(false);
    useThemeStore.getState().setSystemTheme('dark');
    expect(useThemeStore.getState().isDark).toBe(true);

    useThemeStore.getState().setSystemTheme('light');
    expect(useThemeStore.getState().isDark).toBe(false);
    useThemeStore.getState().setTheme('light');
    useThemeStore.getState().setSystemTheme('dark');
    expect(useThemeStore.getState().isDark).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
    expect(mocks.applyThemeMetadata).toHaveBeenCalledWith(false, mocks.appearanceTheme);
  });

  it('applies appearance themes using the resolved dark state', () => {
    useThemeStore.setState({ isDark: true });
    useThemeStore.getState().setAppearanceTheme({ id: 'custom', slug: 'custom' } as any);
    expect(mocks.applyAppearanceTheme).toHaveBeenCalledWith({ id: 'custom', slug: 'custom' });
    expect(mocks.applyThemeMetadata).toHaveBeenCalledWith(true, {
      id: 'custom',
      slug: 'custom',
    });
  });

  it('initializes each valid stored theme and falls back for invalid values', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    getItem.mockReturnValueOnce('light');
    useThemeStore.getState().initializeTheme('dark', 'theme-1');
    expect(useThemeStore.getState()).toMatchObject({
      theme: 'light',
      isDark: false,
      isMounted: true,
    });

    resetStore();
    getItem.mockReturnValueOnce('dark');
    useThemeStore.getState().initializeTheme('light', 'theme-2');
    expect(useThemeStore.getState()).toMatchObject({ theme: 'dark', isDark: true });

    resetStore();
    useThemeStore.setState({ systemTheme: 'dark' });
    getItem.mockReturnValueOnce('system');
    useThemeStore.getState().initializeTheme('light', 'theme-3');
    expect(useThemeStore.getState()).toMatchObject({ theme: 'system', isDark: true });

    resetStore();
    getItem.mockReturnValueOnce('invalid');
    useThemeStore.getState().initializeTheme('light', 'theme-4');
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('recovers from storage read and write failures', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('read failed');
    });
    useThemeStore.getState().initializeTheme('dark', 'broken');
    expect(useThemeStore.getState()).toMatchObject({ theme: 'dark', isDark: true });

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('write failed');
    });
    useThemeStore.getState().applyTheme('broken');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('detects initial and changed system preferences and unsubscribes', () => {
    useThemeStore.setState({ isMounted: true });
    const media = installMatchMedia(true);
    const { unmount } = renderHook(() => useSystemThemeDetector());
    expect(useThemeStore.getState().systemTheme).toBe('dark');
    expect(media.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    act(() => media.emit(false));
    expect(useThemeStore.getState().systemTheme).toBe('light');
    act(() => media.emit(true));
    expect(useThemeStore.getState().systemTheme).toBe('dark');
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('initializes through the hook with defaults and explicit options', async () => {
    installMatchMedia(false);
    const first = renderHook(() => useThemeInitializer());
    await waitFor(() => expect(useThemeStore.getState().isMounted).toBe(true));
    expect(useThemeStore.getState().theme).toBe('system');
    first.unmount();

    resetStore();
    installMatchMedia(false);
    const second = renderHook(() =>
      useThemeInitializer({ defaultTheme: 'dark', storageKey: 'custom-theme' })
    );
    await waitFor(() => expect(localStorage.getItem('custom-theme')).toBe('dark'));
    second.unmount();
  });
});

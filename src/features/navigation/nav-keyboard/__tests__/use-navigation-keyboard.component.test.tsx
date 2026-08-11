/* @vitest-environment jsdom */

import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

import {
  KeyboardPlatformProvider,
  type KeyboardPlatform,
} from '@/features/shared/keyboard/keyboard-shortcut';
import { useCommandDialogShortcut, useNavigationKeyboard } from '../use-navigation-keyboard';

function wrapperFor(platform: KeyboardPlatform) {
  return function KeyboardPlatformTestWrapper({ children }: PropsWithChildren) {
    return <KeyboardPlatformProvider platform={platform}>{children}</KeyboardPlatformProvider>;
  };
}

afterEach(() => {
  cleanup();
});

describe('useCommandDialogShortcut', () => {
  it('stays inactive until the keyboard platform is resolved', () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandDialogShortcut(setOpen, false));

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(setOpen).not.toHaveBeenCalled();
  });

  it('activates only Meta+K on macOS', () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandDialogShortcut(setOpen, false), {
      wrapper: wrapperFor('macos'),
    });

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(setOpen).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it.each(['windows', 'linux'] as const)('activates only Control+K on %s', platform => {
    const setOpen = vi.fn();
    renderHook(() => useCommandDialogShortcut(setOpen, false), {
      wrapper: wrapperFor(platform),
    });

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(setOpen).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(setOpen).toHaveBeenCalledWith(true);
  });
});

describe('useNavigationKeyboard', () => {
  it('routes item, theme, and shortcut commands and ignores unrelated keys', () => {
    const onNavigate = vi.fn();
    const onThemeToggle = vi.fn();
    const onKeyboardShortcutsOpen = vi.fn();
    const onClose = vi.fn();

    renderHook(
      () =>
        useNavigationKeyboard({
          isActive: true,
          onNavigate,
          onThemeToggle,
          onKeyboardShortcutsOpen,
          onClose,
          items: [
            { id: 'home', label: 'Home', icon: 'Home' },
            { id: 'unknown', label: 'Unknown', icon: 'Home' },
          ],
        }),
      { wrapper: wrapperFor('windows') }
    );

    fireEvent.keyDown(document, { key: 'x' });
    fireEvent.keyDown(document, { key: 'h', altKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: 't', altKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: 'k', altKey: true, shiftKey: true });

    expect(onNavigate).toHaveBeenCalledWith('home');
    expect(onThemeToggle).toHaveBeenCalledOnce();
    expect(onKeyboardShortcutsOpen).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not listen while navigation is inactive', () => {
    const onNavigate = vi.fn();
    renderHook(
      () =>
        useNavigationKeyboard({
          isActive: false,
          onNavigate,
          onThemeToggle: vi.fn(),
          onKeyboardShortcutsOpen: vi.fn(),
          onClose: vi.fn(),
          items: [{ id: 'home', label: 'Home', icon: 'Home' }],
        }),
      { wrapper: wrapperFor('windows') }
    );

    fireEvent.keyDown(document, { key: 'h', altKey: true, shiftKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

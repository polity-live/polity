/* @vitest-environment jsdom */

import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

import {
  KeyboardPlatformProvider,
  type KeyboardPlatform,
} from '@/features/shared/keyboard/keyboard-shortcut';
import { useCommandDialogShortcut } from '../use-navigation-keyboard';

function wrapperFor(platform: KeyboardPlatform) {
  return function KeyboardPlatformTestWrapper({ children }: PropsWithChildren) {
    return <KeyboardPlatformProvider platform={platform}>{children}</KeyboardPlatformProvider>;
  };
}

afterEach(() => {
  cleanup();
});

describe('useCommandDialogShortcut', () => {
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

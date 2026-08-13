/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { commandDialogShortcut } from '@/features/navigation/nav-keyboard/keyboard-navigation';
import {
  KeyboardPlatformProvider,
  useKeyboardShortcutDisplay,
  useResolvedKeyboardShortcut,
  type KeyboardShortcutDefinition,
} from '../keyboard-shortcut';

function ShortcutProbe() {
  const shortcut = useResolvedKeyboardShortcut(commandDialogShortcut);
  return (
    <span>{shortcut ? `${shortcut.display}|${shortcut.ariaKeyShortcuts}` : 'unresolved'}</span>
  );
}

function DisplayProbe({ shortcut }: { shortcut?: KeyboardShortcutDefinition }) {
  return <span>{useKeyboardShortcutDisplay(shortcut) ?? 'none'}</span>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('KeyboardPlatformProvider', () => {
  it('does not render a fallback shortcut during SSR', () => {
    const html = renderToString(
      <KeyboardPlatformProvider>
        <ShortcutProbe />
      </KeyboardPlatformProvider>
    );

    expect(html).toContain('unresolved');
    expect(html).not.toContain('Ctrl K');
    expect(html).not.toContain('⌘ K');
  });

  it.each([
    ['macos', '⌘ K|Meta+K'],
    ['windows', 'Ctrl K|Control+K'],
    ['linux', 'Ctrl K|Control+K'],
  ] as const)('resolves UI and ARIA together for %s', (platform, expected) => {
    render(
      <KeyboardPlatformProvider platform={platform}>
        <ShortcutProbe />
      </KeyboardPlatformProvider>
    );

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('detects the client platform after the unresolved initial state', async () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0');

    render(
      <KeyboardPlatformProvider>
        <ShortcutProbe />
      </KeyboardPlatformProvider>
    );

    expect(await screen.findByText('⌘ K|Meta+K')).toBeTruthy();
  });

  it('exposes display-only shortcuts and keeps missing definitions unresolved', () => {
    const shortcut: KeyboardShortcutDefinition = {
      macos: { modifiers: ['meta'], key: 'k' },
      windows: { modifiers: ['control'], key: 'k' },
      linux: { modifiers: ['control'], key: 'k' },
    };
    const rendered = render(
      <KeyboardPlatformProvider platform="windows">
        <DisplayProbe shortcut={shortcut} />
      </KeyboardPlatformProvider>
    );
    expect(screen.getByText('Ctrl K')).toBeTruthy();
    rendered.unmount();

    render(<DisplayProbe />);
    expect(screen.getByText('none')).toBeTruthy();
  });
});

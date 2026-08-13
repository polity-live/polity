import { describe, expect, it, vi } from 'vitest';

import {
  detectKeyboardPlatform,
  formatKeyboardShortcut,
  getAriaKeyShortcuts,
  getPlateHotkey,
  matchesKeyboardShortcut,
  resolveKeyboardShortcut,
  type KeyboardShortcutDefinition,
} from '../keyboard-shortcut';

const commandShortcut: KeyboardShortcutDefinition = {
  macos: { modifiers: ['meta'], key: 'k' },
  windows: { modifiers: ['control'], key: 'k' },
  linux: { modifiers: ['control'], key: 'k' },
};

const calendarShortcut: KeyboardShortcutDefinition = {
  macos: { modifiers: ['alt', 'shift'], key: 'c' },
  windows: { modifiers: ['alt', 'shift'], key: 'c' },
  linux: { modifiers: ['alt', 'shift'], key: 'c' },
};

const differentPerPlatform: KeyboardShortcutDefinition = {
  macos: { modifiers: ['meta', 'shift'], key: 'm' },
  windows: { modifiers: ['control'], key: 'w' },
  linux: { modifiers: ['alt'], key: 'l' },
};

describe('keyboard platform detection', () => {
  it('defaults to Windows when browser signals are unavailable', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectKeyboardPlatform()).toBe('windows');
    vi.unstubAllGlobals();
  });

  it.each([
    [{ userAgentDataPlatform: 'macOS' }, 'macos'],
    [{ platform: 'MacIntel' }, 'macos'],
    [{ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, 'macos'],
    [{ platform: 'iPad' }, 'macos'],
    [{ userAgentDataPlatform: 'Windows' }, 'windows'],
    [{ platform: 'Win32' }, 'windows'],
    [{ userAgentDataPlatform: 'Linux' }, 'linux'],
    [{ platform: 'Linux x86_64' }, 'linux'],
    [{ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64)' }, 'linux'],
    [{ userAgent: 'Mozilla/5.0 (Linux; Android 15)' }, 'linux'],
    [{ platform: 'Unknown Desktop' }, 'windows'],
  ] as const)('detects $1 from browser signals', (source, expected) => {
    expect(detectKeyboardPlatform(source)).toBe(expected);
  });

  it('falls through unknown higher-priority signals', () => {
    expect(
      detectKeyboardPlatform({
        userAgentDataPlatform: 'Unknown',
        platform: 'MacIntel',
        userAgent: 'Windows',
      })
    ).toBe('macos');
  });
});

describe('keyboard shortcut resolution', () => {
  const everyModifier: KeyboardShortcutDefinition = {
    macos: { modifiers: ['mod', 'control', 'meta', 'alt', 'shift'], key: 'Enter' },
    windows: { modifiers: ['mod', 'control', 'meta', 'alt', 'shift'], key: 'Enter' },
    linux: { modifiers: ['mod'], key: 'Enter' },
  };

  it('supports different modifiers and keys for every platform', () => {
    expect(resolveKeyboardShortcut(differentPerPlatform, 'macos').key).toBe('m');
    expect(resolveKeyboardShortcut(differentPerPlatform, 'windows').key).toBe('w');
    expect(resolveKeyboardShortcut(differentPerPlatform, 'linux').key).toBe('l');
  });

  it.each([
    ['windows', 'de', 'Strg K'],
    ['windows', 'en', 'Ctrl K'],
    ['linux', 'de', 'Strg K'],
    ['linux', 'en', 'Ctrl K'],
    ['macos', 'de', '⌘ K'],
    ['macos', 'en', '⌘ K'],
  ] as const)('formats Command Box for %s/%s', (platform, language, expected) => {
    expect(formatKeyboardShortcut(commandShortcut, { platform, language })).toBe(expected);
  });

  it.each([
    ['windows', 'Alt ⇧ C'],
    ['linux', 'Alt ⇧ C'],
    ['macos', '⌥ ⇧ C'],
  ] as const)('formats navigation shortcuts for %s', (platform, expected) => {
    expect(formatKeyboardShortcut(calendarShortcut, { platform, language: 'en' })).toBe(expected);
  });

  it('emits exactly one active ARIA shortcut per platform', () => {
    expect(getAriaKeyShortcuts(commandShortcut, 'macos')).toBe('Meta+K');
    expect(getAriaKeyShortcuts(commandShortcut, 'windows')).toBe('Control+K');
    expect(getAriaKeyShortcuts(commandShortcut, 'linux')).toBe('Control+K');
  });

  it('creates Plate hotkeys from the same platform chord', () => {
    expect(getPlateHotkey(commandShortcut, 'macos')).toBe('meta+k');
    expect(getPlateHotkey(commandShortcut, 'windows')).toBe('ctrl+k');
    expect(getPlateHotkey(differentPerPlatform, 'linux')).toBe('alt+l');
  });

  it('formats Mod, explicit Control, Meta, Alt, Shift, and named keys', () => {
    expect(formatKeyboardShortcut(everyModifier, { platform: 'macos' })).toBe('⌘ ⌃ ⌘ ⌥ ⇧ Enter');
    expect(formatKeyboardShortcut(everyModifier, { platform: 'windows' })).toBe(
      'Ctrl Ctrl Meta Alt ⇧ Enter'
    );
    expect(getAriaKeyShortcuts(calendarShortcut, 'windows')).toBe('Alt+Shift+C');
    expect(getPlateHotkey(everyModifier, 'linux')).toBe('ctrl+enter');
  });
});

describe('strict platform activation', () => {
  const metaK = { key: 'k', altKey: false, shiftKey: false, ctrlKey: false, metaKey: true };
  const controlK = { key: 'k', altKey: false, shiftKey: false, ctrlKey: true, metaKey: false };

  it('accepts Meta+K and rejects Control+K on macOS', () => {
    expect(matchesKeyboardShortcut(metaK, commandShortcut, 'macos')).toBe(true);
    expect(matchesKeyboardShortcut(controlK, commandShortcut, 'macos')).toBe(false);
  });

  it.each(['windows', 'linux'] as const)('accepts Control+K and rejects Meta+K on %s', platform => {
    expect(matchesKeyboardShortcut(controlK, commandShortcut, platform)).toBe(true);
    expect(matchesKeyboardShortcut(metaK, commandShortcut, platform)).toBe(false);
  });

  it('rejects undeclared extra modifiers', () => {
    expect(
      matchesKeyboardShortcut({ ...controlK, shiftKey: true }, commandShortcut, 'windows')
    ).toBe(false);
  });
});

/**
 * Keyboard Navigation Utils
 *
 * This module provides utility functions for keyboard shortcuts management
 * in the navigation system.
 */

import {
  matchesKeyboardShortcut,
  type KeyboardShortcutDefinition,
  type KeyboardPlatform,
} from '@/features/shared/keyboard/keyboard-shortcut';

function navigationShortcut(key: string): KeyboardShortcutDefinition {
  return {
    macos: { modifiers: ['alt', 'shift'], key },
    windows: { modifiers: ['alt', 'shift'], key },
    linux: { modifiers: ['alt', 'shift'], key },
  };
}

/**
 * Maps navigation item IDs to keyboard shortcuts
 * Using Alt+Shift+letter combinations to avoid conflicts with common system shortcuts
 */
export const navigationShortcuts: Record<string, KeyboardShortcutDefinition> = {
  // Primary navigation items
  home: navigationShortcut('h'),
  dashboard: navigationShortcut('d'),
  messages: navigationShortcut('m'),
  settings: navigationShortcut('s'),
  files: navigationShortcut('f'),
  projects: navigationShortcut('p'),
  calendar: navigationShortcut('c'),
  notifications: navigationShortcut('n'),
  flow: navigationShortcut('l'),

  // Settings shortcut items
  theme: navigationShortcut('t'),
  keyboard: navigationShortcut('k'),
};

export const commandDialogShortcut: KeyboardShortcutDefinition = {
  macos: { modifiers: ['meta'], key: 'k' },
  windows: { modifiers: ['control'], key: 'k' },
  linux: { modifiers: ['control'], key: 'k' },
};

/**
 * Get keyboard shortcut for a navigation item by ID
 */
export function getShortcutForItem(id: string): KeyboardShortcutDefinition | undefined {
  return navigationShortcuts[id];
}

/**
 * Check if a keyboard event matches a shortcut by item ID
 */
export function isShortcutMatch(
  event: KeyboardEvent,
  itemId: string,
  platform: KeyboardPlatform
): boolean {
  const shortcut = getShortcutForItem(itemId);
  return shortcut ? matchesKeyboardShortcut(event, shortcut, platform) : false;
}

import {
  getPlateHotkey,
  type KeyboardPlatform,
  type KeyboardShortcutDefinition,
  type KeyboardShortcutModifier,
} from '@/features/shared/keyboard/keyboard-shortcut';

function editorShortcut(
  key: string,
  additionalModifiers: readonly KeyboardShortcutModifier[] = []
): KeyboardShortcutDefinition {
  return {
    macos: { modifiers: ['meta', ...additionalModifiers], key },
    windows: { modifiers: ['control', ...additionalModifiers], key },
    linux: { modifiers: ['control', ...additionalModifiers], key },
  };
}

export const editorShortcuts = {
  bold: editorShortcut('b'),
  italic: editorShortcut('i'),
  underline: editorShortcut('u'),
  strikethrough: editorShortcut('x', ['shift']),
  code: editorShortcut('e'),
} as const satisfies Record<string, KeyboardShortcutDefinition>;

export type EditorShortcutName = keyof typeof editorShortcuts;

export function getEditorPlateHotkeys(
  platform: KeyboardPlatform
): Record<EditorShortcutName, string> {
  return Object.fromEntries(
    Object.entries(editorShortcuts).map(([name, shortcut]) => [
      name,
      getPlateHotkey(shortcut, platform),
    ])
  ) as Record<EditorShortcutName, string>;
}

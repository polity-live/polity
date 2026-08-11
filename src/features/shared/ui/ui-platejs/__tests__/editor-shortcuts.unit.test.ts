import { describe, expect, it } from 'vitest';

import { getEditorPlateHotkeys } from '../editor-shortcuts';

describe('editor shortcut hotkeys', () => {
  it('uses Meta hotkeys on macOS', () => {
    expect(getEditorPlateHotkeys('macos')).toEqual({
      bold: 'meta+b',
      italic: 'meta+i',
      underline: 'meta+u',
      strikethrough: 'meta+shift+x',
      code: 'meta+e',
    });
  });

  it.each(['windows', 'linux'] as const)('uses Control hotkeys on %s', platform => {
    expect(getEditorPlateHotkeys(platform)).toEqual({
      bold: 'ctrl+b',
      italic: 'ctrl+i',
      underline: 'ctrl+u',
      strikethrough: 'ctrl+shift+x',
      code: 'ctrl+e',
    });
  });
});

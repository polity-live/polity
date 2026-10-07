import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import { createDocument } from '../templates';
import { legacyDocumentToV3 } from '../v3-adapter';
import { applyThemeSnapshot, createThemeSnapshot, paletteColor } from '../theme';

describe('Studio V4 theme snapshots', () => {
  it('resolves light and dark palette roles and keeps explicit overrides', () => {
    const document = legacyDocumentToV3(createDocument('single', 'Theme'));
    const text = document.nodes.find(node => node.type === 'richText');
    expect(text).toBeTruthy();
    if (!text) return;
    text.style.fill = '#123456';
    text.style.fillBinding = null;
    text.overrides.push('style.fill');

    const dark = createThemeSnapshot(BUILTIN_THEMES[1], 'dark');
    applyThemeSnapshot(document, dark);

    expect(document.schemaVersion).toBe(5);
    expect(document.theme.mode).toBe('dark');
    expect(text.style.fill).toBe('#123456');
    expect(paletteColor(dark.dark, 'primary')).toBe(dark.dark.primary);
  });

  it('applies a combined text style and its semantic color token', () => {
    const document = legacyDocumentToV3(createDocument('single', 'Theme'));
    const theme = createThemeSnapshot(BUILTIN_THEMES[0], 'light');
    const text = document.nodes.find(node => node.type === 'richText');
    if (!text) throw new Error('text fixture missing');
    text.typography.textStyleId = theme.textStyles[0].id;
    text.style.fillBinding = theme.textStyles[0].color;
    applyThemeSnapshot(document, { ...theme, mode: 'dark' });
    expect(text.style.fill).toBe(paletteColor(theme.dark, theme.textStyles[0].color));
  });
});

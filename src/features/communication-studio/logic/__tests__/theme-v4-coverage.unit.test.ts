import { expect, it } from 'vitest';
import {
  FONT_FAMILIES,
  type FontId,
  type ThemePalette,
  type ThemeTextStyle,
} from '@/features/shared/appearance-theme/contract';
import { POLITY_THEME } from '@/features/shared/appearance-theme/presets';
import { createDocument } from '../templates';
import { legacyDocumentToV3 } from '../v3-adapter';
import {
  activePalette,
  applyTextStyleToNode,
  applyThemeSnapshot,
  createThemeSnapshot,
  DEFAULT_STUDIO_THEME,
  paletteColor,
  themeCssFontFamily,
  themeFontFamily,
  themeFromApiRow,
  themeToLegacyBrand,
} from '../theme';

function fixture() {
  const document = legacyDocumentToV3(createDocument('single', 'Theme regression'));
  document.theme = createThemeSnapshot(POLITY_THEME);
  const text = document.nodes.find(node => node.type === 'richText');
  if (!text) throw new Error('Missing rich text fixture');
  text.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [{ id: crypto.randomUUID(), text: 'Bound theme text' }],
    },
  ];
  return { document, text };
}

function styledFixture() {
  const result = fixture();
  const oldStyle = result.document.theme.textStyles[0];
  applyTextStyleToNode(result.text, oldStyle, activePalette(result.document.theme));
  const next = structuredClone(result.document.theme);
  const nextStyle = next.textStyles[0];
  nextStyle.size = oldStyle.size + 11;
  return { ...result, oldStyle, nextStyle, next };
}

it.each(Object.keys(FONT_FAMILIES) as FontId[])(
  'resolves both persisted and CSS font families for %s',
  font => {
    const expected = {
      newsreader: 'Newsreader',
      manrope: 'Manrope',
      'jetbrains-mono': 'JetBrains Mono',
      'open-sans': 'Open Sans',
      inter: 'Inter',
      'ibm-plex-serif': 'IBM Plex Serif',
      'public-sans': 'Public Sans',
      'pt-sans': 'PT Sans',
      'work-sans': 'Work Sans',
      ubuntu: 'Ubuntu',
    };
    expect(themeFontFamily(font)).toBe(expected[font]);
    expect(themeCssFontFamily(font)).toBe(FONT_FAMILIES[font]);
  }
);

it('resolves every chart palette token and falls back to foreground when a palette lacks its chart color', () => {
  const palette = DEFAULT_STUDIO_THEME.light;
  for (const role of ['chart1', 'chart2', 'chart3', 'chart4', 'chart5'] as const)
    expect(paletteColor(palette, role)).toBe(palette.charts[Number(role.slice(-1)) - 1]);
  expect(paletteColor({ ...palette, charts: [] } as unknown as ThemePalette, 'chart1')).toBe(
    palette.foreground
  );
  expect(paletteColor(palette, 'accent')).toBe(palette.accent);
});

it('uses snapshot defaults and preserves the selected dark palette, revision and legacy font identities', () => {
  expect(createThemeSnapshot()).toEqual(DEFAULT_STUDIO_THEME);
  const revisionId = crypto.randomUUID();
  const dark = createThemeSnapshot(POLITY_THEME, 'dark', revisionId);
  expect(activePalette(dark)).toEqual(POLITY_THEME.dark);
  expect(themeToLegacyBrand(dark)).toEqual({
    background: dark.dark.background,
    foreground: dark.dark.foreground,
    accent: dark.dark.accent,
    font: themeFontFamily(dark.fonts.display),
    bodyFont: themeFontFamily(dark.fonts.sans),
    logoAssetId: null,
    themeId: dark.themeId,
    revisionId,
  });
});

it('applies default palette typography and marks without rewriting nested inline nodes or unrelated overrides', () => {
  const { text } = fixture();
  const inline = {
    id: crypto.randomUUID(),
    type: 'a',
    url: 'https://example.org',
    children: [{ id: crypto.randomUUID(), text: 'Nested link' }],
  };
  text.content[0].children.push(inline);
  text.overrides = ['typography.fontSize', 'style.stroke'];
  const style = {
    ...DEFAULT_STUDIO_THEME.textStyles[0],
    color: 'chart2',
    align: 'right',
    bold: true,
    italic: true,
    underline: true,
  } satisfies ThemeTextStyle;
  applyTextStyleToNode(text, style);
  expect(text.typography).toMatchObject({
    fontFamily: themeFontFamily(style.font),
    fontSize: style.size,
    horizontalAlign: 'right',
    textStyleId: style.id,
  });
  expect(text.content[0].align).toBe('right');
  expect(text.content[0].children[0]).toMatchObject({
    fontSize: style.size,
    bold: true,
    italic: true,
    underline: true,
    textStyleId: style.id,
    colorBinding: 'chart2',
    color: DEFAULT_STUDIO_THEME.light.charts[1],
  });
  expect(text.content[0].children[1]).toEqual(inline);
  expect(text.overrides).toEqual(['style.stroke']);
});

it('infers case-insensitive semantic and chart color bindings while preserving null and custom colors', () => {
  const { document, text } = fixture();
  const old = document.theme;
  old.light.primary = '#AABBCC';
  old.light.charts[4] = '#BCDEFA';
  text.style.fill = '#aabbcc';
  text.style.fillBinding = null;
  text.style.stroke = '#bcdefa';
  text.style.strokeBinding = null;
  const next = structuredClone(old);
  next.light.primary = '#123456';
  next.light.charts[4] = '#654321';
  const custom = document.nodes.find(node => node.id !== text.id)!;
  custom.style.fill = '#010203';
  custom.style.fillBinding = null;
  custom.style.stroke = null;
  custom.style.strokeBinding = null;
  applyThemeSnapshot(document, next);
  expect(text.style).toMatchObject({
    fill: '#123456',
    fillBinding: 'primary',
    stroke: '#654321',
    strokeBinding: 'chart5',
  });
  expect(custom.style.fill).toBe('#010203');
  expect(custom.style.stroke).toBeNull();
  expect(custom.overrides).toContain('style.fill');
  applyThemeSnapshot(document, structuredClone(next));
  expect(custom.overrides.filter(key => key === 'style.fill')).toHaveLength(1);
});

it('retains explicit color bindings without applying the new palette over overridden colors', () => {
  const { document, text } = fixture();
  text.style.fillBinding = 'primary';
  text.style.fill = '#ABCDEF';
  text.style.strokeBinding = 'accent';
  text.style.stroke = '#FEDCBA';
  text.overrides = ['style.fill', 'style.stroke'];
  applyThemeSnapshot(document, { ...document.theme, mode: 'dark' });
  expect(text.style).toMatchObject({
    fill: '#ABCDEF',
    stroke: '#FEDCBA',
    fillBinding: 'primary',
    strokeBinding: 'accent',
  });
});

it('updates unmodified bound typography when the new text style also changes its inline marks', () => {
  const { document, text, oldStyle, next, nextStyle } = styledFixture();
  nextStyle.bold = !oldStyle.bold;
  nextStyle.italic = !oldStyle.italic;
  nextStyle.underline = !oldStyle.underline;
  nextStyle.color = 'chart3';
  applyThemeSnapshot(document, next);
  expect(text.typography.fontSize).toBe(nextStyle.size);
  expect(text.style.fillBinding).toBe('chart3');
  expect(text.content[0].children[0]).toMatchObject({
    fontSize: nextStyle.size,
    bold: nextStyle.bold,
    italic: nextStyle.italic,
    underline: nextStyle.underline,
    color: next.light.charts[2],
  });
  expect(document.theme).toEqual(next);
});

it.each([
  'fontFamily',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'horizontalAlign',
  'bold',
  'italic',
  'underline',
  'empty',
] as const)(
  'retains customised node typography when the previous style no longer matches %s',
  field => {
    const { document, text, oldStyle, next, nextStyle } = styledFixture();
    if (field === 'fontFamily') text.typography.fontFamily = 'Inter';
    else if (field === 'fontSize') text.typography.fontSize += 3;
    else if (field === 'lineHeight') text.typography.lineHeight += 0.1;
    else if (field === 'letterSpacing') text.typography.letterSpacing += 1;
    else if (field === 'horizontalAlign')
      text.typography.horizontalAlign = oldStyle.align === 'left' ? 'right' : 'left';
    else if (field === 'empty') text.content[0].children = [];
    else {
      const leaf = text.content[0].children[0];
      if (!('text' in leaf)) throw new Error('Missing styled leaf');
      leaf[field] = !oldStyle[field];
    }
    const customised = structuredClone(text.typography);
    expect(customised.fontSize).not.toBe(nextStyle.size);
    applyThemeSnapshot(document, next);
    expect(text.typography).toEqual(customised);
  }
);

it('keeps explicit typography overrides and preserves unknown or unbound inline styles', () => {
  const { document, text, next } = styledFixture();
  text.overrides.push('typography.fontSize');
  const customised = structuredClone(text.typography);
  const unknown = {
    id: crypto.randomUUID(),
    text: 'Unavailable style',
    textStyleId: crypto.randomUUID(),
  };
  const plain = { id: crypto.randomUUID(), text: 'Plain text' };
  const nested = {
    id: crypto.randomUUID(),
    type: 'a',
    children: [{ id: crypto.randomUUID(), text: 'Link' }],
  };
  text.content[0].children.push(unknown, plain, nested);
  applyThemeSnapshot(document, next);
  expect(text.typography).toEqual(customised);
  expect(text.content[0].children.slice(1)).toEqual([unknown, plain, nested]);
  expect(text.overrides).toContain('typography.fontSize');
});

it('adopts a newly available node style when no previous definition exists', () => {
  const { document, text, next, nextStyle } = styledFixture();
  document.theme.textStyles = [];
  applyThemeSnapshot(document, next);
  expect(text.typography.fontSize).toBe(nextStyle.size);
});

it('preserves unbound node typography and content references when its definition has been removed', () => {
  const { document, text, next } = styledFixture();
  next.textStyles = [];
  const before = structuredClone(text.content);
  const typography = structuredClone(text.typography);
  applyThemeSnapshot(document, next);
  expect(text.content).toEqual(before);
  expect(text.typography).toEqual(typography);
  text.typography.textStyleId = null;
  applyThemeSnapshot(document, next);
  expect(text.typography.textStyleId).toBeNull();
});

function apiRow() {
  return {
    id: POLITY_THEME.id,
    name: 'Imported native theme',
    light_palette: POLITY_THEME.light,
    dark_palette: POLITY_THEME.dark,
    fonts: POLITY_THEME.fonts,
  };
}

it.each(['builtin', 'personal', 'group', 'explicit'] as const)(
  'imports API theme defaults for the %s ownership scope',
  scope => {
    const ownerId = crypto.randomUUID(),
      groupId = crypto.randomUUID();
    const fields =
      scope === 'personal'
        ? { owner_id: ownerId }
        : scope === 'group'
          ? { group_id: groupId }
          : scope === 'explicit'
            ? { kind: 'personal' }
            : {};
    const result = themeFromApiRow({ ...apiRow(), ...fields });
    expect(result.scope).toBe(scope === 'explicit' ? 'personal' : scope);
    expect(result.mode).toBe('light');
    expect(result.revisionId).toBeNull();
    expect(result.textStyles).toEqual([]);
  }
);

it('imports explicit API metadata and dark revision while rejecting a missing required name', () => {
  const revisionId = crypto.randomUUID();
  const result = themeFromApiRow({
    ...apiRow(),
    slug: 'explicit-theme',
    kind: 'group',
    group_id: crypto.randomUUID(),
    owner_id: crypto.randomUUID(),
    description: 'Theme description',
    version: 3,
    text_styles: POLITY_THEME.textStyles,
    mode: 'dark',
    revision_id: revisionId,
  });
  expect(result).toMatchObject({
    name: 'Imported native theme',
    mode: 'dark',
    revisionId,
    scope: 'group',
    textStyles: POLITY_THEME.textStyles,
  });
  expect(themeFromApiRow({ ...apiRow(), revision_id: 4 }).revisionId).toBeNull();
  expect(() => themeFromApiRow({ ...apiRow(), name: undefined })).toThrow();
});

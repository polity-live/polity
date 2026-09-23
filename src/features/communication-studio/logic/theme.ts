import { z } from 'zod';
import {
  appearanceThemeDefinitionSchema,
  FONT_FAMILIES,
  themeFontsSchema,
  themePaletteRoleSchema,
  themePaletteSchema,
  themeTextStyleSchema,
  type AppearanceThemeDefinition,
  type FontId,
  type ThemePalette,
  type ThemePaletteRole,
  type ThemeTextStyle,
} from '@/features/shared/appearance-theme/contract';
import { POLITY_THEME } from '@/features/shared/appearance-theme/presets';
import type { StudioBrand } from './document';
import type { StudioDocumentV3, StudioNode } from './document-v3';

export const studioThemeSnapshotSchema = z.object({
  themeId: z.string().uuid(),
  revisionId: z.string().uuid().nullable(),
  scope: z.enum(['builtin', 'personal', 'group']),
  name: z.string().min(1).max(120),
  mode: z.enum(['light', 'dark']),
  light: themePaletteSchema,
  dark: themePaletteSchema,
  fonts: themeFontsSchema,
  textStyles: z.array(themeTextStyleSchema).max(50),
});
export type StudioThemeSnapshot = z.infer<typeof studioThemeSnapshotSchema>;

const familyById: Record<FontId, StudioBrand['font']> = {
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

export function themeFontFamily(font: FontId): StudioBrand['font'] {
  return familyById[font];
}

export function themeCssFontFamily(font: FontId): string {
  return FONT_FAMILIES[font];
}

export function createThemeSnapshot(
  definition: AppearanceThemeDefinition = POLITY_THEME,
  mode: StudioThemeSnapshot['mode'] = 'light',
  revisionId: string | null = null
): StudioThemeSnapshot {
  const theme = appearanceThemeDefinitionSchema.parse(definition);
  return studioThemeSnapshotSchema.parse({
    themeId: theme.id,
    revisionId,
    scope: theme.kind,
    name: theme.name,
    mode,
    light: theme.light,
    dark: theme.dark,
    fonts: theme.fonts,
    textStyles: theme.textStyles,
  });
}

export const DEFAULT_STUDIO_THEME = createThemeSnapshot();

export function activePalette(theme: StudioThemeSnapshot): ThemePalette {
  return theme[theme.mode];
}

export function paletteColor(palette: ThemePalette, role: ThemePaletteRole): string {
  if (role.startsWith('chart')) {
    const index = Number(role.slice('chart'.length)) - 1;
    return palette.charts[index] ?? palette.foreground;
  }
  return String(palette[role as Exclude<ThemePaletteRole, `chart${number}`>]);
}

export function themeToLegacyBrand(theme: StudioThemeSnapshot): StudioBrand {
  const palette = activePalette(theme);
  return {
    background: palette.background,
    foreground: palette.foreground,
    accent: palette.accent,
    font: themeFontFamily(theme.fonts.display),
    bodyFont: themeFontFamily(theme.fonts.sans),
    logoAssetId: null,
    themeId: theme.themeId,
    revisionId: theme.revisionId,
  };
}

function paletteEntries(palette: ThemePalette): [ThemePaletteRole, string][] {
  const entries = Object.entries(palette)
    .filter(([key]) => key !== 'charts')
    .map(([key, value]) => [key as ThemePaletteRole, String(value)] as [ThemePaletteRole, string]);
  palette.charts.forEach((value, index) =>
    entries.push([`chart${index + 1}` as ThemePaletteRole, value])
  );
  return entries;
}

function inferRole(palette: ThemePalette, value: string | null): ThemePaletteRole | null {
  if (!value) return null;
  return (
    paletteEntries(palette).find(([, color]) => color.toLowerCase() === value.toLowerCase())?.[0] ??
    null
  );
}

function styleMatches(node: Extract<StudioNode, { type: 'richText' }>, style: ThemeTextStyle) {
  const runs = node.content.flatMap(block =>
    block.children.filter(
      (child): child is Extract<(typeof block.children)[number], { text: string }> =>
        'text' in child
    )
  );
  const every = (key: 'bold' | 'italic' | 'underline') =>
    runs.length > 0 && runs.every(run => run[key] === style[key]);
  return (
    node.typography.fontFamily === themeFontFamily(style.font) &&
    node.typography.fontSize === style.size &&
    node.typography.lineHeight === style.lineHeight &&
    node.typography.letterSpacing === style.letterSpacing &&
    node.typography.horizontalAlign === style.align &&
    every('bold') &&
    every('italic') &&
    every('underline')
  );
}

export function applyTextStyleToNode(
  node: Extract<StudioNode, { type: 'richText' }>,
  style: ThemeTextStyle,
  palette = DEFAULT_STUDIO_THEME.light
) {
  node.typography.fontFamily = themeFontFamily(style.font);
  node.typography.fontSize = style.size;
  node.typography.lineHeight = style.lineHeight;
  node.typography.letterSpacing = style.letterSpacing;
  node.typography.horizontalAlign = style.align;
  node.content = node.content.map(block => ({
    ...block,
    align: style.align,
    children: block.children.map(child =>
      'text' in child
        ? {
            ...child,
            fontFamily: themeFontFamily(style.font),
            fontSize: style.size,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            textStyleId: style.id,
            colorBinding: style.color,
            color: paletteColor(palette, style.color),
          }
        : child
    ),
  }));
  node.typography.textStyleId = style.id;
  node.style.fillBinding = style.color;
  node.style.fill = paletteColor(palette, style.color);
  node.overrides = node.overrides.filter(key => !key.startsWith('typography.'));
}

/** Applies a new immutable theme revision while retaining explicitly customised fields. */
export function applyThemeSnapshot(document: StudioDocumentV3, next: StudioThemeSnapshot) {
  const previous = document.theme;
  const oldPalette = activePalette(previous);
  const newPalette = activePalette(next);
  const oldStyles = new Map(previous.textStyles.map(style => [style.id, style]));
  const newStyles = new Map(next.textStyles.map(style => [style.id, style]));

  for (const node of document.nodes) {
    for (const field of ['fill', 'stroke'] as const) {
      const overrideKey = `style.${field}`;
      const overridden = node.overrides.includes(overrideKey);
      const role =
        node.style[`${field}Binding` as const] ?? inferRole(oldPalette, node.style[field]);
      if (role && !overridden) {
        node.style[`${field}Binding` as 'fillBinding' | 'strokeBinding'] = role;
        node.style[field] = paletteColor(newPalette, role);
      } else if (node.style[field] && !role && !node.overrides.includes(overrideKey)) {
        node.overrides.push(overrideKey);
      }
    }
    if (node.type !== 'richText') continue;
    node.content = node.content.map(block => ({
      ...block,
      children: block.children.map(child => {
        if (!('text' in child) || !child.textStyleId) return child;
        const style = newStyles.get(child.textStyleId);
        if (!style) return child;
        return {
          ...child,
          fontFamily: themeFontFamily(style.font),
          fontSize: style.size,
          color: paletteColor(newPalette, style.color),
          colorBinding: style.color,
          bold: style.bold,
          italic: style.italic,
          underline: style.underline,
        };
      }),
    }));
    const styleId = node.typography.textStyleId;
    const oldStyle = styleId ? oldStyles.get(styleId) : undefined;
    const nextStyle = styleId ? newStyles.get(styleId) : undefined;
    const typographyOverridden = node.overrides.some(key => key.startsWith('typography.'));
    if (nextStyle && !typographyOverridden && (!oldStyle || styleMatches(node, oldStyle))) {
      applyTextStyleToNode(node, nextStyle, newPalette);
      node.style.fillBinding = nextStyle.color;
      node.style.fill = paletteColor(newPalette, nextStyle.color);
    }
  }
  document.theme = studioThemeSnapshotSchema.parse(next);
}

export function themeFromApiRow(row: Record<string, unknown>): StudioThemeSnapshot {
  const definition = appearanceThemeDefinitionSchema.parse({
    id: row.id,
    slug:
      row.slug ??
      String(row.name ?? 'theme')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    name: row.name,
    description: row.description ?? undefined,
    kind: row.kind ?? (row.group_id ? 'group' : row.owner_id ? 'personal' : 'builtin'),
    groupId: row.group_id ?? null,
    ownerId: row.owner_id ?? null,
    version: row.version ?? 1,
    light: row.light_palette,
    dark: row.dark_palette,
    fonts: row.fonts,
    textStyles: row.text_styles ?? [],
  });
  return createThemeSnapshot(
    definition,
    row.mode === 'dark' ? 'dark' : 'light',
    typeof row.revision_id === 'string' ? row.revision_id : null
  );
}

export const themePaletteRole = themePaletteRoleSchema;

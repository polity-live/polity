import { z } from 'zod';

export const colorModeSchema = z.enum(['light', 'dark', 'system']);
export type ColorMode = z.infer<typeof colorModeSchema>;

export const fontIdSchema = z.enum([
  'newsreader',
  'manrope',
  'jetbrains-mono',
  'open-sans',
  'inter',
  'ibm-plex-serif',
  'public-sans',
  'pt-sans',
  'work-sans',
  'ubuntu',
]);
export type FontId = z.infer<typeof fontIdSchema>;

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Expected a six-digit hex color')
  .transform(value => value.toUpperCase());

export const themePaletteSchema = z.object({
  background: hexColorSchema,
  foreground: hexColorSchema,
  card: hexColorSchema,
  cardForeground: hexColorSchema,
  primary: hexColorSchema,
  primaryForeground: hexColorSchema,
  secondary: hexColorSchema,
  secondaryForeground: hexColorSchema,
  muted: hexColorSchema,
  mutedForeground: hexColorSchema,
  accent: hexColorSchema,
  accentForeground: hexColorSchema,
  border: hexColorSchema,
  input: hexColorSchema,
  ring: hexColorSchema,
  brand: hexColorSchema,
  highlight: hexColorSchema,
  success: hexColorSchema,
  successForeground: hexColorSchema,
  destructive: hexColorSchema,
  destructiveForeground: hexColorSchema,
  charts: z.tuple([hexColorSchema, hexColorSchema, hexColorSchema, hexColorSchema, hexColorSchema]),
});
export type ThemePalette = z.infer<typeof themePaletteSchema>;

export const themeFontsSchema = z.object({
  display: fontIdSchema,
  sans: fontIdSchema,
  mono: fontIdSchema,
});
export type ThemeFonts = z.infer<typeof themeFontsSchema>;

export const appearanceThemeDefinitionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().max(280).optional(),
  kind: z.enum(['builtin', 'group']),
  groupId: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  light: themePaletteSchema,
  dark: themePaletteSchema,
  fonts: themeFontsSchema,
});
export type AppearanceThemeDefinition = z.infer<typeof appearanceThemeDefinitionSchema>;

export const FONT_FAMILIES: Record<FontId, string> = {
  newsreader: "'Newsreader', Georgia, Cambria, 'Times New Roman', serif",
  manrope: "'Manrope', ui-sans-serif, system-ui, sans-serif",
  'jetbrains-mono': "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
  'open-sans': "'Open Sans', ui-sans-serif, system-ui, sans-serif",
  inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  'ibm-plex-serif': "'IBM Plex Serif', Georgia, serif",
  'public-sans': "'Public Sans', ui-sans-serif, system-ui, sans-serif",
  'pt-sans': "'PT Sans', ui-sans-serif, system-ui, sans-serif",
  'work-sans': "'Work Sans', ui-sans-serif, system-ui, sans-serif",
  ubuntu: "'Ubuntu', ui-sans-serif, system-ui, sans-serif",
};

export interface ContrastIssue {
  field: keyof ThemePalette;
  pairedWith: keyof ThemePalette;
  ratio: number;
  minimum: number;
}

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.slice(1);
  const red = channelToLinear(Number.parseInt(value.slice(0, 2), 16));
  const green = channelToLinear(Number.parseInt(value.slice(2, 4), 16));
  const blue = channelToLinear(Number.parseInt(value.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

const REQUIRED_CONTRAST_PAIRS = [
  ['foreground', 'background', 4.5],
  ['cardForeground', 'card', 4.5],
  ['primaryForeground', 'primary', 4.5],
  ['secondaryForeground', 'secondary', 4.5],
  ['mutedForeground', 'muted', 4.5],
  ['accentForeground', 'accent', 4.5],
  ['successForeground', 'success', 4.5],
  ['destructiveForeground', 'destructive', 4.5],
  ['primary', 'background', 3],
  ['ring', 'background', 3],
] as const satisfies readonly [keyof ThemePalette, keyof ThemePalette, number][];

export function validatePaletteContrast(palette: ThemePalette): ContrastIssue[] {
  return REQUIRED_CONTRAST_PAIRS.flatMap(([foreground, background, minimum]) => {
    const ratio = contrastRatio(palette[foreground] as string, palette[background] as string);
    return ratio + Number.EPSILON < minimum
      ? [{ field: foreground, pairedWith: background, ratio, minimum }]
      : [];
  });
}

export function validateThemeForPublishing(theme: {
  light: ThemePalette;
  dark: ThemePalette;
}): ContrastIssue[] {
  return [...validatePaletteContrast(theme.light), ...validatePaletteContrast(theme.dark)];
}

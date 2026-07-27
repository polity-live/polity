import { FONT_FAMILIES, type AppearanceThemeDefinition, type ThemePalette } from './contract';

export const APPEARANCE_THEME_CACHE_KEY = 'polity-appearance-theme';
export const APPEARANCE_THEME_CSS_CACHE_KEY = 'polity-appearance-theme-css';
export const APPEARANCE_THEME_STYLE_ID = 'polity-runtime-theme';

const PALETTE_VARIABLES: Record<Exclude<keyof ThemePalette, 'charts'>, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  brand: '--brand',
  highlight: '--highlight',
  success: '--success',
  successForeground: '--success-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
};

function paletteVariables(palette: ThemePalette): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [field, variable] of Object.entries(PALETTE_VARIABLES)) {
    result[variable] = palette[field as keyof typeof PALETTE_VARIABLES];
  }
  palette.charts.forEach((color, index) => {
    result[`--chart-${index + 1}`] = color;
  });

  const badge = (base: string) => ({
    bg: `color-mix(in oklab, ${base} 16%, ${palette.card} 84%)`,
    fg: palette.cardForeground,
    border: `color-mix(in oklab, ${base} 58%, ${palette.border} 42%)`,
  });
  const badges = {
    success: badge(palette.success),
    warning: badge(palette.highlight),
    danger: badge(palette.destructive),
    info: badge(palette.charts[0]),
    neutral: badge(palette.mutedForeground),
    accent: badge(palette.brand),
  };
  const badgeVariables = Object.fromEntries(
    Object.entries(badges).flatMap(([name, values]) =>
      Object.entries(values).map(([part, value]) => [`--badge-${name}-${part}`, value])
    )
  );

  const entityNames = ['user', 'group', 'event', 'amendment', 'blog'] as const;
  const entityVariables = Object.fromEntries(
    entityNames.flatMap((name, index) => {
      const base = palette.charts[index];
      const background = `color-mix(in oklab, ${base} 15%, ${palette.card} 85%)`;
      return [
        [`--entity-${name}-base`, base],
        [`--entity-${name}-bg`, background],
        [`--entity-${name}-fg`, palette.cardForeground],
        [`--entity-${name}-border`, `color-mix(in oklab, ${base} 54%, ${palette.border} 46%)`],
        [`--entity-${name}-ring`, `color-mix(in oklab, ${base} 38%, transparent)`],
        [
          `--entity-${name}-gradient`,
          `linear-gradient(135deg, ${background} 0%, ${palette.background} 100%)`,
        ],
      ];
    })
  );

  return {
    ...result,
    ...badgeVariables,
    ...entityVariables,
    '--popover': palette.card,
    '--popover-foreground': palette.cardForeground,
    '--sidebar': palette.card,
    '--sidebar-foreground': palette.cardForeground,
    '--sidebar-primary': palette.primary,
    '--sidebar-primary-foreground': palette.primaryForeground,
    '--sidebar-accent': palette.secondary,
    '--sidebar-accent-foreground': palette.secondaryForeground,
    '--sidebar-border': palette.border,
    '--sidebar-ring': palette.ring,
    '--surface': palette.secondary,
    '--surface-raised': palette.card,
    '--surface-muted': palette.muted,
    '--surface-sunken': palette.background,
    '--surface-overlay': `color-mix(in srgb, ${palette.card} 94%, transparent)`,
    '--border-subtle': `color-mix(in oklab, ${palette.border} 68%, transparent)`,
    '--tooltip': palette.foreground,
    '--tooltip-foreground': palette.background,
    '--tooltip-border': palette.border,
    '--tooltip-shortcut-bg': `color-mix(in srgb, ${palette.background} 12%, transparent)`,
    '--tooltip-shortcut-border': `color-mix(in srgb, ${palette.background} 24%, transparent)`,
    '--scrollbar-track': `color-mix(in oklab, ${palette.background} 88%, ${palette.brand} 12%)`,
    '--scrollbar-thumb': `color-mix(in oklab, ${palette.brand} 50%, ${palette.card} 50%)`,
    '--scrollbar-thumb-hover': `color-mix(in oklab, ${palette.highlight} 34%, ${palette.brand} 66%)`,
  };
}

function serializeVariables(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}

export function buildThemeCss(theme: AppearanceThemeDefinition): string {
  const fontVariables = {
    '--font-display-family': FONT_FAMILIES[theme.fonts.display],
    '--font-sans-family': FONT_FAMILIES[theme.fonts.sans],
    '--font-mono-family': FONT_FAMILIES[theme.fonts.mono],
  };
  const light = serializeVariables({ ...paletteVariables(theme.light), ...fontVariables });
  const dark = serializeVariables({ ...paletteVariables(theme.dark), ...fontVariables });
  return `:root{${light}}:root.dark{${dark}}`;
}

export function applyAppearanceTheme(theme: AppearanceThemeDefinition): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(APPEARANCE_THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = APPEARANCE_THEME_STYLE_ID;
    document.head.append(style);
  }
  const css = buildThemeCss(theme);
  style.textContent = css;
  document.documentElement.dataset.appearanceTheme = theme.slug;

  try {
    localStorage.setItem(APPEARANCE_THEME_CACHE_KEY, JSON.stringify(theme));
    localStorage.setItem(APPEARANCE_THEME_CSS_CACHE_KEY, css);
  } catch (error) {
    console.error('Failed to cache appearance theme:', error);
  }
}

export function applyThemeMetadata(isDark: boolean, theme: AppearanceThemeDefinition): void {
  if (typeof document === 'undefined') return;
  const palette = isDark ? theme.dark : theme.light;
  const resolvedMode = isDark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = resolvedMode;
  let colorSchemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!colorSchemeMeta) {
    colorSchemeMeta = document.createElement('meta');
    colorSchemeMeta.name = 'color-scheme';
    document.head.append(colorSchemeMeta);
  }
  colorSchemeMeta.content = resolvedMode;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = palette.background;
}

export function parseCachedAppearanceTheme(raw: string | null): AppearanceThemeDefinition | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AppearanceThemeDefinition;
    return value?.id && value?.light && value?.dark && value?.fonts ? value : null;
  } catch {
    return null;
  }
}

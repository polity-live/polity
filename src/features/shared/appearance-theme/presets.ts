import type { AppearanceThemeDefinition, ThemeFonts, ThemePalette } from './contract';

export const BUILTIN_THEME_IDS = {
  polity: '00000000-0000-4000-8000-000000000001',
  spd: '00000000-0000-4000-8000-000000000002',
  cdu: '00000000-0000-4000-8000-000000000003',
  fdp: '00000000-0000-4000-8000-000000000004',
  gruene: '00000000-0000-4000-8000-000000000005',
  linke: '00000000-0000-4000-8000-000000000006',
  volt: '00000000-0000-4000-8000-000000000007',
} as const;

const polityLight: ThemePalette = {
  background: '#F7F5EF',
  foreground: '#17201C',
  card: '#FFFCF6',
  cardForeground: '#17201C',
  primary: '#12362D',
  primaryForeground: '#FFFCF6',
  secondary: '#EEEAE1',
  secondaryForeground: '#17201C',
  muted: '#EEEAE1',
  mutedForeground: '#545E58',
  accent: '#F5ECD8',
  accentForeground: '#6C4A16',
  border: '#D9D2C3',
  input: '#D8D0C0',
  ring: '#8A6425',
  brand: '#12362D',
  highlight: '#8A6425',
  success: '#315C37',
  successForeground: '#FFFFFF',
  destructive: '#9A3D34',
  destructiveForeground: '#FFFFFF',
  charts: ['#2F6F8F', '#4F7D5A', '#9F7500', '#7B4E83', '#B86446'],
};

const polityDark: ThemePalette = {
  background: '#07110E',
  foreground: '#F4EFE4',
  card: '#101A16',
  cardForeground: '#F4EFE4',
  primary: '#F4EFE4',
  primaryForeground: '#07110E',
  secondary: '#18231F',
  secondaryForeground: '#F4EFE4',
  muted: '#18231F',
  mutedForeground: '#B8C1BA',
  accent: '#251F13',
  accentForeground: '#F2D39B',
  border: '#2B3731',
  input: '#2B3731',
  ring: '#C99B4D',
  brand: '#F4EFE4',
  highlight: '#C99B4D',
  success: '#A8C99E',
  successForeground: '#07110E',
  destructive: '#D59088',
  destructiveForeground: '#190B09',
  charts: ['#72B6D1', '#8DB893', '#E3B94F', '#BB8EC2', '#DB9175'],
};

interface PresetInput {
  id: string;
  slug: string;
  name: string;
  description: string;
  primary: string;
  primaryForeground: string;
  darkPrimary?: string;
  darkPrimaryForeground?: string;
  darkAccent?: string;
  charts: ThemePalette['charts'];
  fonts: ThemeFonts;
  lightSurfaces: {
    background: string;
    foreground: string;
    card: string;
    surface: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
  };
  darkSurfaces: {
    background: string;
    foreground: string;
    card: string;
    surface: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
  };
}

function preset(input: PresetInput): AppearanceThemeDefinition {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    description: input.description,
    kind: 'builtin',
    groupId: null,
    version: 1,
    light: {
      ...polityLight,
      background: input.lightSurfaces.background,
      foreground: input.lightSurfaces.foreground,
      card: input.lightSurfaces.card,
      cardForeground: input.lightSurfaces.foreground,
      primary: input.primary,
      primaryForeground: input.primaryForeground,
      secondary: input.lightSurfaces.surface,
      secondaryForeground: input.lightSurfaces.foreground,
      muted: input.lightSurfaces.surface,
      mutedForeground: input.lightSurfaces.mutedForeground,
      accent: input.lightSurfaces.accent,
      accentForeground: input.lightSurfaces.accentForeground,
      border: input.lightSurfaces.border,
      input: input.lightSurfaces.border,
      brand: input.primary,
      ring: input.primary,
      highlight: input.lightSurfaces.accentForeground,
      charts: input.charts,
    },
    dark: {
      ...polityDark,
      background: input.darkSurfaces.background,
      foreground: input.darkSurfaces.foreground,
      card: input.darkSurfaces.card,
      cardForeground: input.darkSurfaces.foreground,
      primary: input.darkPrimary ?? input.primary,
      primaryForeground: input.darkPrimaryForeground ?? input.primaryForeground,
      secondary: input.darkSurfaces.surface,
      secondaryForeground: input.darkSurfaces.foreground,
      muted: input.darkSurfaces.surface,
      mutedForeground: input.darkSurfaces.mutedForeground,
      accent: input.darkSurfaces.accent,
      accentForeground: input.darkSurfaces.accentForeground,
      border: input.darkSurfaces.border,
      input: input.darkSurfaces.border,
      brand: input.darkPrimary ?? input.primary,
      ring: input.darkAccent ?? input.darkSurfaces.accentForeground,
      highlight: input.darkAccent ?? input.darkSurfaces.accentForeground,
      charts: input.charts,
    },
    fonts: input.fonts,
  };
}

export const BUILTIN_THEMES: readonly AppearanceThemeDefinition[] = [
  {
    id: BUILTIN_THEME_IDS.polity,
    slug: 'polity',
    name: 'Polity',
    description: '',
    kind: 'builtin',
    groupId: null,
    version: 1,
    light: polityLight,
    dark: polityDark,
    fonts: { display: 'newsreader', sans: 'manrope', mono: 'jetbrains-mono' },
  },
  preset({
    id: BUILTIN_THEME_IDS.spd,
    slug: 'spd',
    name: 'SPD',
    description: '',
    primary: '#B8183B',
    primaryForeground: '#FFFFFF',
    darkPrimary: '#E3000F',
    darkPrimaryForeground: '#FFFFFF',
    darkAccent: '#FF7A83',
    charts: ['#E3000F', '#B8183B', '#005D69', '#0B90E5', '#046285'],
    fonts: { display: 'open-sans', sans: 'open-sans', mono: 'jetbrains-mono' },
    lightSurfaces: {
      background: '#FFF5F5',
      foreground: '#2B1115',
      card: '#FFFFFF',
      surface: '#F7E3E6',
      mutedForeground: '#6B4C52',
      accent: '#DCEFF1',
      accentForeground: '#005D69',
      border: '#E6BEC5',
    },
    darkSurfaces: {
      background: '#17090C',
      foreground: '#FFF2F3',
      card: '#241014',
      surface: '#32171D',
      mutedForeground: '#D8AEB5',
      accent: '#10292C',
      accentForeground: '#84D0D8',
      border: '#53303A',
    },
  }),
  preset({
    id: BUILTIN_THEME_IDS.cdu,
    slug: 'cdu',
    name: 'CDU',
    description: '',
    primary: '#2D3C4B',
    primaryForeground: '#FFFFFF',
    darkPrimary: '#A7D5DC',
    darkPrimaryForeground: '#17202A',
    darkAccent: '#FFA600',
    charts: ['#52B7C1', '#2D3C4B', '#FFA600', '#BF111B', '#737986'],
    fonts: { display: 'inter', sans: 'ibm-plex-serif', mono: 'jetbrains-mono' },
    lightSurfaces: {
      background: '#F3F8F9',
      foreground: '#182734',
      card: '#FFFFFF',
      surface: '#E1EEF0',
      mutedForeground: '#53656E',
      accent: '#DDF2F4',
      accentForeground: '#2D3C4B',
      border: '#BFD8DC',
    },
    darkSurfaces: {
      background: '#091318',
      foreground: '#EDF8FA',
      card: '#101F26',
      surface: '#183039',
      mutedForeground: '#A8C4C9',
      accent: '#302612',
      accentForeground: '#FFC04D',
      border: '#29464E',
    },
  }),
  preset({
    id: BUILTIN_THEME_IDS.fdp,
    slug: 'fdp',
    name: 'FDP',
    description: '',
    primary: '#032D67',
    primaryForeground: '#FFFFFF',
    darkPrimary: '#FFE000',
    darkPrimaryForeground: '#032D67',
    darkAccent: '#00A7E7',
    charts: ['#032D67', '#FFE000', '#00A7E7', '#315E91', '#D4B900'],
    fonts: { display: 'public-sans', sans: 'public-sans', mono: 'jetbrains-mono' },
    lightSurfaces: {
      background: '#F4F7FC',
      foreground: '#0B203C',
      card: '#FFFFFF',
      surface: '#E3EAF5',
      mutedForeground: '#50617A',
      accent: '#FFF3A3',
      accentForeground: '#032D67',
      border: '#C2CEE0',
    },
    darkSurfaces: {
      background: '#071224',
      foreground: '#F4F8FF',
      card: '#0D1C33',
      surface: '#152945',
      mutedForeground: '#ACC0D0',
      accent: '#29260B',
      accentForeground: '#FFE000',
      border: '#294665',
    },
  }),
  preset({
    id: BUILTIN_THEME_IDS.gruene,
    slug: 'gruene',
    name: 'Die Grünen',
    description: '',
    primary: '#005437',
    primaryForeground: '#FFFFFF',
    darkPrimary: '#B7D889',
    darkPrimaryForeground: '#0A321E',
    darkAccent: '#D9B500',
    charts: ['#005437', '#D9B500', '#4B8F3A', '#8BBE5A', '#0A321E'],
    fonts: { display: 'pt-sans', sans: 'pt-sans', mono: 'jetbrains-mono' },
    lightSurfaces: {
      background: '#F4F8F2',
      foreground: '#112319',
      card: '#FCFFF9',
      surface: '#E3EDDE',
      mutedForeground: '#536258',
      accent: '#F5EFB7',
      accentForeground: '#0A321E',
      border: '#C5D5BC',
    },
    darkSurfaces: {
      background: '#07140D',
      foreground: '#F1F8EE',
      card: '#0D2015',
      surface: '#183021',
      mutedForeground: '#AFC2B3',
      accent: '#302B0C',
      accentForeground: '#E8CC34',
      border: '#2C4936',
    },
  }),
  preset({
    id: BUILTIN_THEME_IDS.linke,
    slug: 'linke',
    name: 'Die Linke',
    description: '',
    primary: '#A80000',
    primaryForeground: '#FFFFFF',
    darkPrimary: '#FF5C5C',
    darkPrimaryForeground: '#220000',
    darkAccent: '#00B19C',
    charts: ['#FF0000', '#6F003C', '#00B19C', '#8100A1', '#2E4FC4'],
    fonts: { display: 'work-sans', sans: 'inter', mono: 'jetbrains-mono' },
    lightSurfaces: {
      background: '#FFF5F8',
      foreground: '#2B101C',
      card: '#FFFFFF',
      surface: '#F2E1E8',
      mutedForeground: '#6E4B59',
      accent: '#F2DDE8',
      accentForeground: '#6F003C',
      border: '#DFBCCB',
    },
    darkSurfaces: {
      background: '#190810',
      foreground: '#FFF2F7',
      card: '#27101A',
      surface: '#361824',
      mutedForeground: '#D5ADBE',
      accent: '#0C2B28',
      accentForeground: '#54DAC8',
      border: '#533041',
    },
  }),
  preset({
    id: BUILTIN_THEME_IDS.volt,
    slug: 'volt',
    name: 'Volt',
    description: '',
    primary: '#502379',
    primaryForeground: '#FFFFFF',
    darkPrimary: '#C69BEA',
    darkPrimaryForeground: '#261038',
    darkAccent: '#FDC220',
    charts: ['#502379', '#FDC220', '#82D0F4', '#1BBE6F', '#E63E12'],
    fonts: { display: 'ubuntu', sans: 'ubuntu', mono: 'jetbrains-mono' },
    lightSurfaces: {
      background: '#F8F5FC',
      foreground: '#241532',
      card: '#FFFFFF',
      surface: '#EDE4F5',
      mutedForeground: '#665474',
      accent: '#FEE8A6',
      accentForeground: '#502379',
      border: '#D5C3E2',
    },
    darkSurfaces: {
      background: '#130A1C',
      foreground: '#FAF2FF',
      card: '#20102D',
      surface: '#311B41',
      mutedForeground: '#C8B2D7',
      accent: '#31270B',
      accentForeground: '#FDC220',
      border: '#4B315C',
    },
  }),
] as const;

export const POLITY_THEME = BUILTIN_THEMES[0];

export function getBuiltinTheme(id: string | null | undefined): AppearanceThemeDefinition | null {
  if (!id) return POLITY_THEME;
  return BUILTIN_THEMES.find(theme => theme.id === id) ?? null;
}

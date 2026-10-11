import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@/zero/observed-query';
import { queries } from '../queries';
import { usePreferenceActions } from '../preferences/usePreferenceActions';
import { usePreferenceState } from '../preferences/usePreferenceState';
import {
  appearanceThemeDefinitionSchema,
  BUILTIN_THEMES,
  getBuiltinTheme,
  POLITY_THEME,
  type AppearanceThemeDefinition,
} from '@/features/shared/appearance-theme';
import { useThemeStore } from '@/features/shared/global-state/theme.store';

interface RevisionLike {
  id: string;
  version: number;
  light_palette: unknown;
  dark_palette: unknown;
  fonts: unknown;
  text_styles?: unknown;
}

interface ThemeRowLike {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  kind: string;
  group_id?: string | null;
  created_by_id?: string | null;
  current_revision?: RevisionLike | null;
}

export function definitionFromThemeRow(row: ThemeRowLike): AppearanceThemeDefinition | null {
  if (!row.current_revision) return null;
  const parsed = appearanceThemeDefinitionSchema.safeParse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    kind: row.kind,
    groupId: row.group_id ?? null,
    ownerId: row.created_by_id ?? null,
    version: row.current_revision.version,
    light: row.current_revision.light_palette,
    dark: row.current_revision.dark_palette,
    fonts: row.current_revision.fonts,
    textStyles: row.current_revision.text_styles ?? [],
  });
  return parsed.success ? parsed.data : null;
}

export function useAvailableAppearanceThemes() {
  const [catalogRows, result] = useQuery(queries.appearanceThemes.catalog({}));
  const customThemes = useMemo(
    () =>
      (Array.isArray(catalogRows) ? catalogRows : []).flatMap(row => {
        if (!['group', 'personal'].includes((row as ThemeRowLike).kind)) return [];
        const theme = definitionFromThemeRow(row as ThemeRowLike);
        return theme ? [theme] : [];
      }),
    [catalogRows]
  );

  return {
    builtinThemes: BUILTIN_THEMES,
    groupThemes: customThemes.filter(theme => theme.kind === 'group'),
    personalThemes: customThemes.filter(theme => theme.kind === 'personal'),
    themes: [...BUILTIN_THEMES, ...customThemes],
    isLoading: result.type === 'unknown',
  };
}

export function useAppearanceThemeSync(): void {
  const { appearanceThemeId, isLoading: preferenceLoading } = usePreferenceState();
  const { updateAppearanceTheme } = usePreferenceActions();
  const setAppearanceTheme = useThemeStore(state => state.setAppearanceTheme);
  const previousFallback = useRef<string | null>(null);
  const builtin = getBuiltinTheme(appearanceThemeId);
  const [selectedRow, selectedResult] = useQuery(
    !preferenceLoading && !builtin && appearanceThemeId
      ? queries.appearanceThemes.selectedGroupTheme({ themeId: appearanceThemeId })
      : undefined
  );

  useEffect(() => {
    if (preferenceLoading) return;
    if (builtin) {
      previousFallback.current = null;
      setAppearanceTheme(builtin);
      return;
    }
    if (!appearanceThemeId) {
      previousFallback.current = null;
      setAppearanceTheme(POLITY_THEME);
      return;
    }
    if (selectedResult.type === 'unknown') return;

    const definition = selectedRow ? definitionFromThemeRow(selectedRow as ThemeRowLike) : null;
    if (definition) {
      previousFallback.current = null;
      setAppearanceTheme(definition);
      return;
    }

    setAppearanceTheme(POLITY_THEME);
    if (appearanceThemeId && previousFallback.current !== appearanceThemeId) {
      previousFallback.current = appearanceThemeId;
      updateAppearanceTheme(null);
    }
  }, [
    appearanceThemeId,
    builtin,
    preferenceLoading,
    selectedResult.type,
    selectedRow,
    setAppearanceTheme,
    updateAppearanceTheme,
  ]);
}

import { Building2, Check, Palette } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import {
  FONT_FAMILIES,
  POLITY_THEME,
  type AppearanceThemeDefinition,
} from '@/features/shared/appearance-theme';
import { useThemeStore } from '@/features/shared/global-state/theme.store';
import { useAvailableAppearanceThemes } from '@/zero/appearance-themes/hooks';
import { usePreferenceActions } from '@/zero/preferences/usePreferenceActions';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import { useTranslation } from '@/features/shared/hooks/use-translation';

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: AppearanceThemeDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onSelect}
      data-action-id="users.appearance.theme.select"
      className={cn(
        'h-auto min-h-32 items-stretch justify-start overflow-hidden p-0 text-left whitespace-normal',
        selected && 'border-primary ring-primary/25 ring-2'
      )}
    >
      <span
        className="flex w-full flex-col"
        style={{
          background: theme.light.background,
          color: theme.light.foreground,
          fontFamily: FONT_FAMILIES[theme.fonts.sans],
        }}
      >
        <span className="flex items-start justify-between gap-3 p-4">
          <span
            className="rounded-lg border px-3 py-2"
            style={{
              background: theme.light.card,
              borderColor: theme.light.border,
            }}
          >
            <span
              className="block text-base font-bold"
              style={{ fontFamily: FONT_FAMILIES[theme.fonts.display] }}
            >
              {theme.name}
            </span>
            <span className="mt-1 block text-xs opacity-75">
              {theme.kind === 'group'
                ? t('pages.user.preferences.groupTheme')
                : t('pages.user.preferences.builtinTheme')}
            </span>
          </span>
          {selected ? (
            <span
              className="rounded-full p-1"
              style={{
                background: theme.light.primary,
                color: theme.light.primaryForeground,
              }}
            >
              <Check className="size-4" />
            </span>
          ) : theme.kind === 'group' ? (
            <Building2 className="size-4 opacity-60" />
          ) : (
            <Palette className="size-4 opacity-60" />
          )}
        </span>
        <span className="mt-auto flex h-9" aria-hidden="true">
          {[
            theme.light.background,
            theme.light.card,
            theme.light.secondary,
            theme.light.primary,
            theme.light.accent,
            theme.dark.secondary,
            theme.dark.background,
          ].map((color, index) => (
            <span key={`${color}-${index}`} className="flex-1" style={{ background: color }} />
          ))}
        </span>
      </span>
    </Button>
  );
}

export function AppearanceThemeSelector() {
  const { t } = useTranslation();
  const { themes, isLoading } = useAvailableAppearanceThemes();
  const { appearanceThemeId, isLoading: preferenceLoading } = usePreferenceState();
  const { updateAppearanceTheme } = usePreferenceActions();
  const setAppearanceTheme = useThemeStore(state => state.setAppearanceTheme);
  const selectedId = appearanceThemeId ?? POLITY_THEME.id;

  if (isLoading || preferenceLoading) {
    return <p className="text-muted-foreground text-sm">{t('common.loading.default')}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map(theme => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={selectedId === theme.id}
            onSelect={() => {
              setAppearanceTheme(theme);
              updateAppearanceTheme(theme.id === POLITY_THEME.id ? null : theme.id);
            }}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {t('pages.user.preferences.organizationDisclaimer')}
      </p>
    </div>
  );
}

import { useThemeStore } from '@/features/shared/global-state/theme.store.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';

export function useThemeToggleController() {
  const theme = useThemeStore(state => state.theme);
  const setTheme = useThemeStore(state => state.setTheme);
  const isMounted = useThemeStore(state => state.isMounted);
  const { t } = useTranslation();

  return {
    currentTheme: isMounted ? theme || 'system' : 'system',
    labels: {
      light: t('navigation.toggles.theme.light'),
      dark: t('navigation.toggles.theme.dark'),
      system: t('navigation.toggles.theme.system'),
    },
    onLight: () => setTheme('light'),
    onDark: () => setTheme('dark'),
    onSystem: () => setTheme('system'),
  };
}

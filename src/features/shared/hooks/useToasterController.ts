import { useThemeStore } from '@/features/shared/global-state/theme.store.tsx';

export function useToasterController() {
  return {
    theme: useThemeStore(state => state.theme),
  };
}

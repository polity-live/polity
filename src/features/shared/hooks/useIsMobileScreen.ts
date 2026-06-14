import { useScreenStore } from '@/features/shared/global-state/screen.store.tsx';

export function useIsMobileScreen() {
  return useScreenStore(state => state.isMobileScreen);
}

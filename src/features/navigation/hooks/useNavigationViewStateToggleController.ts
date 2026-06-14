import { useNavigationStore } from '@/features/navigation/state/navigation.store';

export function useNavigationViewStateToggleController() {
  const { navigationView, setNavigationView } = useNavigationStore();

  return {
    navigationView,
    setNavigationView,
  };
}

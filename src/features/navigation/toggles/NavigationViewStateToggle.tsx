import { useNavigationViewStateToggleController } from '@/features/navigation/hooks/useNavigationViewStateToggleController';
import { NavigationViewStateToggleView } from './NavigationViewStateToggleView';
export function NavigationViewStateToggle() {
  const { navigationView, setNavigationView } = useNavigationViewStateToggleController();
  return (
    <NavigationViewStateToggleView
      navigationView={navigationView}
      setNavigationView={setNavigationView}
    />
  );
}

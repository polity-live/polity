import { useNavigationViewStateToggleController } from '@/features/navigation/hooks/useNavigationViewStateToggleController';
import { StateToggle } from './state-toggle';

export function NavigationViewStateToggle() {
  const { navigationView, setNavigationView } = useNavigationViewStateToggleController();
  return <StateToggle currentState={navigationView} onStateChange={setNavigationView} />;
}

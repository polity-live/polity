import { StateToggle } from './state-toggle';
export interface NavigationViewStateToggleViewProps {
  navigationView: any;
  setNavigationView: any;
}

export function NavigationViewStateToggleView({
  navigationView,
  setNavigationView,
}: NavigationViewStateToggleViewProps) {
  return <StateToggle currentState={navigationView} onStateChange={setNavigationView} />;
}

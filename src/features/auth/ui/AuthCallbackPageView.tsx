import { GlobalLoadingAnimation } from '@/features/shared/ui/feedback';

export function AuthCallbackPageView() {
  return <GlobalLoadingAnimation connectionStatus="connecting" />;
}

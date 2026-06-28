import { AppBootLoadingState } from '@/features/shared/ui/feedback';

export function AuthCallbackPageView() {
  return <AppBootLoadingState details="/auth/callback" onRetry={() => window.location.reload()} />;
}

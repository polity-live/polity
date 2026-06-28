import { Navigate } from '@tanstack/react-router';

import { OnboardingWizard } from '@/features/auth/onboarding/OnboardingWizard';
import { PublicLandingPage } from '@/features/public-landing/ui/PublicLandingPage';
import { AppBootLoadingState } from '@/features/shared/ui/feedback';
export interface HomePageContainerViewProps {
  viewState: any;
}

export function HomePageContainerView({ viewState }: HomePageContainerViewProps) {
  if (viewState.kind === 'loading') {
    return (
      <AppBootLoadingState
        onRetry={viewState.onRetry}
        onSignOut={viewState.onSignOut}
        details="/"
      />
    );
  }

  if (viewState.kind === 'public') {
    return <PublicLandingPage />;
  }

  if (viewState.kind === 'onboarding') {
    return (
      <OnboardingWizard
        userId={viewState.userId}
        userEmail={viewState.userEmail}
        onComplete={viewState.onComplete}
      />
    );
  }

  return <Navigate to="/home" />;
}

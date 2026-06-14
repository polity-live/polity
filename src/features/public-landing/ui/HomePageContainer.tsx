import { Navigate } from '@tanstack/react-router';

import { OnboardingWizard } from '@/features/auth/onboarding/OnboardingWizard';
import { useHomePageController } from '@/features/public-landing/hooks/useHomePageController';
import { PublicLandingPage } from '@/features/public-landing/ui/PublicLandingPage';

export function HomePageContainer() {
  const viewState = useHomePageController();

  if (viewState.kind === 'loading') {
    return null;
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

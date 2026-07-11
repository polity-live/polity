import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { OnboardingWizard } from '@/features/auth/onboarding/OnboardingWizard';
import { PublicLandingPage } from '@/features/public-landing/ui/PublicLandingPage';
import { AppBootLoadingState } from '@/features/shared/ui/feedback';
export interface HomePageContainerViewProps {
  viewState: any;
}

function HomeRedirect() {
  const navigate = useNavigate();
  const navigationStartedRef = useRef(false);

  useEffect(() => {
    if (navigationStartedRef.current) return;
    navigationStartedRef.current = true;
    void navigate({ to: '/home', replace: true });
  }, [navigate]);

  return null;
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

  return <HomeRedirect />;
}

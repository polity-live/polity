import { useRef, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useZeroReady } from '@/providers/zero-ready-context';
import { useUserState } from '@/zero/users/useUserState';

const ONBOARDING_KEY = 'polity_onboarding';

type HomePageViewState =
  | { kind: 'public' }
  | { kind: 'loading'; onRetry: () => Promise<void>; onSignOut: () => Promise<void> }
  | { kind: 'onboarding'; userId: string; userEmail: string; onComplete: () => void }
  | { kind: 'redirect' };

export function useHomePageController(): HomePageViewState {
  const { user, refreshAuthState, signOut } = useAuth();
  const zeroReady = useZeroReady();
  const { currentUser } = useUserState();
  const onboardingActiveRef = useRef(false);

  const [showOnboarding] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const value = sessionStorage.getItem(ONBOARDING_KEY) === 'true';

    return value;
  });

  if (!user || !zeroReady) {
    return { kind: 'loading', onRetry: refreshAuthState, onSignOut: signOut };
  }

  if (currentUser == null && !showOnboarding) {
    return { kind: 'loading', onRetry: refreshAuthState, onSignOut: signOut };
  }

  const hasCompletedOnboarding = currentUser != null && !!currentUser.first_name;
  const needsOnboarding =
    !hasCompletedOnboarding && (showOnboarding || (currentUser != null && !currentUser.first_name));

  if (needsOnboarding) {
    onboardingActiveRef.current = true;
  }

  if (onboardingActiveRef.current) {
    return {
      kind: 'onboarding',
      userId: user.id,
      userEmail: user.email,
      onComplete: () => {
        sessionStorage.removeItem(ONBOARDING_KEY);
      },
    };
  }

  return { kind: 'redirect' };
}

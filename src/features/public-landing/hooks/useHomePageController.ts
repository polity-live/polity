import { useEffect, useRef, useState } from 'react';

import { useLocation } from '@tanstack/react-router';

import { useAuth } from '@/providers/auth-provider';
import { useZeroReady } from '@/providers/zero-provider';
import { useUserState } from '@/zero/users/useUserState';

const ONBOARDING_KEY = 'polity_onboarding';

type HomePageViewState =
  | { kind: 'public' }
  | { kind: 'loading' }
  | { kind: 'onboarding'; userId: string; userEmail: string; onComplete: () => void }
  | { kind: 'redirect' };

export function useHomePageController(): HomePageViewState {
  const { hash } = useLocation();
  const { user } = useAuth();
  const zeroReady = useZeroReady();
  const { currentUser } = useUserState();
  const onboardingActiveRef = useRef(false);

  const [showOnboarding] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const value = sessionStorage.getItem(ONBOARDING_KEY) === 'true';
    console.log('[HomePage] Initial showOnboarding from sessionStorage:', value);

    return value;
  });

  useEffect(() => {
    if (!hash) {
      return;
    }

    const sectionId = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!sectionId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hash]);

  console.log(
    '[HomePage] Render - user:',
    !!user,
    'zeroReady:',
    zeroReady,
    'showOnboarding:',
    showOnboarding
  );

  if (!user || !zeroReady) {
    return { kind: 'public' };
  }

  if (currentUser == null && !showOnboarding) {
    return { kind: 'loading' };
  }

  const hasCompletedOnboarding = currentUser != null && !!currentUser.first_name;
  const needsOnboarding =
    !hasCompletedOnboarding && (showOnboarding || (currentUser != null && !currentUser.first_name));

  if (needsOnboarding) {
    onboardingActiveRef.current = true;
  }

  if (onboardingActiveRef.current) {
    console.log('[HomePage] Showing OnboardingWizard');

    return {
      kind: 'onboarding',
      userId: user.id,
      userEmail: user.email,
      onComplete: () => {
        console.log('[HomePage] Onboarding complete - clearing sessionStorage flag');
        sessionStorage.removeItem(ONBOARDING_KEY);
      },
    };
  }

  console.log('[HomePage] User ready, no onboarding - redirecting to /home');
  return { kind: 'redirect' };
}

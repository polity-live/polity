import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { PublicLandingPage } from '@/features/public-landing/ui/PublicLandingPage';
import { useAuth } from '@/providers/auth-provider';
import { useZeroReady } from '@/providers/zero-provider';
import { OnboardingWizard } from '@/features/auth/onboarding/OnboardingWizard';
import { useUserState } from '@/zero/users/useUserState';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const ONBOARDING_KEY = 'polity_onboarding';

function HomePage() {
  const { user } = useAuth();
  const zeroReady = useZeroReady();

  // Read onboarding flag from sessionStorage (set by VerifyForm before navigation)
  const [showOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    const val = sessionStorage.getItem(ONBOARDING_KEY) === 'true';
    console.log('[HomePage] Initial showOnboarding from sessionStorage:', val);
    return val;
  });

  console.log(
    '[HomePage] Render — user:',
    !!user,
    'zeroReady:',
    zeroReady,
    'showOnboarding:',
    showOnboarding
  );

  // When authenticated and Zero is ready, delegate to a child that can safely use Zero hooks
  if (user && zeroReady) {
    return <AuthenticatedHome user={user} showOnboarding={showOnboarding} />;
  }

  return <PublicLandingPage />;
}

/**
 * Rendered only when authenticated + ZeroProvider is available.
 * Safe to call Zero hooks here.
 */
function AuthenticatedHome({
  user,
  showOnboarding,
}: {
  user: { id: string; email: string };
  showOnboarding: boolean;
}) {
  const { currentUser } = useUserState();
  // Use a ref (not useState) so the lock is immediate and survives concurrent re-renders.
  // Once set to true, it stays true for this mount — no state batching can revert it.
  const onboardingActiveRef = useRef(false);

  // Wait for Zero to load the user record before deciding.
  // Without this, we'd immediately navigate to /home while the DB check is still pending.
  if (currentUser == null && !showOnboarding) {
    return null;
  }

  // Database-driven check: if user already has first_name, onboarding is done.
  const hasCompletedOnboarding = currentUser != null && !!currentUser.first_name;
  const needsOnboarding =
    !hasCompletedOnboarding && (showOnboarding || (currentUser != null && !currentUser.first_name));

  // Lock the wizard permanently (for this mount) once we decide to show it.
  // This prevents Zero-triggered re-renders (e.g. after saving first_name) from
  // flipping needsOnboarding to false and rendering <Navigate to="/home" />.
  if (needsOnboarding) {
    onboardingActiveRef.current = true;
  }

  // While the wizard is (or was) active, keep rendering it — never redirect.
  // The wizard's own navigate() handles the final destination when the user
  // picks profile / group / assistant on the summary step.
  if (onboardingActiveRef.current) {
    console.log('[HomePage] ✅ Showing OnboardingWizard');
    return (
      <OnboardingWizard
        userId={user.id}
        userEmail={user.email}
        onComplete={() => {
          console.log('[HomePage] Onboarding complete — clearing sessionStorage flag');
          sessionStorage.removeItem(ONBOARDING_KEY);
        }}
      />
    );
  }

  console.log('[HomePage] User ready, no onboarding — redirecting to /home');
  return <Navigate to="/home" />;
}

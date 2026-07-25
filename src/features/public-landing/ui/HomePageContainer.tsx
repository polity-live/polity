import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { PublicLandingPage } from './PublicLandingPage';

const AuthenticatedHomePageContainer = lazy(() => import('./AuthenticatedHomePageContainer'));

export function HomePageContainer() {
  const { hash } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user || !hash) return;

    const sectionId = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!sectionId) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hash, user]);

  if (!user) {
    return <PublicLandingPage />;
  }

  return (
    <Suspense fallback={<div className="bg-background min-h-screen" aria-busy="true" />}>
      <AuthenticatedHomePageContainer />
    </Suspense>
  );
}

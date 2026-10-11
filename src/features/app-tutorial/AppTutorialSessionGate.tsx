'use client';

import { lazy, Suspense, useEffect, useState } from 'react';

import { APP_TUTORIAL_SESSION_CHANGE_EVENT, isAppTutorialSessionActive } from './events';

const AppTutorialOrchestrator = lazy(() =>
  import('./AppTutorialOrchestrator').then(module => ({ default: module.AppTutorialOrchestrator }))
);

export function AppTutorialSessionGate({ pathname }: { pathname: string }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const syncSession = () => {
      setIsActive(pathname !== '/onboarding' && isAppTutorialSessionActive());
    };
    syncSession();
    window.addEventListener(APP_TUTORIAL_SESSION_CHANGE_EVENT, syncSession);
    return () => window.removeEventListener(APP_TUTORIAL_SESSION_CHANGE_EVENT, syncSession);
  }, [pathname]);

  return isActive && pathname !== '/onboarding' ? (
    <Suspense fallback={null}>
      <AppTutorialOrchestrator />
    </Suspense>
  ) : null;
}

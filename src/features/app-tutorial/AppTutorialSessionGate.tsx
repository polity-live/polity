'use client';

import { useEffect, useState } from 'react';

import { AppTutorialOrchestrator } from './AppTutorialOrchestrator';
import { APP_TUTORIAL_SESSION_CHANGE_EVENT, isAppTutorialSessionActive } from './events';

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

  return isActive && pathname !== '/onboarding' ? <AppTutorialOrchestrator /> : null;
}

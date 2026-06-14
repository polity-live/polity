'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSAL_STORAGE_KEY = 'pwa-prompt-dismissed';
const DISMISSAL_WINDOW_DAYS = 7;

function wasDismissedRecently() {
  const dismissed = localStorage.getItem(DISMISSAL_STORAGE_KEY);
  if (!dismissed) {
    return false;
  }

  const dismissedAt = Number.parseInt(dismissed, 10);
  if (Number.isNaN(dismissedAt)) {
    return false;
  }

  const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSinceDismissed < DISMISSAL_WINDOW_DAYS;
}

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();

      if (wasDismissedRecently()) {
        return;
      }

      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches || wasDismissedRecently()) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(DISMISSAL_STORAGE_KEY, Date.now().toString());
  };

  return {
    isVisible: showPrompt && Boolean(deferredPrompt),
    handleInstall,
    handleDismiss,
  };
}

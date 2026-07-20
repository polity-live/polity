'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export type PwaInstallStatus =
  'checking' | 'installed' | 'promptable' | 'manual-ios' | 'reload-required' | 'unavailable';
export type PwaInstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown';
export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | null;
export type PwaServiceWorkerStatus =
  'checking' | 'unsupported' | 'registering' | 'registered' | 'ready' | 'controlled' | 'error';
export type PwaInstallPromptSource = 'early-script' | 'react-listener' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

declare global {
  interface Window {
    __polityPwaInstallPromptCaptureReady?: boolean;
    __polityPwaInstallPromptCapturedAt?: number;
    __polityPwaInstallPromptEvent?: BeforeInstallPromptEvent;
  }
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export interface PwaInstallSnapshot {
  status: PwaInstallStatus;
  platform: PwaInstallPlatform;
  outcome: PwaInstallOutcome;
  isInstalled: boolean;
  canPrompt: boolean;
  isInstalling: boolean;
  serviceWorkerStatus: PwaServiceWorkerStatus;
  isControlledByServiceWorker: boolean;
  lastError: string | null;
  promptSource: PwaInstallPromptSource;
}

const INITIAL_SNAPSHOT: PwaInstallSnapshot = {
  status: 'checking',
  platform: 'unknown',
  outcome: null,
  isInstalled: false,
  canPrompt: false,
  isInstalling: false,
  serviceWorkerStatus: 'checking',
  isControlledByServiceWorker: false,
  lastError: null,
  promptSource: null,
};

let snapshot = INITIAL_SNAPSHOT;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
let cleanupInstallListeners: (() => void) | null = null;
let serviceWorkerRegistrationPromise: Promise<void> | null = null;

const PWA_INSTALL_PROMPT_CAPTURED_EVENT = 'polity:pwa-install-prompt-captured';
const subscribers = new Set<() => void>();

function emitChange() {
  subscribers.forEach(listener => listener());
}

function updateSnapshot(nextSnapshot: PwaInstallSnapshot) {
  snapshot = nextSnapshot;
  emitChange();
}

function mergeSnapshot(partial: Partial<PwaInstallSnapshot>) {
  updateSnapshot({
    ...snapshot,
    ...partial,
  });
}

function detectPlatform(): PwaInstallPlatform {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const navigator = window.navigator;
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  if (/iPad|iPhone|iPod/i.test(userAgent) || isTouchMac) {
    return 'ios';
  }

  if (/Android/i.test(userAgent)) {
    return 'android';
  }

  return 'desktop';
}

function isRunningStandalone() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigator = window.navigator as NavigatorWithStandalone;
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  return Boolean(navigator.standalone) || displayModeStandalone;
}

function isServiceWorkerSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

function isControlledByServiceWorker() {
  return isServiceWorkerSupported() && Boolean(navigator.serviceWorker.controller);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isBeforeInstallPromptEvent(event: unknown): event is BeforeInstallPromptEvent {
  return (
    event instanceof Event &&
    typeof (event as Partial<BeforeInstallPromptEvent>).prompt === 'function' &&
    'userChoice' in event
  );
}

function getEarlyCapturedPromptEvent() {
  if (typeof window === 'undefined') {
    return null;
  }

  const event = window.__polityPwaInstallPromptEvent;

  return isBeforeInstallPromptEvent(event) ? event : null;
}

function clearEarlyCapturedPromptEvent(promptEvent: BeforeInstallPromptEvent) {
  if (typeof window !== 'undefined' && window.__polityPwaInstallPromptEvent === promptEvent) {
    delete window.__polityPwaInstallPromptEvent;
    delete window.__polityPwaInstallPromptCapturedAt;
  }
}

function adoptInstallPromptEvent(
  event: BeforeInstallPromptEvent,
  promptSource: Exclude<PwaInstallPromptSource, null>
) {
  event.preventDefault();
  deferredPrompt = event;
  refreshSnapshot({ outcome: null, promptSource });
}

function buildSnapshot(partial?: Partial<PwaInstallSnapshot>): PwaInstallSnapshot {
  const platform = detectPlatform();
  const isInstalled = isRunningStandalone();
  const nextSnapshot = {
    ...snapshot,
    platform,
    isControlledByServiceWorker: isControlledByServiceWorker(),
    ...partial,
  };
  const serviceWorkerStatus = nextSnapshot.serviceWorkerStatus;
  const isCheckingServiceWorker =
    serviceWorkerStatus === 'checking' ||
    serviceWorkerStatus === 'registering' ||
    serviceWorkerStatus === 'registered';
  const needsReload = !nextSnapshot.isControlledByServiceWorker && serviceWorkerStatus === 'ready';

  const status: PwaInstallStatus = isInstalled
    ? 'installed'
    : deferredPrompt
      ? 'promptable'
      : platform === 'ios'
        ? 'manual-ios'
        : isCheckingServiceWorker
          ? 'checking'
          : needsReload
            ? 'reload-required'
            : 'unavailable';

  return {
    ...nextSnapshot,
    status,
    platform,
    isInstalled: status === 'installed',
    canPrompt: status === 'promptable',
    isInstalling:
      status === 'promptable' ? (partial?.isInstalling ?? snapshot.isInstalling) : false,
  };
}

function refreshSnapshot(partial?: Partial<PwaInstallSnapshot>) {
  updateSnapshot(buildSnapshot(partial));
}

function waitForServiceWorkerActivation(registration: ServiceWorkerRegistration) {
  const installingWorker = registration.installing;

  if (!installingWorker) {
    return Promise.resolve();
  }

  if (installingWorker.state === 'activated') {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    const timeout = window.setTimeout(resolve, 3000);

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'activated' || installingWorker.state === 'redundant') {
        window.clearTimeout(timeout);
        resolve();
      }
    });
  });
}

async function registerPwaServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    refreshSnapshot({
      serviceWorkerStatus: 'unsupported',
      isControlledByServiceWorker: false,
      lastError: null,
    });
    return;
  }

  if (serviceWorkerRegistrationPromise) {
    return serviceWorkerRegistrationPromise;
  }

  serviceWorkerRegistrationPromise = (async () => {
    try {
      refreshSnapshot({
        serviceWorkerStatus: 'checking',
        isControlledByServiceWorker: isControlledByServiceWorker(),
        lastError: null,
      });

      let registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        refreshSnapshot({
          serviceWorkerStatus: 'registering',
          isControlledByServiceWorker: isControlledByServiceWorker(),
          lastError: null,
        });

        registration = await navigator.serviceWorker.register('/custom-sw.js', {
          scope: '/',
        });
      }

      refreshSnapshot({
        serviceWorkerStatus: 'registered',
        isControlledByServiceWorker: isControlledByServiceWorker(),
        lastError: null,
      });

      await waitForServiceWorkerActivation(registration);
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<void>(resolve => window.setTimeout(resolve, 3000)),
      ]);

      refreshSnapshot({
        serviceWorkerStatus: isControlledByServiceWorker() ? 'controlled' : 'ready',
        isControlledByServiceWorker: isControlledByServiceWorker(),
        lastError: null,
      });
    } catch (error) {
      console.warn('Failed to register PWA service worker:', error);
      refreshSnapshot({
        serviceWorkerStatus: 'error',
        isControlledByServiceWorker: false,
        lastError: getErrorMessage(error),
      });
    }
  })();

  return serviceWorkerRegistrationPromise;
}

export function initPwaInstallListener() {
  if (typeof window === 'undefined' || initialized) {
    return cleanupInstallListeners;
  }

  initialized = true;
  refreshSnapshot({
    serviceWorkerStatus: isServiceWorkerSupported() ? 'checking' : 'unsupported',
    isControlledByServiceWorker: isControlledByServiceWorker(),
  });

  const handleBeforeInstallPrompt = (event: Event) => {
    adoptInstallPromptEvent(event as BeforeInstallPromptEvent, 'react-listener');
  };

  const handleCapturedInstallPrompt = (event: Event) => {
    const promptEvent = isBeforeInstallPromptEvent(
      (event as CustomEvent<{ promptEvent?: unknown }>).detail?.promptEvent
    )
      ? (event as CustomEvent<{ promptEvent: BeforeInstallPromptEvent }>).detail.promptEvent
      : getEarlyCapturedPromptEvent();

    if (promptEvent) {
      adoptInstallPromptEvent(promptEvent, 'early-script');
    }
  };

  const handleAppInstalled = () => {
    deferredPrompt = null;
    if (typeof window !== 'undefined') {
      delete window.__polityPwaInstallPromptEvent;
      delete window.__polityPwaInstallPromptCapturedAt;
    }
    mergeSnapshot({
      status: 'installed',
      isInstalled: true,
      canPrompt: false,
      isInstalling: false,
      outcome: 'accepted',
      promptSource: null,
    });
  };

  const handleEnvironmentChange = () => {
    refreshSnapshot();
  };

  const handleControllerChange = () => {
    refreshSnapshot({
      serviceWorkerStatus: isControlledByServiceWorker()
        ? 'controlled'
        : snapshot.serviceWorkerStatus,
      isControlledByServiceWorker: isControlledByServiceWorker(),
      lastError: null,
    });
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener(PWA_INSTALL_PROMPT_CAPTURED_EVENT, handleCapturedInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  document.addEventListener('visibilitychange', handleEnvironmentChange);

  const earlyPromptEvent = getEarlyCapturedPromptEvent();

  if (earlyPromptEvent) {
    adoptInstallPromptEvent(earlyPromptEvent, 'early-script');
  }

  if (isServiceWorkerSupported()) {
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
  }

  const displayModeQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;

  if (displayModeQuery?.addEventListener) {
    displayModeQuery.addEventListener('change', handleEnvironmentChange);
  } else if (displayModeQuery?.addListener) {
    displayModeQuery.addListener(handleEnvironmentChange);
  }

  void registerPwaServiceWorker();

  cleanupInstallListeners = () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener(PWA_INSTALL_PROMPT_CAPTURED_EVENT, handleCapturedInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
    document.removeEventListener('visibilitychange', handleEnvironmentChange);

    if (isServiceWorkerSupported()) {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    }

    if (displayModeQuery?.removeEventListener) {
      displayModeQuery.removeEventListener('change', handleEnvironmentChange);
    } else if (displayModeQuery?.removeListener) {
      displayModeQuery.removeListener(handleEnvironmentChange);
    }

    cleanupInstallListeners = null;
    initialized = false;
  };

  return cleanupInstallListeners;
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  initPwaInstallListener();

  return () => {
    subscribers.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return INITIAL_SNAPSHOT;
}

export async function triggerPwaInstall(): Promise<PwaInstallOutcome> {
  if (!deferredPrompt) {
    refreshSnapshot({ outcome: 'unavailable' });
    return 'unavailable';
  }

  const promptEvent = deferredPrompt;
  mergeSnapshot({ isInstalling: true });

  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    if (deferredPrompt === promptEvent) {
      deferredPrompt = null;
    }

    clearEarlyCapturedPromptEvent(promptEvent);

    if (outcome === 'accepted') {
      mergeSnapshot({
        status: 'installed',
        isInstalled: true,
        canPrompt: false,
        isInstalling: false,
        outcome,
        promptSource: null,
      });
    } else {
      refreshSnapshot({ outcome, isInstalling: false, promptSource: null });
    }

    return outcome;
  } catch (error) {
    refreshSnapshot({ isInstalling: false });
    throw error;
  }
}

export function usePwaInstall() {
  const installState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const install = useCallback(() => triggerPwaInstall(), []);
  const reload = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  return {
    ...installState,
    install,
    reload,
  };
}

export function PwaInstallProvider() {
  useEffect(() => {
    initPwaInstallListener();
  }, []);

  return null;
}

export function usePwaInstallPrompt() {
  const { canPrompt, install } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const handleInstall = useCallback(async () => {
    await install();
  }, [install]);

  return {
    isVisible: canPrompt && !isDismissed,
    handleInstall,
    handleDismiss: () => setIsDismissed(true),
  };
}

export function resetPwaInstallStateForTests() {
  cleanupInstallListeners?.();
  subscribers.clear();
  deferredPrompt = null;
  initialized = false;
  serviceWorkerRegistrationPromise = null;
  snapshot = INITIAL_SNAPSHOT;

  if (typeof window !== 'undefined') {
    delete window.__polityPwaInstallPromptEvent;
    delete window.__polityPwaInstallPromptCapturedAt;
    delete window.__polityPwaInstallPromptCaptureReady;
  }
}

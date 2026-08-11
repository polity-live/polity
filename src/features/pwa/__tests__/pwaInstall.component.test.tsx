/* @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import {
  initPwaInstallListener,
  PwaInstallProvider,
  resetPwaInstallStateForTests,
  triggerPwaInstall,
  usePwaInstall,
  usePwaInstallPrompt,
} from '../hooks/usePwaInstallPrompt.ts';
import { PwaInstallPanel } from '../ui/PwaInstallPanel.tsx';

const translations: Record<string, string> = {
  'common.pwa.dismiss': 'Dismiss',
  'common.pwa.installPanel.onboarding.promptableTitle': 'Want to use Polity like an app?',
  'common.pwa.installPanel.onboarding.promptableDescription':
    'Install Polity on this device for quick access.',
  'common.pwa.installPanel.onboarding.manualTitle': 'Want to use Polity from your home screen?',
  'common.pwa.installPanel.onboarding.manualDescription': 'Install from the share menu.',
  'common.pwa.installPanel.settings.promptableTitle': 'Polity is ready to install',
  'common.pwa.installPanel.settings.promptableDescription':
    'Your browser can open the install dialog.',
  'common.pwa.installPanel.settings.manualTitle': 'Install Polity from the share menu',
  'common.pwa.installPanel.settings.manualDescription': 'Use the browser share menu.',
  'common.pwa.installPanel.installedTitle': 'Polity is installed',
  'common.pwa.installPanel.installedDescription': 'Already installed.',
  'common.pwa.installPanel.checkingTitle': 'Checking app installation',
  'common.pwa.installPanel.checkingDescription': 'Preparing installation.',
  'common.pwa.installPanel.reloadRequiredTitle': 'Reload to finish app setup',
  'common.pwa.installPanel.reloadRequiredDescription': 'Reload before installing.',
  'common.pwa.installPanel.unavailableTitle': 'App installation is not available right now',
  'common.pwa.installPanel.unavailableDescription':
    'Your browser may still show installation in the address bar.',
  'common.pwa.installPanel.installAction': 'Install Polity',
  'common.pwa.installPanel.installingAction': 'Installing...',
  'common.pwa.installPanel.reloadAction': 'Reload page',
  'common.pwa.installPanel.dismissedMessage': 'The install dialog was dismissed.',
  'common.pwa.installPanel.iosStepShare': 'Open the share menu.',
  'common.pwa.installPanel.iosStepAdd': 'Choose Add to Home Screen.',
  'common.pwa.installPanel.iosStepConfirm': 'Confirm the name.',
  'common.pwa.installPanel.status.checking': 'Checking',
  'common.pwa.installPanel.status.installed': 'Installed',
  'common.pwa.installPanel.status.promptable': 'Ready to install',
  'common.pwa.installPanel.status.manual-ios': 'Manual install',
  'common.pwa.installPanel.status.reload-required': 'Reload needed',
  'common.pwa.installPanel.status.unavailable': 'Unavailable',
};

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

function mockDisplayMode(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockNavigator({
  maxTouchPoints = 0,
  platform = 'Win32',
  standalone = false,
  userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
}: {
  maxTouchPoints?: number;
  platform?: string;
  standalone?: boolean;
  userAgent?: string;
} = {}) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: standalone,
  });
}

function createBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };

  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome });

  return { event, prompt };
}

function dispatchBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const { event, prompt } = createBeforeInstallPromptEvent(outcome);

  act(() => {
    window.dispatchEvent(event);
  });

  return prompt;
}

function mockServiceWorkerContainer({
  controller = null,
  getRegistration = vi.fn().mockResolvedValue(undefined),
  ready = Promise.resolve({} as ServiceWorkerRegistration),
  register = vi.fn().mockResolvedValue({ installing: null }),
}: {
  controller?: ServiceWorker | null;
  getRegistration?: ReturnType<typeof vi.fn>;
  ready?: Promise<ServiceWorkerRegistration>;
  register?: ReturnType<typeof vi.fn>;
} = {}) {
  let currentController = controller;
  const listeners = new Map<string, EventListener>();
  const serviceWorker = {
    get controller() {
      return currentController;
    },
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener);
    }),
    dispatchControllerChange(nextController: ServiceWorker | null = {} as ServiceWorker) {
      currentController = nextController;
      listeners.get('controllerchange')?.(new Event('controllerchange'));
    },
    getRegistration,
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
    ready,
    register,
  };

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  });

  return serviceWorker;
}

beforeEach(() => {
  Reflect.deleteProperty(window.navigator, 'serviceWorker');
  mockDisplayMode(false);
  mockNavigator();
});

afterEach(() => {
  cleanup();
  resetPwaInstallStateForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePwaInstall', () => {
  it('stores beforeinstallprompt and triggers the browser prompt from install()', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const prompt = dispatchBeforeInstallPrompt('accepted');

    await waitFor(() => expect(result.current.status).toBe('promptable'));

    await act(async () => {
      const outcome = await result.current.install();
      expect(outcome).toBe('accepted');
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('installed');
    expect(result.current.canPrompt).toBe(false);
  });

  it('adopts an install prompt captured before the hook initializes', async () => {
    const { event, prompt } = createBeforeInstallPromptEvent('accepted');
    window.__polityPwaInstallPromptEvent = event;

    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.status).toBe('promptable'));
    expect(result.current.promptSource).toBe('early-script');

    await act(async () => {
      const outcome = await result.current.install();
      expect(outcome).toBe('accepted');
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(window.__polityPwaInstallPromptEvent).toBeUndefined();
  });

  it('adopts an install prompt from the early capture custom event', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event, prompt } = createBeforeInstallPromptEvent('accepted');

    act(() => {
      window.__polityPwaInstallPromptEvent = event;
      window.dispatchEvent(
        new CustomEvent('polity:pwa-install-prompt-captured', {
          detail: { promptEvent: event, capturedAt: Date.now() },
        })
      );
    });

    await waitFor(() => expect(result.current.status).toBe('promptable'));
    expect(result.current.promptSource).toBe('early-script');

    await act(async () => {
      await result.current.install();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('sets installed status when appinstalled fires', async () => {
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    await waitFor(() => expect(result.current.status).toBe('installed'));
    expect(result.current.isInstalled).toBe(true);
  });

  it('detects standalone display mode as installed', async () => {
    mockDisplayMode(true);
    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.status).toBe('installed'));
  });

  it('falls back to manual iOS instructions when no browser prompt exists', async () => {
    mockNavigator({
      platform: 'iPhone',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });

    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.status).toBe('manual-ios'));
    expect(result.current.canPrompt).toBe(false);
  });

  it('detects Android and tolerates missing navigator identification strings', async () => {
    mockNavigator({ userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux armv8l' });
    const android = renderHook(() => usePwaInstall());
    await waitFor(() => expect(android.result.current.platform).toBe('android'));
    android.unmount();

    resetPwaInstallStateForTests();
    mockNavigator({ userAgent: '', platform: '' });
    const unidentified = renderHook(() => usePwaInstall());
    await waitFor(() => expect(unidentified.result.current.platform).toBe('desktop'));
  });

  it('registers the PWA service worker from the provider', async () => {
    const serviceWorker = mockServiceWorkerContainer();

    render(<PwaInstallProvider />);

    await waitFor(() => {
      expect(serviceWorker.getRegistration).toHaveBeenCalledTimes(1);
      expect(serviceWorker.register).toHaveBeenCalledWith('/custom-sw.js', {
        scope: '/',
      });
    });
  });

  it('shows checking while service worker registration is still pending', async () => {
    mockServiceWorkerContainer({
      getRegistration: vi.fn().mockReturnValue(new Promise(() => undefined)),
    });

    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.status).toBe('checking'));
    expect(result.current.serviceWorkerStatus).toBe('checking');
  });

  it('asks for a reload when the service worker is ready but the page is not controlled', async () => {
    const registration = { installing: null } as ServiceWorkerRegistration;
    mockServiceWorkerContainer({
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    });

    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.status).toBe('reload-required'));
    expect(result.current.serviceWorkerStatus).toBe('ready');
    expect(result.current.isControlledByServiceWorker).toBe(false);
  });

  it('refreshes service worker state on controllerchange', async () => {
    const registration = { installing: null } as ServiceWorkerRegistration;
    const serviceWorker = mockServiceWorkerContainer({
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    });

    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.status).toBe('reload-required'));

    act(() => {
      serviceWorker.dispatchControllerChange();
    });

    await waitFor(() => expect(result.current.serviceWorkerStatus).toBe('controlled'));
    expect(result.current.isControlledByServiceWorker).toBe(true);
    expect(result.current.status).toBe('unavailable');
  });

  it('keeps the prior service-worker status when controllerchange has no controller', async () => {
    const registration = { installing: null } as ServiceWorkerRegistration;
    const serviceWorker = mockServiceWorkerContainer({
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    });
    const { result } = renderHook(() => usePwaInstall());
    await waitFor(() => expect(result.current.serviceWorkerStatus).toBe('ready'));

    act(() => serviceWorker.dispatchControllerChange(null));

    expect(result.current.serviceWorkerStatus).toBe('ready');
    expect(result.current.isControlledByServiceWorker).toBe(false);
  });

  it('finishes registration as controlled when the page already has a controller', async () => {
    const registration = { installing: null } as ServiceWorkerRegistration;
    mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    });
    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.serviceWorkerStatus).toBe('controlled'));
    expect(result.current.isControlledByServiceWorker).toBe(true);
  });

  it('keeps running when service worker registration fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockServiceWorkerContainer({
      register: vi.fn().mockRejectedValue(new Error('registration failed')),
    });

    render(<PwaInstallProvider />);

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        'Failed to register PWA service worker:',
        expect.any(Error)
      );
    });
  });

  it('stringifies non-Error service-worker registration failures', async () => {
    mockServiceWorkerContainer({ register: vi.fn().mockRejectedValue('registration rejected') });
    const { result } = renderHook(() => usePwaInstall());

    await waitFor(() => expect(result.current.serviceWorkerStatus).toBe('error'));
    expect(result.current.lastError).toBe('registration rejected');
  });

  it('returns unavailable when no deferred prompt exists, including during SSR', async () => {
    await expect(triggerPwaInstall()).resolves.toBe('unavailable');

    vi.stubGlobal('window', undefined);
    await expect(triggerPwaInstall()).resolves.toBe('unavailable');
    expect(initPwaInstallListener()).toBeNull();
  });

  it('handles dismissed prompts and prompt failures', async () => {
    const { result } = renderHook(() => usePwaInstall());
    dispatchBeforeInstallPrompt('dismissed');
    await waitFor(() => expect(result.current.canPrompt).toBe(true));

    await act(async () => {
      await expect(result.current.install()).resolves.toBe('dismissed');
    });
    expect(result.current.outcome).toBe('dismissed');
    expect(result.current.isInstalling).toBe(false);

    const error = new Error('prompt rejected');
    const { event } = createBeforeInstallPromptEvent();
    event.prompt = vi.fn().mockRejectedValue(error);
    act(() => window.dispatchEvent(event));
    await act(async () => {
      await expect(result.current.install()).rejects.toBe(error);
    });
    expect(result.current.isInstalling).toBe(false);
  });

  it('falls back to the early captured prompt for an invalid custom-event payload', async () => {
    const { event, prompt } = createBeforeInstallPromptEvent();
    window.__polityPwaInstallPromptEvent = event;
    const { result } = renderHook(() => usePwaInstall());
    await waitFor(() => expect(result.current.canPrompt).toBe(true));

    act(() => {
      window.dispatchEvent(
        new CustomEvent('polity:pwa-install-prompt-captured', {
          detail: { promptEvent: 'not-an-event' },
        })
      );
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => result.current.install());
    expect(prompt).toHaveBeenCalledOnce();
  });

  it('ignores an invalid captured-prompt event when no early prompt exists', () => {
    renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(
        new CustomEvent('polity:pwa-install-prompt-captured', {
          detail: { promptEvent: 'invalid' },
        })
      );
    });
  });

  it('handles captured listener callbacks after the browser global disappears', () => {
    const browserWindow = window;
    initPwaInstallListener();
    vi.stubGlobal('window', undefined);

    browserWindow.dispatchEvent(
      new CustomEvent('polity:pwa-install-prompt-captured', {
        detail: { promptEvent: null },
      })
    );
    browserWindow.dispatchEvent(new Event('appinstalled'));

    vi.unstubAllGlobals();
  });

  it('supports legacy media-query listeners and removes all listeners on reset', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addListener, removeListener })),
    });
    const serviceWorker = mockServiceWorkerContainer({
      getRegistration: vi.fn().mockReturnValue(new Promise(() => undefined)),
    });

    const cleanupListener = initPwaInstallListener();
    expect(initPwaInstallListener()).toBe(cleanupListener);
    expect(addListener).toHaveBeenCalledOnce();

    cleanupListener?.();
    initPwaInstallListener();

    resetPwaInstallStateForTests();
    expect(removeListener).toHaveBeenCalledTimes(2);
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function)
    );
  });

  it.each(['activated', 'redundant'] as const)(
    'waits for an installing worker that becomes %s',
    async finalState => {
      let state: ServiceWorkerState = finalState === 'activated' ? 'activated' : 'installing';
      let stateChange: (() => void) | undefined;
      const installing = {
        get state() {
          return state;
        },
        addEventListener: vi.fn((_type: string, listener: () => void) => {
          stateChange = listener;
        }),
      } as unknown as ServiceWorker;
      const registration = { installing } as ServiceWorkerRegistration;
      mockServiceWorkerContainer({
        getRegistration: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      });

      const { result } = renderHook(() => usePwaInstall());
      if (finalState === 'redundant') {
        await waitFor(() => expect(installing.addEventListener).toHaveBeenCalledOnce());
        act(() => {
          stateChange?.();
          state = 'redundant';
          stateChange?.();
        });
      }

      await waitFor(() => expect(result.current.serviceWorkerStatus).toBe('ready'));
    }
  );

  it('uses service-worker activation and readiness timeouts as graceful fallbacks', async () => {
    vi.useFakeTimers();
    const installing = {
      state: 'installing',
      addEventListener: vi.fn(),
    } as unknown as ServiceWorker;
    const registration = { installing } as ServiceWorkerRegistration;
    mockServiceWorkerContainer({
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: new Promise(() => undefined),
    });

    const { result } = renderHook(() => usePwaInstall());
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    expect(result.current.serviceWorkerStatus).toBe('ready');
  });

  it('covers the server snapshot and the legacy install-prompt facade', async () => {
    function ServerProbe() {
      const state = usePwaInstall();
      return <span>{state.status}</span>;
    }
    expect(renderToString(<ServerProbe />)).toContain('checking');

    const { result } = renderHook(() => usePwaInstallPrompt());
    dispatchBeforeInstallPrompt('accepted');
    await waitFor(() => expect(result.current.isVisible).toBe(true));
    act(() => result.current.handleDismiss());
    expect(result.current.isVisible).toBe(false);

    await act(async () => result.current.handleInstall());
  });

  it('keeps a newer deferred prompt when an older prompt finishes', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const newer = createBeforeInstallPromptEvent('dismissed');
    const older = createBeforeInstallPromptEvent('accepted');
    older.event.prompt = vi.fn().mockImplementation(async () => {
      window.dispatchEvent(newer.event);
    });
    act(() => window.dispatchEvent(older.event));
    await waitFor(() => expect(result.current.canPrompt).toBe(true));

    await act(async () => result.current.install());

    await act(async () => expect(result.current.install()).resolves.toBe('dismissed'));
  });

  it('works without matchMedia and skips unavailable media-query cleanup APIs', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
    initPwaInstallListener();
    resetPwaInstallStateForTests();
  });

  it('exposes reload and detects navigator standalone plus touch Mac iOS', async () => {
    const { result, unmount } = renderHook(() => usePwaInstall());
    expect(() => result.current.reload()).not.toThrow();
    const reloadWithoutWindow = result.current.reload;
    unmount();
    vi.stubGlobal('window', undefined);
    expect(() => reloadWithoutWindow()).not.toThrow();
    vi.unstubAllGlobals();

    resetPwaInstallStateForTests();
    mockNavigator({ platform: 'MacIntel', maxTouchPoints: 5 });
    const touchMac = renderHook(() => usePwaInstall());
    await waitFor(() => expect(touchMac.result.current.platform).toBe('ios'));
    touchMac.unmount();

    resetPwaInstallStateForTests();
    mockNavigator({ standalone: true });
    const standalone = renderHook(() => usePwaInstall());
    await waitFor(() => expect(standalone.result.current.status).toBe('installed'));
  });
});

describe('PwaInstallPanel', () => {
  it('shows a settings install button and triggers the prompt when promptable', async () => {
    render(<PwaInstallPanel surface="settings" />);
    const prompt = dispatchBeforeInstallPrompt('accepted');

    const installButton = await screen.findByRole('button', { name: /Install Polity/i });
    expect(installButton.getAttribute('data-action-id')).toBe('pwa.install-panel.install');
    installButton.focus();
    fireEvent.keyDown(installButton, { key: 'Enter' });
    fireEvent.click(installButton);

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });

  it('shows manual iOS steps instead of a fake install button', async () => {
    mockNavigator({
      platform: 'iPhone',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });

    render(<PwaInstallPanel surface="settings" />);

    expect(await screen.findByText('Open the share menu.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Install Polity/i })).toBeNull();
  });

  it('shows a checking state while service worker registration is pending', async () => {
    mockServiceWorkerContainer({
      getRegistration: vi.fn().mockReturnValue(new Promise(() => undefined)),
    });

    render(<PwaInstallPanel surface="settings" />);

    expect(await screen.findByText('Checking app installation')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Install Polity/i })).toBeNull();
  });

  it('shows a reload action when Chrome needs a controlled page before installing', async () => {
    const registration = { installing: null } as ServiceWorkerRegistration;
    mockServiceWorkerContainer({
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    });

    render(<PwaInstallPanel surface="settings" />);

    const reload = await screen.findByRole('button', { name: /Reload page/i });
    expect(reload.getAttribute('data-action-id')).toBe('pwa.install-panel.reload');
    expect(screen.queryByRole('button', { name: /Install Polity/i })).toBeNull();
  });

  it('dismisses the onboarding install panel through a stable focusable action', async () => {
    const onDismiss = vi.fn();
    render(<PwaInstallPanel surface="onboarding" onDismiss={onDismiss} />);
    const action = await screen.findByRole('button', { name: /Dismiss/i });
    expect(action.getAttribute('data-action-id')).toBe('pwa.install-panel.dismiss');
    action.focus();
    fireEvent.keyDown(action, { key: 'Enter' });
    fireEvent.click(action);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Dismiss/i })).toBeNull();
  });

  it('logs browser prompt failures without rejecting the panel click', async () => {
    const error = new Error('prompt failed');
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' }>;
    };
    event.prompt = vi.fn().mockRejectedValue(error);
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<PwaInstallPanel surface="settings" />);
    act(() => window.dispatchEvent(event));
    fireEvent.click(await screen.findByRole('button', { name: /Install Polity/i }));
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to trigger PWA install:', error)
    );
  });

  it('shows a dismissed outcome only on the settings surface', async () => {
    const settings = render(<PwaInstallPanel surface="settings" />);
    dispatchBeforeInstallPrompt('dismissed');
    fireEvent.click(await screen.findByRole('button', { name: /Install Polity/i }));
    expect(await screen.findByText('The install dialog was dismissed.')).toBeTruthy();
    settings.unmount();

    render(<PwaInstallPanel surface="onboarding" />);
    expect(screen.queryByText('The install dialog was dismissed.')).toBeNull();
  });
});

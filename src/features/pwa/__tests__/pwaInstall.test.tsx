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

import {
  PwaInstallProvider,
  resetPwaInstallStateForTests,
  usePwaInstall,
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
  'common.pwa.installPanel.unavailableDescription': 'No install action is available.',
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

function dispatchBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };

  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome });

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
    dispatchControllerChange(nextController = {} as ServiceWorker) {
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
});

describe('PwaInstallPanel', () => {
  it('shows a settings install button and triggers the prompt when promptable', async () => {
    render(<PwaInstallPanel surface="settings" />);
    const prompt = dispatchBeforeInstallPrompt('accepted');

    const installButton = await screen.findByRole('button', { name: /Install Polity/i });
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

    expect(await screen.findByRole('button', { name: /Reload page/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Install Polity/i })).toBeNull();
  });
});

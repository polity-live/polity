/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPwaInstallStateForTests } from '../hooks/usePwaInstallPrompt';
import { PWAInstallPrompt } from '../ui/pwa-install-prompt';
import { PwaInstallPanel } from '../ui/PwaInstallPanel';
import { renderComponentFlow } from '@/test/render-component-flow';

function setServiceWorker(value: unknown) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  resetPwaInstallStateForTests();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  });
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

afterEach(() => {
  cleanup();
  resetPwaInstallStateForTests();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('PWA lifecycle flow', () => {
  it('adopts the browser install prompt and hides it after an accepted installation', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' }>;
    };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    renderComponentFlow(<PWAInstallPrompt />);

    window.dispatchEvent(event);
    await waitFor(() =>
      expect(
        document.querySelector<HTMLButtonElement>('[data-action-id="pwa.install-prompt.install"]')
      ).toBeTruthy()
    );
    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-action-id="pwa.install-prompt.install"]'
      ) as HTMLButtonElement
    );

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(document.querySelector('[data-action-id="pwa.install-prompt.install"]')).toBeNull()
    );
  });

  it('shows an explicit reload state when the worker is ready but not controlling the page', async () => {
    const listeners = new Map<string, EventListener>();
    const registration = { installing: null } as unknown as ServiceWorkerRegistration;
    setServiceWorker({
      controller: null,
      getRegistration: vi.fn().mockResolvedValue(registration),
      register: vi.fn(),
      ready: Promise.resolve(registration),
      addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener),
      removeEventListener: vi.fn(),
    });

    renderComponentFlow(<PwaInstallPanel surface="settings" />);

    await waitFor(() =>
      expect(
        document.querySelector<HTMLButtonElement>('[data-action-id="pwa.install-panel.reload"]')
      ).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: /reload page/i })).toBeTruthy();
  });
});

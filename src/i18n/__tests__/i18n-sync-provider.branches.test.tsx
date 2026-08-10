/* @vitest-environment jsdom */

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nSyncProvider } from '../i18n-sync-provider';

const mocks = vi.hoisted(() => ({
  language: 'en' as 'en' | 'de',
  setLanguage: vi.fn(),
  hydrate: vi.fn().mockResolvedValue(undefined),
  i18nLanguage: 'en',
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  languageHandler: null as null | ((language: string) => void),
}));

vi.mock('@/features/shared/global-state/language.store.tsx', () => ({
  hydrateLanguageStore: mocks.hydrate,
  useLanguageStore: (selector: (state: any) => unknown) =>
    selector({ language: mocks.language, setLanguage: mocks.setLanguage }),
}));

vi.mock('@/i18n/i18n.ts', () => ({
  default: {
    get language() {
      return mocks.i18nLanguage;
    },
    changeLanguage: mocks.changeLanguage,
    on: vi.fn((event: string, handler: (language: string) => void) => {
      mocks.on(event, handler);
      mocks.languageHandler = handler;
    }),
    off: mocks.off,
  },
}));

beforeEach(() => {
  mocks.language = 'en';
  mocks.i18nLanguage = 'en';
  mocks.languageHandler = null;
  vi.clearAllMocks();
  document.querySelector('link[rel="manifest"]')?.remove();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.restoreAllMocks();
});

describe('I18nSyncProvider service-worker synchronization', () => {
  it('hydrates and synchronizes DOM state without a manifest or service worker', () => {
    const view = render(
      <I18nSyncProvider>
        <span>Child</span>
      </I18nSyncProvider>
    );

    expect(mocks.hydrate).toHaveBeenCalledOnce();
    expect(mocks.changeLanguage).not.toHaveBeenCalled();
    expect(document.documentElement.lang).toBe('en');
    expect(mocks.on).toHaveBeenCalledWith('languageChanged', expect.any(Function));
    mocks.languageHandler!('en');
    mocks.languageHandler!('fr');
    mocks.languageHandler!('de');
    expect(mocks.setLanguage).toHaveBeenCalledWith('de');
    view.unmount();
    expect(mocks.off).toHaveBeenCalledWith('languageChanged', expect.any(Function));
  });

  it('updates manifest, i18n, controller, active, and waiting workers', async () => {
    mocks.language = 'de';
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    document.head.append(manifest);
    const controller = { postMessage: vi.fn() };
    const active = { postMessage: vi.fn() };
    const waiting = { postMessage: vi.fn() };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller,
        ready: Promise.resolve({ active, waiting }),
      },
    });

    render(<I18nSyncProvider>German child</I18nSyncProvider>);

    expect(mocks.changeLanguage).toHaveBeenCalledWith('de');
    expect(manifest.getAttribute('href')).toBe('/manifest.de.json');
    expect(controller.postMessage).toHaveBeenCalledWith({
      type: 'polity:set-language:v1',
      language: 'de',
    });
    await waitFor(() => expect(active.postMessage).toHaveBeenCalledOnce());
    expect(waiting.postMessage).toHaveBeenCalledOnce();

    mocks.languageHandler!('de');
    mocks.languageHandler!('fr');
    mocks.languageHandler!('en');
    expect(mocks.setLanguage).toHaveBeenCalledTimes(1);
    expect(mocks.setLanguage).toHaveBeenCalledWith('en');
  });

  it('tolerates absent registrations and warns when worker readiness rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, ready: Promise.resolve({ active: null, waiting: null }) },
    });
    const first = render(<I18nSyncProvider>First</I18nSyncProvider>);
    await Promise.resolve();
    first.unmount();

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, ready: Promise.reject(new Error('worker failed')) },
    });
    render(<I18nSyncProvider>Second</I18nSyncProvider>);
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        'Could not synchronize language with the service worker',
        expect.any(Error)
      )
    );
  });
});

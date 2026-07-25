/* @vitest-environment jsdom */

import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hydrateLanguageStore,
  useLanguageStore,
} from '@/features/shared/global-state/language.store';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import i18n from '@/i18n/i18n';
import { I18nSyncProvider } from '@/i18n/i18n-sync-provider';

const storageValue = (language: unknown, version = 1) =>
  JSON.stringify({ state: { language }, version });

function LanguageProbe() {
  const { t } = useTranslation();
  return <a aria-label={t('navigation.primary.home')}>Navigation</a>;
}

function setBrowserLanguage(language: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  useLanguageStore.setState({ language: 'en' });
  window.localStorage.clear();
  await i18n.changeLanguage('en');
  document.documentElement.lang = 'en';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('language hydration', () => {
  it('hydrates German only after matching the English server markup', async () => {
    setBrowserLanguage('de-DE');
    window.localStorage.setItem('language-storage', storageValue('de'));

    const app = (
      <I18nSyncProvider>
        <LanguageProbe />
      </I18nSyncProvider>
    );
    const serverHtml = renderToString(app);
    expect(serverHtml).toContain('aria-label="Home"');

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.append(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let root: Root | undefined;

    await act(async () => {
      root = hydrateRoot(container, app);
    });

    expect(container.querySelector('a')?.getAttribute('aria-label')).toBe('Startseite');
    expect(document.documentElement.lang).toBe('de');
    expect(consoleError).not.toHaveBeenCalled();

    await act(async () => root?.unmount());
    container.remove();
  });

  it('keeps a saved English preference over a German browser language', async () => {
    setBrowserLanguage('de-DE');
    window.localStorage.setItem('language-storage', storageValue('en'));

    await hydrateLanguageStore();

    expect(useLanguageStore.getState().language).toBe('en');
  });

  it.each([
    ['missing storage', null],
    ['malformed storage', '{not-json'],
    ['stale storage', storageValue('en', 0)],
    ['unsupported language', storageValue('fr')],
  ])('falls back to browser detection for %s', async (_case, storedValue) => {
    setBrowserLanguage('de-DE');
    if (storedValue !== null) {
      window.localStorage.setItem('language-storage', storedValue);
    }

    await hydrateLanguageStore();

    expect(useLanguageStore.getState().language).toBe('de');
  });
});

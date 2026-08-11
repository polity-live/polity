/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageToggleController } from '@/features/navigation/hooks/useLanguageToggleController';
import { useThemeToggleController } from '@/features/navigation/hooks/useThemeToggleController';
import { useDisplayCurrencyStore } from '@/features/shared/global-state/currency.store';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { useThemeStore } from '@/features/shared/global-state/theme.store';
import { CurrencyPreferenceControl } from '../ui/CurrencyPreferenceControl';
import { renderComponentFlow } from '@/test/render-component-flow';

const preferences = vi.hoisted(() => ({
  updateDisplayCurrency: vi.fn(),
}));

vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency: 'EUR', isLoading: false }),
}));
vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({ updateDisplayCurrency: preferences.updateDisplayCurrency }),
}));
vi.mock('@/features/shared/ui/form/CurrencySelect', () => ({
  CurrencySelect: ({ value, onChange }: { value: string; onChange: (value: 'USD') => void }) => (
    <button type="button" aria-label="currency" onClick={() => onChange('USD')}>
      {value}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: vi.fn() },
}));

function PreferencesFlow() {
  const language = useLanguageToggleController();
  const theme = useThemeToggleController();
  return (
    <section>
      <button type="button" onClick={() => void language.onLanguageChange('de', true)}>
        language:{language.language}
      </button>
      <button type="button" onClick={theme.onDark}>
        theme:{theme.currentTheme}
      </button>
      <CurrencyPreferenceControl />
    </section>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useLanguageStore.setState({ language: 'en' });
  useDisplayCurrencyStore.setState({ displayCurrency: 'EUR' });
  useThemeStore.setState({ theme: 'system', systemTheme: 'light', isMounted: true, isDark: false });
});

afterEach(cleanup);

describe('user preference synchronization flow', () => {
  it('switches language and persists the hydrated language-store snapshot', async () => {
    renderComponentFlow(<PreferencesFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'language:en' }));

    await screen.findByRole('button', { name: 'language:de' });
    expect(useLanguageStore.getState().language).toBe('de');
    expect(JSON.parse(localStorage.getItem('language-storage') ?? '{}')).toMatchObject({
      state: { language: 'de' },
      version: 1,
    });
  });

  it('switches theme and applies the selected color mode to the document', async () => {
    renderComponentFlow(<PreferencesFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'theme:system' }));

    await screen.findByRole('button', { name: 'theme:dark' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('updates the optimistic currency store and its persisted preference together', async () => {
    renderComponentFlow(<PreferencesFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'currency' }));

    await waitFor(() => expect(useDisplayCurrencyStore.getState().displayCurrency).toBe('USD'));
    expect(preferences.updateDisplayCurrency).toHaveBeenCalledWith('USD');
  });
});

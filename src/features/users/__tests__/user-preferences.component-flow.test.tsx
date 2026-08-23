/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDisplayCurrencyStore } from '@/features/shared/global-state/currency.store';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { useThemeStore } from '@/features/shared/global-state/theme.store';
import { UserProfileEditForm } from '../ui/UserProfileEditForm';
import type { UserProfileFormData } from '../hooks/useUserProfileForm';
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
vi.mock('../ui/AppearanceThemeSelector', () => ({ AppearanceThemeSelector: () => null }));
vi.mock('@/features/app-tutorial/AppTutorialSettingsPanel', () => ({
  AppTutorialSettingsPanel: () => null,
}));
vi.mock('@/features/navigation/toggles/NavigationViewStateToggle', () => ({
  NavigationViewStateToggle: () => null,
}));
vi.mock('@/features/create/ui/FormStyleSelector', () => ({ FormStyleSelector: () => null }));
vi.mock('@/features/pwa/ui', () => ({ PwaInstallPanel: () => null }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const formData: UserProfileFormData = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  gender: 'unspecified',
  subtitle: '',
  about: '',
  aboutContent: [{ type: 'p', children: [{ text: '' }] }] as any,
  contactEmail: 'contact@polity.local',
  youtube: '',
  linkedin: '',
  whatsapp: '',
  instagram: '',
  twitter: '',
  facebook: '',
  snapchat: '',
  tiktok: '',
  website: '',
  country: '',
  region: '',
  post_code: '',
  city: '',
  street: '',
  house_number: '',
  latitude: null,
  longitude: null,
  location_kind: null,
  location_place_id: null,
  location_boundary_source: null,
  location_geometry: null,
  location_bounds: null,
  avatar: '',
  videoURL: '',
  visibility: 'public',
  hashtags: [],
};

function renderPreferences() {
  return renderComponentFlow(
    <UserProfileEditForm
      formData={formData}
      isSubmitting={false}
      userId="preference-user"
      activeTab="preferences"
      onTabChange={vi.fn()}
      activeSubscriptionAmount={0}
      pendingChange={null}
      hasStripeCustomer={false}
      subscriptionRefreshKey={0}
      isCheckoutLoading={false}
      isPlanActive={() => false}
      hasCustomPlan={false}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      onAvatarUpload={vi.fn()}
      onAboutContentChange={vi.fn()}
      onFieldChange={vi.fn()}
      onSubscribe={vi.fn()}
      onCustomAmount={vi.fn()}
      onCancelSubscription={vi.fn()}
      onManageBilling={vi.fn()}
    />
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
  it('switches language from the real settings surface and persists the store snapshot', async () => {
    const view = renderPreferences();
    fireEvent.mouseEnter(
      view.container.querySelector('[data-action-id="navigation.language.popover.open"]')!
    );
    fireEvent.click(await screen.findByText('Deutsch', { selector: 'span' }));

    await waitFor(() => expect(useLanguageStore.getState().language).toBe('de'));
    expect(JSON.parse(localStorage.getItem('language-storage') ?? '{}')).toMatchObject({
      state: { language: 'de' },
      version: 1,
    });
  });

  it('switches theme from the actual preferences tab and applies it to the document', async () => {
    const view = renderPreferences();
    fireEvent.click(
      view.container.querySelector('[data-action-id="navigation.theme.dark.select"]')!
    );

    await waitFor(() => expect(useThemeStore.getState().theme).toBe('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('updates currency optimistically and persists only the supported currency preference', async () => {
    renderPreferences();
    fireEvent.click(screen.getByRole('button', { name: 'currency' }));

    await waitFor(() => expect(useDisplayCurrencyStore.getState().displayCurrency).toBe('USD'));
    expect(preferences.updateDisplayCurrency).toHaveBeenCalledWith('USD');
    expect(screen.queryByText(/timezone/i)).toBeNull();
  });
});

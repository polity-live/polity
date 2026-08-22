/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserProfileEditForm } from '../UserProfileEditForm';

vi.mock('@/features/shared/ui/form', () => ({
  FormActions: () => <button type="submit">Save</button>,
  SettingsActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  SettingsPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SettingsTabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({ VisibilityInput: () => null }));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({ MediaUpload: () => null }));
vi.mock('@/features/payments/ui/SubscriptionPlansGrid', () => ({
  SubscriptionPlansGrid: () => null,
}));
vi.mock('@/features/payments/ui/SubscriptionStatus', () => ({ SubscriptionStatus: () => null }));
vi.mock('@/features/create/ui/FormStyleSelector', () => ({ FormStyleSelector: () => null }));
vi.mock('@/features/navigation/toggles/theme-toggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/features/navigation/toggles/language-toggle', () => ({ LanguageToggle: () => null }));
vi.mock('@/features/navigation/toggles/NavigationViewStateToggle', () => ({
  NavigationViewStateToggle: () => null,
}));
vi.mock('@/features/app-tutorial/AppTutorialSettingsPanel', () => ({
  AppTutorialSettingsPanel: () => null,
}));
vi.mock('../BasicInformationSection', () => ({ BasicInformationSection: () => null }));
vi.mock('../AboutSection', () => ({ AboutSection: () => null }));
vi.mock('../ContactInformationSection', () => ({ ContactInformationSection: () => null }));
vi.mock('../LocationInformationSection', () => ({ LocationInformationSection: () => null }));
vi.mock('../HashtagsSection', () => ({ HashtagsSection: () => null }));
vi.mock('../CurrencyPreferenceControl', () => ({ CurrencyPreferenceControl: () => null }));
vi.mock('../AppearanceThemeSelector', () => ({ AppearanceThemeSelector: () => null }));
vi.mock('@/features/pwa/ui', () => ({ PwaInstallPanel: () => null }));
vi.mock('../VotingPasswordTab', () => ({ VotingPasswordTab: () => null }));
vi.mock('../AccountPasswordSection', () => ({ AccountPasswordSection: () => null }));
vi.mock('../AccountEmailSection', () => ({ AccountEmailSection: () => null }));
vi.mock('@/features/notifications/ui/NotificationSettingsContent', () => ({
  NotificationSettingsContent: () => null,
}));
vi.mock('../AiSettingsTab', () => ({ AiSettingsTab: () => null }));

afterEach(cleanup);

describe('UserProfileEditForm action contracts', () => {
  it('saves profile data and opens billing through stable actions', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const onManageBilling = vi.fn();
    render(
      <UserProfileEditForm
        {...({
          formData: {
            avatar: '',
            videoURL: '',
            firstName: 'Ada',
            lastName: 'Lovelace',
            gender: '',
            subtitle: '',
            visibility: 'public',
            aboutContent: [],
            contactEmail: '',
            website: '',
            youtube: '',
            linkedin: '',
            whatsapp: '',
            instagram: '',
            twitter: '',
            facebook: '',
            snapchat: '',
            tiktok: '',
            country: '',
            region: '',
            post_code: '',
            city: '',
            street: '',
            house_number: '',
            latitude: null,
            longitude: null,
            hashtags: [],
          },
          isSubmitting: false,
          userId: 'user-1',
          activeSubscriptionAmount: 0,
          pendingChange: null,
          hasStripeCustomer: true,
          subscriptionRefreshKey: 0,
          isCheckoutLoading: false,
          isPlanActive: () => false,
          hasCustomPlan: false,
          onSubmit,
          onCancel: vi.fn(),
          onAvatarUpload: vi.fn(),
          onAboutContentChange: vi.fn(),
          onFieldChange: vi.fn(),
          onSubscribe: vi.fn(),
          onCustomAmount: vi.fn(),
          onCancelSubscription: vi.fn(),
          onManageBilling,
        } as any)}
      />
    );

    fireEvent.submit(document.querySelector('[data-action-id="users.profile.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="users.profile.billing.manage"]')!);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onManageBilling).toHaveBeenCalledOnce();
  });
});

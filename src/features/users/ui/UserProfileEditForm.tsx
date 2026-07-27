import { CreditCard, Loader2 } from 'lucide-react';
import { TabsContent } from '@/features/shared/ui/ui/tabs';
import {
  FormActions,
  SettingsActionBar,
  SettingsPage,
  SettingsPanel,
  SettingsTabs,
  type SettingsTab,
} from '@/features/shared/ui/form';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { BasicInformationSection } from './BasicInformationSection';
import { AboutSection } from './AboutSection';
import { ContactInformationSection } from './ContactInformationSection';
import { LocationInformationSection } from './LocationInformationSection';
import { HashtagsSection } from './HashtagsSection';
import { SubscriptionPlansGrid } from '@/features/payments/ui/SubscriptionPlansGrid';
import { SubscriptionStatus } from '@/features/payments/ui/SubscriptionStatus';
import { FormStyleSelector } from '@/features/create/ui/FormStyleSelector';
import { ThemeToggle } from '@/features/navigation/toggles/theme-toggle';
import { LanguageToggle } from '@/features/navigation/toggles/language-toggle';
import { CurrencyPreferenceControl } from './CurrencyPreferenceControl';
import { AppearanceThemeSelector } from './AppearanceThemeSelector';
import { NavigationViewStateToggle } from '@/features/navigation/toggles/NavigationViewStateToggle';
import { PwaInstallPanel } from '@/features/pwa/ui';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { VotingPasswordTab } from './VotingPasswordTab';
import { AccountPasswordSection } from './AccountPasswordSection';
import { AccountEmailSection } from './AccountEmailSection';
import { NotificationSettingsContent } from '@/features/notifications/ui/NotificationSettingsContent';
import { AiSettingsTab } from './AiSettingsTab';
import { Button } from '@/features/shared/ui/ui/button';
import { AppTutorialSettingsPanel } from '@/features/app-tutorial/AppTutorialSettingsPanel';
import {
  geoLocationFieldsFromShape,
  geoLocationShapeFromFields,
} from '@/features/shared/logic/geoLocationShape';
import type { Value } from 'platejs';
import type { UserProfileFormData } from '../hooks/useUserProfileForm';
import type { PendingPlanChange } from '@/features/payments/ui/SubscriptionPlansGrid';

interface UserProfileEditFormProps {
  formData: UserProfileFormData;
  isSubmitting: boolean;
  userId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  activeSubscriptionAmount: number;
  pendingChange: PendingPlanChange;
  hasStripeCustomer: boolean;
  subscriptionRefreshKey: number;
  isCheckoutLoading: boolean;
  isPlanActive: (amount: number) => boolean;
  hasCustomPlan: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onAvatarUpload: (file: File) => Promise<string>;
  onAboutContentChange: (value: Value) => void;
  onFieldChange: <K extends keyof UserProfileFormData>(
    field: K,
    value: UserProfileFormData[K]
  ) => void;
  onSubscribe: (plan: 'running' | 'development') => void;
  onCustomAmount: (euros: number) => void;
  onCancelSubscription: () => void;
  onManageBilling: () => void;
}

export function UserProfileEditForm({
  formData,
  isSubmitting,
  userId,
  activeTab,
  onTabChange,
  activeSubscriptionAmount,
  pendingChange,
  hasStripeCustomer,
  subscriptionRefreshKey,
  isCheckoutLoading,
  isPlanActive,
  hasCustomPlan,
  onSubmit,
  onCancel,
  onAvatarUpload,
  onAboutContentChange,
  onFieldChange,
  onSubscribe,
  onCustomAmount,
  onCancelSubscription,
  onManageBilling,
}: UserProfileEditFormProps) {
  const { t } = useTranslation();
  const tabs: SettingsTab[] = [
    { value: 'basic-info', label: t('pages.user.settingsTabs.basicInfo') },
    { value: 'preferences', label: t('pages.user.settingsTabs.appearance') },
    { value: 'subscriptions', label: t('pages.user.settingsTabs.subscriptions') },
    { value: 'passwords', label: t('pages.user.settingsTabs.passwords') },
    { value: 'notifications', label: t('pages.user.settingsTabs.notifications') },
    { value: 'ai', label: t('pages.user.settingsTabs.ai', 'AI') },
  ];
  const resolvedTab =
    activeTab && tabs.some(tab => tab.value === activeTab) ? activeTab : 'basic-info';

  return (
    <SettingsPage
      title={t('pages.user.settings')}
      description={t('pages.user.settingsDescription')}
      size="wide"
    >
      <SettingsTabs tabs={tabs} value={resolvedTab} onValueChange={onTabChange}>
        {/* Basic Information Tab */}
        <TabsContent value="basic-info">
          <form onSubmit={onSubmit} className="space-y-6">
            <MediaUpload
              currentImage={formData.avatar}
              onImageChange={url => onFieldChange('avatar', url)}
              onImageFileUpload={onAvatarUpload}
              currentVideo={formData.videoURL}
              onVideoChange={url => onFieldChange('videoURL', url)}
              entityType="users"
              entityId={userId}
              exclusiveMedia
              imageLabel={t('pages.user.settingsForm.avatar.title')}
              imageDescription={t('pages.user.settingsForm.avatar.description')}
              videoLabel={t('common.actions.uploadVideo')}
              videoDescription={t('common.media.videoDescription')}
            />

            <BasicInformationSection
              firstName={formData.firstName}
              lastName={formData.lastName}
              gender={formData.gender}
              subtitle={formData.subtitle}
              onFirstNameChange={value => onFieldChange('firstName', value)}
              onLastNameChange={value => onFieldChange('lastName', value)}
              onGenderChange={value => onFieldChange('gender', value)}
              onSubtitleChange={value => onFieldChange('subtitle', value)}
            />

            <VisibilityInput
              value={formData.visibility}
              onChange={v => onFieldChange('visibility', v)}
            />

            <AboutSection
              aboutContent={formData.aboutContent}
              onAboutContentChange={onAboutContentChange}
            />

            <ContactInformationSection
              email={formData.email}
              website={formData.website}
              youtube={formData.youtube}
              linkedin={formData.linkedin}
              whatsapp={formData.whatsapp}
              instagram={formData.instagram}
              twitter={formData.twitter}
              facebook={formData.facebook}
              snapchat={formData.snapchat}
              tiktok={formData.tiktok}
              onEmailChange={value => onFieldChange('email', value)}
              onWebsiteChange={value => onFieldChange('website', value)}
              onYoutubeChange={value => onFieldChange('youtube', value)}
              onLinkedinChange={value => onFieldChange('linkedin', value)}
              onWhatsappChange={value => onFieldChange('whatsapp', value)}
              onInstagramChange={value => onFieldChange('instagram', value)}
              onTwitterChange={value => onFieldChange('twitter', value)}
              onFacebookChange={value => onFieldChange('facebook', value)}
              onSnapchatChange={value => onFieldChange('snapchat', value)}
              onTiktokChange={value => onFieldChange('tiktok', value)}
            />

            <LocationInformationSection
              country={formData.country}
              region={formData.region}
              post_code={formData.post_code}
              city={formData.city}
              street={formData.street}
              house_number={formData.house_number}
              latitude={formData.latitude}
              longitude={formData.longitude}
              shape={geoLocationShapeFromFields(formData)}
              onCountryChange={value => onFieldChange('country', value)}
              onRegionChange={value => onFieldChange('region', value)}
              onPostCodeChange={value => onFieldChange('post_code', value)}
              onCityChange={value => onFieldChange('city', value)}
              onStreetChange={value => onFieldChange('street', value)}
              onHouseNumberChange={value => onFieldChange('house_number', value)}
              onCoordinatesChange={coordinates => {
                onFieldChange('latitude', coordinates?.latitude ?? null);
                onFieldChange('longitude', coordinates?.longitude ?? null);
              }}
              onShapeChange={shape => {
                const fields = geoLocationFieldsFromShape(shape);
                onFieldChange('location_kind', fields.location_kind);
                onFieldChange('location_place_id', fields.location_place_id);
                onFieldChange('location_boundary_source', fields.location_boundary_source);
                onFieldChange('location_geometry', fields.location_geometry);
                onFieldChange('location_bounds', fields.location_bounds);
              }}
            />

            <HashtagsSection
              hashtags={formData.hashtags}
              onHashtagsChange={value => onFieldChange('hashtags', value)}
            />

            <SettingsActionBar>
              <FormActions
                cancelLabel={t('common.actions.cancel')}
                onCancel={onCancel}
                isSubmitting={isSubmitting}
                submitLabel={
                  isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('pages.user.settingsTabs.saving')}
                    </>
                  ) : (
                    t('pages.user.settingsTabs.saveProfile')
                  )
                }
                submitDisabled={isSubmitting}
              />
            </SettingsActionBar>
          </form>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <div className="space-y-6" data-tutorial-anchor="settings-appearance">
            <SettingsPanel
              title={t('pages.user.preferences.theme')}
              description={t('pages.user.preferences.themeDescription')}
            >
              <AppearanceThemeSelector />
            </SettingsPanel>
            <SettingsPanel
              title={t('pages.user.preferences.colorMode')}
              description={t('pages.user.preferences.colorModeDescription')}
            >
              <ThemeToggle />
            </SettingsPanel>
            <SettingsPanel
              title={t('pages.user.preferences.language')}
              description={t('pages.user.preferences.languageDescription')}
            >
              <LanguageToggle side="bottom" />
            </SettingsPanel>
            <SettingsPanel
              title={t('pages.user.preferences.displayCurrency')}
              description={t('pages.user.preferences.displayCurrencyDescription')}
            >
              <CurrencyPreferenceControl />
            </SettingsPanel>
            <AppTutorialSettingsPanel />
            <SettingsPanel
              title={t('pages.user.preferences.navigationStyle')}
              description={t('pages.user.preferences.navigationStyleDescription')}
            >
              <NavigationViewStateToggle />
            </SettingsPanel>
            <SettingsPanel
              title={t('pages.create.preferences.formStyle')}
              description={t('pages.create.preferences.formStyleDescription')}
            >
              <FormStyleSelector />
            </SettingsPanel>
            <SettingsPanel
              title={t('common.pwa.installPanel.settingsTitle')}
              description={t('common.pwa.installPanel.settingsDescription')}
            >
              <PwaInstallPanel surface="settings" />
            </SettingsPanel>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions">
          <div className="space-y-6">
            <SubscriptionPlansGrid
              activeAmount={activeSubscriptionAmount}
              pendingChange={pendingChange}
              isLoading={isCheckoutLoading}
              onSubscribe={onSubscribe}
              onCustomAmount={onCustomAmount}
              onCancel={onCancelSubscription}
              isPlanActive={isPlanActive}
              hasCustomPlan={hasCustomPlan}
            />

            {hasStripeCustomer ? (
              <SettingsPanel
                title={t('features.payments.billing.title')}
                description={t('features.payments.billing.description')}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={onManageBilling}
                  disabled={isCheckoutLoading}
                >
                  {isCheckoutLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  {t('features.payments.billing.manage')}
                </Button>
              </SettingsPanel>
            ) : null}

            <SubscriptionStatus userId={userId} refreshKey={subscriptionRefreshKey} />
          </div>
        </TabsContent>

        {/* Passwords Tab */}
        <TabsContent value="passwords">
          <div className="space-y-6">
            <AccountPasswordSection />
            <AccountEmailSection />
            <VotingPasswordTab userId={userId} />
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <NotificationSettingsContent userId={userId} />
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai">
          <AiSettingsTab />
        </TabsContent>
      </SettingsTabs>
    </SettingsPage>
  );
}

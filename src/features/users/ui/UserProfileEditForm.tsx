import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { FormActions, SettingsPanel } from '@/features/shared/ui/form';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload';
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
import { StateToggle } from '@/features/navigation/toggles/state-toggle';
import { useNavigationStore } from '@/features/navigation/state/navigation.store';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { VotingPasswordTab } from './VotingPasswordTab';
import { AccountPasswordSection } from './AccountPasswordSection';
import { AccountEmailSection } from './AccountEmailSection';
import { NotificationSettingsContent } from '@/features/notifications/ui/NotificationSettingsContent';
import { AiSettingsTab } from './AiSettingsTab';
import type { Value } from 'platejs';
import type { UserProfileFormData } from '../hooks/useUserProfileForm';

interface UserProfileEditFormProps {
  formData: UserProfileFormData;
  isSubmitting: boolean;
  userId: string;
  defaultTab?: string;
  activeSubscriptionAmount: number;
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
  onSubscribe: (priceId: string) => void;
  onCustomAmount: (euros: number) => void;
  onCancelSubscription: () => void;
}

export function UserProfileEditForm({
  formData,
  isSubmitting,
  userId,
  defaultTab,
  activeSubscriptionAmount,
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
}: UserProfileEditFormProps) {
  const { t } = useTranslation();
  const { navigationView, setNavigationView } = useNavigationStore();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('pages.user.settings')}</h1>
        <p className="text-muted-foreground">{t('pages.user.settingsDescription')}</p>
      </div>

      <Tabs defaultValue={defaultTab || 'basic-info'}>
        <TabsList className="mb-6">
          <TabsTrigger value="basic-info">{t('pages.user.settingsTabs.basicInfo')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('pages.user.settingsTabs.appearance')}</TabsTrigger>
          <TabsTrigger value="subscriptions">
            {t('pages.user.settingsTabs.subscriptions')}
          </TabsTrigger>
          <TabsTrigger value="passwords">{t('pages.user.settingsTabs.passwords')}</TabsTrigger>
          <TabsTrigger value="notifications">
            {t('pages.user.settingsTabs.notifications')}
          </TabsTrigger>
          <TabsTrigger value="ai">{t('pages.user.settingsTabs.ai', 'AI')}</TabsTrigger>
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic-info">
          <form onSubmit={onSubmit} className="space-y-6">
            <ImageUpload
              currentImage={formData.avatar}
              onImageChange={url => onFieldChange('avatar', url)}
              onFileUpload={onAvatarUpload}
              label={t('pages.user.settingsForm.avatar.title')}
              description={t('pages.user.settingsForm.avatar.description')}
            />

            <BasicInformationSection
              firstName={formData.firstName}
              lastName={formData.lastName}
              subtitle={formData.subtitle}
              onFirstNameChange={value => onFieldChange('firstName', value)}
              onLastNameChange={value => onFieldChange('lastName', value)}
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
            />

            <HashtagsSection
              hashtags={formData.hashtags}
              onHashtagsChange={value => onFieldChange('hashtags', value)}
            />

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
              className="sm:justify-start"
            />
          </form>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <div className="space-y-6">
            <SettingsPanel
              title={t('pages.user.preferences.theme')}
              description={t('pages.user.preferences.themeDescription')}
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
              title={t('pages.user.preferences.navigationStyle')}
              description={t('pages.user.preferences.navigationStyleDescription')}
            >
              <StateToggle currentState={navigationView} onStateChange={setNavigationView} />
            </SettingsPanel>
            <SettingsPanel
              title={t('pages.create.preferences.formStyle')}
              description={t('pages.create.preferences.formStyleDescription')}
            >
              <FormStyleSelector />
            </SettingsPanel>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions">
          <div className="space-y-6">
            <SubscriptionPlansGrid
              activeAmount={activeSubscriptionAmount}
              isLoading={isCheckoutLoading}
              onSubscribe={onSubscribe}
              onCustomAmount={onCustomAmount}
              onCancel={onCancelSubscription}
              isPlanActive={isPlanActive}
              hasCustomPlan={hasCustomPlan}
            />

            <SubscriptionStatus userId={userId} />
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
      </Tabs>
    </div>
  );
}

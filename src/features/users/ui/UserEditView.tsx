import { UserProfileEditForm } from './UserProfileEditForm';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { PageSkeleton } from '@/features/shared/ui/feedback';
export interface UserEditViewProps {
  userId: any;
  defaultTab: any;
  user: any;
  isLoading: any;
  formData: any;
  isSubmitting: any;
  handleSubmit: any;
  updateAboutContent: any;
  updateField: any;
  uploadAvatar: any;
  activeSubscription: any;
  isPlanActive: any;
  hasCustomPlan: any;
  getActivePlanAmount: any;
  fetchSubscription: any;
  isCheckoutLoading: any;
  handleSubscribe: any;
  handleCustomAmount: any;
  handleCancelSubscription: any;
}

export function UserEditView({
  userId,
  defaultTab,
  isLoading,
  formData,
  isSubmitting,
  handleSubmit,
  updateAboutContent,
  updateField,
  uploadAvatar,
  activeSubscription,
  isPlanActive,
  hasCustomPlan,
  getActivePlanAmount,
  isCheckoutLoading,
  handleSubscribe,
  handleCustomAmount,
  handleCancelSubscription,
}: UserEditViewProps) {
  if (isLoading) {
    return (
      <PageSkeleton
        variant="settings"
        label={translateText('common.loading.pageSkeleton.profile')}
      />
    );
  }

  return (
    <UserProfileEditForm
      formData={formData}
      isSubmitting={isSubmitting}
      userId={userId}
      defaultTab={defaultTab}
      activeSubscriptionAmount={getActivePlanAmount()}
      isCheckoutLoading={isCheckoutLoading}
      isPlanActive={isPlanActive}
      hasCustomPlan={hasCustomPlan()}
      onSubmit={handleSubmit}
      onCancel={() => window.history.back()}
      onAvatarUpload={uploadAvatar}
      onAboutContentChange={updateAboutContent}
      onFieldChange={updateField}
      onSubscribe={handleSubscribe}
      onCustomAmount={handleCustomAmount}
      onCancelSubscription={() =>
        activeSubscription?.id ? handleCancelSubscription(activeSubscription.id) : undefined
      }
    />
  );
}

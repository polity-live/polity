import { Loader2 } from 'lucide-react';
import { UserProfileEditForm } from './UserProfileEditForm';
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
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

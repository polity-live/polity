import { useUserData } from '../hooks/useUserData';
import { useUserProfileForm } from '../hooks/useUserProfileForm';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useSubscriptionManagement } from '@/features/payments/hooks/useSubscriptionManagement';
import { useStripeCheckout } from '@/features/payments/hooks/useStripeCheckout';

interface UserEditProps {
  userId: string;
  defaultTab?: string;
}
import { UserEditView } from './UserEditView';
export function UserEdit({ userId, defaultTab }: UserEditProps) {
  const { user, isLoading } = useUserData(userId);

  const { formData, isSubmitting, handleSubmit, updateAboutContent, updateField } =
    useUserProfileForm({
      userId,
      user,
    });

  const { uploadAvatar } = useAvatarUpload({
    userId,
    onSuccess: avatarUrl => updateField('avatar', avatarUrl),
  });

  const {
    activeSubscription,
    isPlanActive,
    hasCustomPlan,
    getActivePlanAmount,
    fetchSubscription,
  } = useSubscriptionManagement({ userId });

  const { isCheckoutLoading, handleSubscribe, handleCustomAmount, handleCancelSubscription } =
    useStripeCheckout({ userId, onSubscriptionChange: fetchSubscription });
  return (
    <UserEditView
      userId={userId}
      defaultTab={defaultTab}
      user={user}
      isLoading={isLoading}
      formData={formData}
      isSubmitting={isSubmitting}
      handleSubmit={handleSubmit}
      updateAboutContent={updateAboutContent}
      updateField={updateField}
      uploadAvatar={uploadAvatar}
      activeSubscription={activeSubscription}
      isPlanActive={isPlanActive}
      hasCustomPlan={hasCustomPlan}
      getActivePlanAmount={getActivePlanAmount}
      fetchSubscription={fetchSubscription}
      isCheckoutLoading={isCheckoutLoading}
      handleSubscribe={handleSubscribe}
      handleCustomAmount={handleCustomAmount}
      handleCancelSubscription={handleCancelSubscription}
    />
  );
}

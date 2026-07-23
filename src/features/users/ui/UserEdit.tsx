import { useCallback, useState } from 'react';

import { useUserData } from '../hooks/useUserData';
import { useUserProfileForm } from '../hooks/useUserProfileForm';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useSubscriptionManagement } from '@/features/payments/hooks/useSubscriptionManagement';
import { useStripeCheckout } from '@/features/payments/hooks/useStripeCheckout';

interface UserEditProps {
  userId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}
import { UserEditView } from './UserEditView';
export function UserEdit({ userId, activeTab, onTabChange }: UserEditProps) {
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
    hasStripeCustomer,
    isPlanActive,
    hasCustomPlan,
    getActivePlanAmount,
    fetchSubscription,
  } = useSubscriptionManagement({ userId });
  const [subscriptionRefreshKey, setSubscriptionRefreshKey] = useState(0);
  const pendingChange =
    activeSubscription?.cancelAtPeriodEnd && activeSubscription.currentPeriodEnd
      ? {
          target: 'free' as const,
          effectiveAt: activeSubscription.currentPeriodEnd,
        }
      : null;
  const refreshSubscriptions = useCallback(async () => {
    await fetchSubscription();
    setSubscriptionRefreshKey(value => value + 1);
  }, [fetchSubscription]);

  const {
    isCheckoutLoading,
    handleSubscribe,
    handleCustomAmount,
    handleCancelSubscription,
    handleManageBilling,
  } = useStripeCheckout({ userId, onSubscriptionChange: refreshSubscriptions });
  return (
    <UserEditView
      userId={userId}
      activeTab={activeTab}
      onTabChange={onTabChange}
      user={user}
      isLoading={isLoading}
      formData={formData}
      isSubmitting={isSubmitting}
      handleSubmit={handleSubmit}
      updateAboutContent={updateAboutContent}
      updateField={updateField}
      uploadAvatar={uploadAvatar}
      activeSubscription={activeSubscription}
      pendingChange={pendingChange}
      hasStripeCustomer={hasStripeCustomer}
      subscriptionRefreshKey={subscriptionRefreshKey}
      isPlanActive={isPlanActive}
      hasCustomPlan={hasCustomPlan}
      getActivePlanAmount={getActivePlanAmount}
      fetchSubscription={fetchSubscription}
      isCheckoutLoading={isCheckoutLoading}
      handleSubscribe={handleSubscribe}
      handleCustomAmount={handleCustomAmount}
      handleCancelSubscription={handleCancelSubscription}
      handleManageBilling={handleManageBilling}
    />
  );
}

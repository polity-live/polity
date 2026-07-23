import { useCallback, useEffect, useState } from 'react';
import { stripeSubscriptionStatusFn } from '@/server/stripe-subscription-status';
import { useAuth } from '@/providers/auth-provider';

// Co-located types
export interface SubscriptionData {
  id: string;
  amount: number;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface UseSubscriptionManagementOptions {
  userId: string | undefined;
}

export interface UseSubscriptionManagementReturn {
  activeSubscription: SubscriptionData | null;
  hasStripeCustomer: boolean;
  isLoading: boolean;
  fetchSubscription: () => Promise<void>;
  isPlanActive: (amount: number) => boolean;
  hasCustomPlan: () => boolean;
  getActivePlanAmount: () => number;
}

export function useSubscriptionManagement({
  userId,
}: UseSubscriptionManagementOptions): UseSubscriptionManagementReturn {
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionData | null>(null);
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  const fetchSubscription = useCallback(async () => {
    if (!userId || !session?.access_token) return;

    setIsLoading(true);
    try {
      const data = await stripeSubscriptionStatusFn({
        data: { userId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setActiveSubscription(data.subscription);
      setHasStripeCustomer(data.hasCustomer);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token, userId]);

  // Fetch active subscription on mount and when userId changes
  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  // Helper to check if a plan is currently active
  const isPlanActive = (amount: number): boolean => {
    if (!activeSubscription) return false;
    return activeSubscription.amount === amount;
  };

  // Helper to check if user has a custom plan (not the fixed EUR plans)
  const hasCustomPlan = (): boolean => {
    if (!activeSubscription) return false;
    return activeSubscription.amount !== 200 && activeSubscription.amount !== 1000;
  };

  // Helper to get the active plan amount (0 for free, otherwise the subscription amount)
  const getActivePlanAmount = (): number => {
    if (!activeSubscription) return 0; // Free plan
    return activeSubscription.amount;
  };

  return {
    activeSubscription,
    hasStripeCustomer,
    isLoading,
    fetchSubscription,
    isPlanActive,
    hasCustomPlan,
    getActivePlanAmount,
  };
}

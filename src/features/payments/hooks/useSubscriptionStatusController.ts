import { useEffect, useState } from 'react';

import { stripeSubscriptionStatusFn } from '@/server/stripe-subscription-status';
import { useAuth } from '@/providers/auth-provider';
import type { SubscriptionData } from '../ui/SubscriptionStatusView';
import { localizeAppError } from '@/features/shared/errors/app-error';

interface UseSubscriptionStatusControllerOptions {
  userId: string;
  refreshKey?: number;
}

export function useSubscriptionStatusController({
  userId,
  refreshKey = 0,
}: UseSubscriptionStatusControllerOptions) {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    async function fetchSubscriptionStatus() {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await stripeSubscriptionStatusFn({
          data: { userId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setData(result);
      } catch (err) {
        console.error('[SubscriptionStatus] Fetch error:', err);
        setError(localizeAppError(err, { logUnknown: false }));
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      void fetchSubscriptionStatus();
    }
  }, [refreshKey, session?.access_token, userId]);

  return {
    data,
    isLoading,
    error,
  };
}

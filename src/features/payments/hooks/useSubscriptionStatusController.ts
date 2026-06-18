import { useEffect, useState } from 'react';

import { stripeSubscriptionStatusFn } from '@/server/stripe-subscription-status';
import { useAuth } from '@/providers/auth-provider';
import type { SubscriptionData } from '../ui/SubscriptionStatusView';

interface UseSubscriptionStatusControllerOptions {
  userId: string;
}

export function useSubscriptionStatusController({
  userId,
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
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      void fetchSubscriptionStatus();
    }
  }, [session?.access_token, userId]);

  return {
    data,
    isLoading,
    error,
  };
}

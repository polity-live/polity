import { useEffect, useState } from 'react';

import { stripeSubscriptionStatusFn } from '@/server/stripe-subscription-status';
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

  useEffect(() => {
    async function fetchSubscriptionStatus() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await stripeSubscriptionStatusFn({ data: { userId } });
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
  }, [userId]);

  return {
    data,
    isLoading,
    error,
  };
}

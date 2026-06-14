'use client';

import { useEffect, useState } from 'react';

import { stripeSubscriptionStatusFn } from '@/server/stripe-subscription-status';
import {
  SubscriptionStatusView,
  type SubscriptionData,
} from '@/features/payments/ui/SubscriptionStatusView';

interface SubscriptionStatusProps {
  userId: string;
}

export function SubscriptionStatus({ userId }: SubscriptionStatusProps) {
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

  return <SubscriptionStatusView data={data} isLoading={isLoading} error={error} />;
}

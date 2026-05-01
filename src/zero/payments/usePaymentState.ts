import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

/**
 * Reactive state hook for payment data.
 * Returns all query-derived state — no mutations.
 */
export function usePaymentState() {
  // Payments for the current user (as payer)
  const [payments, paymentsResult] = useQuery(queries.payments.byUser({}));

  // Subscription status for the current user
  const [subscriptionStatus, subscriptionResult] = useQuery(
    queries.payments.subscriptionStatus({})
  );

  const isLoading = paymentsResult.type === 'unknown' || subscriptionResult.type === 'unknown';

  return {
    payments,
    subscriptionStatus,
    isLoading,
  };
}

/**
 * Focused reactive read hook for a user's subscription rows.
 */
export function useSubscriptionStatusByUser(userId?: string) {
  const [subscriptionStatus, result] = useQuery(
    userId ? queries.payments.subscriptionStatusByUser({ userId }) : undefined
  );

  return {
    subscriptionStatus,
    isLoading: !!userId && result.type === 'unknown',
  };
}

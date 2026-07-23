import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { stripeCreateCheckoutFn } from '@/server/stripe-create-checkout';
import { stripeCancelSubscriptionFn } from '@/server/stripe-cancel-subscription';
import { stripeRepairCheckoutSessionFn } from '@/server/stripe-repair-checkout-session';
import { stripeCreatePortalFn } from '@/server/stripe-create-portal';
import { stripeReconcileCustomerFn } from '@/server/stripe-reconcile-customer';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { majorToMinor } from '@/features/shared/logic/currency';
import { useAuth } from '@/providers/auth-provider';
import {
  splitStripeRedirectSearch,
  type StripeRedirectSearch,
} from '@/features/payments/logic/stripeRedirectSearch';

// Co-located types
export interface UseStripeCheckoutOptions {
  userId: string | undefined;
  onSubscriptionChange?: () => void;
}

export interface UseStripeCheckoutReturn {
  isCheckoutLoading: boolean;
  handleSubscribe: (plan: 'running' | 'development') => Promise<void>;
  handleCustomAmount: (euros: number) => Promise<void>;
  handleCancelSubscription: (subscriptionId: string) => Promise<void>;
  handleManageBilling: () => Promise<void>;
}

export function useStripeCheckout({
  userId,
  onSubscriptionChange,
}: UseStripeCheckoutOptions): UseStripeCheckoutReturn {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as StripeRedirectSearch;
  const { session } = useAuth();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const handledRedirectRef = useRef<string | null>(null);

  const getAuthHeaders = () => {
    if (!session?.access_token) {
      toast.error(translateText('generated.inline.0976_checkout_error_6173a608'));
      return null;
    }

    return { Authorization: `Bearer ${session.access_token}` };
  };

  // Repair checkout redirects and reconcile changes made in the Stripe portal.
  useEffect(() => {
    const { action, remainingSearch } = splitStripeRedirectSearch(searchParams);
    const redirectKey =
      action.type === 'checkout-success'
        ? `success:${action.sessionId ?? 'missing'}`
        : action.type === 'billing-return'
          ? 'billing-return'
          : action.type === 'checkout-canceled'
            ? 'canceled'
            : null;

    if (action.type === 'checkout-success' || action.type === 'billing-return') {
      if (!session?.access_token) return;
      if (handledRedirectRef.current === redirectKey) return;
      handledRedirectRef.current = redirectKey;

      void (async () => {
        try {
          if (action.type === 'checkout-success' && action.sessionId) {
            await stripeRepairCheckoutSessionFn({
              data: { sessionId: action.sessionId, userId },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          } else {
            await stripeReconcileCustomerFn({
              data: { userId },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch (error) {
          console.error('Stripe reconciliation failed:', error);
        } finally {
          if (action.type === 'checkout-success') {
            toast.success(
              translateText(
                'generated.inline.0973_subscription_successful_thank_you_for_your_su_5b3118fb'
              )
            );
          } else {
            toast.success(translateText('features.payments.billing.synced'));
          }
          navigate({ to: window.location.pathname, search: remainingSearch, replace: true });
          onSubscriptionChange?.();
        }
      })();
    } else if (action.type === 'checkout-canceled') {
      if (handledRedirectRef.current === redirectKey) return;
      handledRedirectRef.current = redirectKey;

      toast.info(
        translateText(
          'generated.inline.0974_subscription_canceled_you_can_subscribe_anyti_7b8dd755'
        )
      );
      // Clear the query param to prevent duplicate toasts
      navigate({ to: window.location.pathname, search: remainingSearch, replace: true });
    }
  }, [searchParams, navigate, onSubscriptionChange, session?.access_token, userId]);

  const handleSubscribe = async (plan: 'running' | 'development') => {
    const headers = getAuthHeaders();
    if (!headers) return;

    setIsCheckoutLoading(true);
    try {
      const data = await stripeCreateCheckoutFn({
        data: { plan, userId },
        headers,
      });

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(
          translateText('generated.inline.0975_failed_to_create_checkout_session_abc0e04f')
        );
      }
    } catch (error) {
      toast.error(translateText('generated.inline.0976_checkout_error_6173a608'));
      console.error('Checkout error:', error);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleCustomAmount = async (euros: number) => {
    if (euros <= 0) return;
    const headers = getAuthHeaders();
    if (!headers) return;

    setIsCheckoutLoading(true);
    try {
      const data = await stripeCreateCheckoutFn({
        data: { plan: 'custom', amount: majorToMinor(euros, 'EUR'), userId },
        headers,
      });

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(
          translateText('generated.inline.0975_failed_to_create_checkout_session_abc0e04f')
        );
      }
    } catch (error) {
      toast.error(translateText('generated.inline.0976_checkout_error_6173a608'));
      console.error('Checkout error:', error);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!subscriptionId) return;
    const headers = getAuthHeaders();
    if (!headers) return;

    setIsCheckoutLoading(true);
    try {
      const data = await stripeCancelSubscriptionFn({
        data: { subscriptionId },
        headers,
      });

      if (data.success) {
        await stripeReconcileCustomerFn({
          data: { userId },
          headers,
        });
        toast.success(translateText('features.payments.plans.cancellationScheduled'));
        onSubscriptionChange?.();
      } else {
        toast.error(translateText('generated.inline.0978_failed_to_cancel_subscription_9291c45e'));
      }
    } catch (error) {
      toast.error(translateText('generated.inline.0978_failed_to_cancel_subscription_9291c45e'));
      console.error('Cancel error:', error);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    setIsCheckoutLoading(true);
    try {
      const data = await stripeCreatePortalFn({
        data: {},
        headers,
      });
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(translateText('features.payments.billing.portalError'));
      }
    } catch (error) {
      toast.error(translateText('features.payments.billing.portalError'));
      console.error('Billing portal error:', error);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return {
    isCheckoutLoading,
    handleSubscribe,
    handleCustomAmount,
    handleCancelSubscription,
    handleManageBilling,
  };
}

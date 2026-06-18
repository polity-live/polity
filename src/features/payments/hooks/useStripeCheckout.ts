import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { stripeCreateCheckoutFn } from '@/server/stripe-create-checkout';
import { stripeCancelSubscriptionFn } from '@/server/stripe-cancel-subscription';
import { stripeRepairCheckoutSessionFn } from '@/server/stripe-repair-checkout-session';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';

// Co-located types
export interface UseStripeCheckoutOptions {
  userId: string | undefined;
  onSubscriptionChange?: () => void;
}

export interface UseStripeCheckoutReturn {
  isCheckoutLoading: boolean;
  handleSubscribe: (priceId: string) => Promise<void>;
  handleCustomAmount: (euros: number) => Promise<void>;
  handleCancelSubscription: (subscriptionId: string) => Promise<void>;
}

export function useStripeCheckout({
  userId,
  onSubscriptionChange,
}: UseStripeCheckoutOptions): UseStripeCheckoutReturn {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, string>;
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

  // Show success/cancel message from Stripe redirect
  useEffect(() => {
    const { success, canceled, session_id: sessionId, ...remainingSearch } = searchParams;
    const redirectKey =
      success === 'true'
        ? `success:${sessionId ?? 'missing'}`
        : canceled === 'true'
          ? 'canceled'
          : null;

    if (success === 'true') {
      if (!session?.access_token) return;
      if (handledRedirectRef.current === redirectKey) return;
      handledRedirectRef.current = redirectKey;

      void (async () => {
        try {
          if (sessionId) {
            await stripeRepairCheckoutSessionFn({
              data: { sessionId, userId },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch (error) {
          console.error('Checkout repair sync failed:', error);
        } finally {
          toast.success(
            translateText(
              'generated.inline.0973_subscription_successful_thank_you_for_your_su_5b3118fb'
            )
          );
          // Clear the query param to prevent duplicate toasts
          navigate({ to: window.location.pathname, search: remainingSearch, replace: true });
          onSubscriptionChange?.();
        }
      })();
    } else if (canceled === 'true') {
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

  const handleSubscribe = async (priceId: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;

    setIsCheckoutLoading(true);
    try {
      const data = await stripeCreateCheckoutFn({
        data: { priceId, userId },
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
        data: { amount: euros * 100, userId },
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
        toast.success(
          translateText('generated.inline.0977_subscription_canceled_successfully_fb691132')
        );
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

  return {
    isCheckoutLoading,
    handleSubscribe,
    handleCustomAmount,
    handleCancelSubscription,
  };
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { stripeCreateCheckoutFn } from '@/server/stripe-create-checkout';
import { stripeCancelSubscriptionFn } from '@/server/stripe-cancel-subscription';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Show success/cancel message from Stripe redirect
  useEffect(() => {
    const { success, canceled, ...remainingSearch } = searchParams;

    if (success === 'true') {
      toast.success(
        translateText(
          'generated.inline.0973_subscription_successful_thank_you_for_your_su_5b3118fb'
        )
      );
      // Clear the query param to prevent duplicate toasts
      navigate({ to: window.location.pathname, search: remainingSearch, replace: true });
      onSubscriptionChange?.();
    } else if (canceled === 'true') {
      toast.info(
        translateText(
          'generated.inline.0974_subscription_canceled_you_can_subscribe_anyti_7b8dd755'
        )
      );
      // Clear the query param to prevent duplicate toasts
      navigate({ to: window.location.pathname, search: remainingSearch, replace: true });
    }
  }, [searchParams, navigate, onSubscriptionChange]);

  const handleSubscribe = async (priceId: string) => {
    setIsCheckoutLoading(true);
    try {
      const data = await stripeCreateCheckoutFn({
        data: { priceId, userId, origin: window.location.origin },
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

    setIsCheckoutLoading(true);
    try {
      const data = await stripeCreateCheckoutFn({
        data: { amount: euros * 100, userId, origin: window.location.origin },
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

    setIsCheckoutLoading(true);
    try {
      const data = await stripeCancelSubscriptionFn({
        data: { subscriptionId },
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

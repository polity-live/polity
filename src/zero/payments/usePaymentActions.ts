import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';
import {
  trackCreationUnlessSilent,
  type CreationMutationOptions,
} from '@/features/notifications/utils/mutation-finalization';

/**
 * Action hook for payment mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function usePaymentActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const createCustomer = useCallback(
    (
      args: Parameters<typeof mutators.payments.createCustomer>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.payments.createCustomer(args));
      trackCreationUnlessSilent(result, 'customer', options, args.id);
      return result;
    },
    [zero, t]
  );

  const updateSubscription = useCallback(
    (args: Parameters<typeof mutators.payments.updateSubscription>[0]) => {
      const result = zero.mutate(mutators.payments.updateSubscription(args));
      toast.success(t('common.paymentToasts.subscriptionUpdated'));
      onServerError(result, () => toast.error(t('common.paymentToasts.subscriptionUpdateFailed')));
      return result;
    },
    [zero, t]
  );

  const recordPayment = useCallback(
    (args: Parameters<typeof mutators.payments.recordPayment>[0]) => {
      const result = zero.mutate(mutators.payments.recordPayment(args));
      toast.success(t('common.paymentToasts.paymentRecorded'));
      onServerError(result, () => toast.error(t('common.paymentToasts.paymentRecordFailed')));
      return result;
    },
    [zero, t]
  );

  const createPayment = useCallback(
    (
      args: Parameters<typeof mutators.payments.createPayment>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.payments.createPayment(args));
      trackCreationUnlessSilent(result, 'payment', options, args.id);
      return result;
    },
    [zero, t]
  );

  const updatePayment = useCallback(
    (args: Parameters<typeof mutators.payments.updatePayment>[0]) => {
      const result = zero.mutate(mutators.payments.updatePayment(args));
      toast.success(t('common.paymentToasts.paymentUpdated', 'Payment updated'));
      onServerError(result, () =>
        toast.error(t('common.paymentToasts.paymentUpdateFailed', 'Failed to update payment'))
      );
      return result;
    },
    [zero, t]
  );

  const deletePayment = useCallback(
    (args: Parameters<typeof mutators.payments.deletePayment>[0]) => {
      const result = zero.mutate(mutators.payments.deletePayment(args));
      toast.success(t('common.paymentToasts.paymentDeleted'));
      onServerError(result, () => toast.error(t('common.paymentToasts.paymentDeleteFailed')));
      return result;
    },
    [zero, t]
  );

  return {
    createCustomer,
    updateSubscription,
    recordPayment,
    createPayment,
    updatePayment,
    deletePayment,
  };
}

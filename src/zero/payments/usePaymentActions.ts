import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

/**
 * Action hook for payment mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function usePaymentActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const createCustomer = useCallback(
    (args: Parameters<typeof mutators.payments.createCustomer>[0]) => {
      const result = zero.mutate(mutators.payments.createCustomer(args));
      toast.success(t('common.paymentToasts.customerCreated'));
      onServerError(result, () => toast.error(t('common.paymentToasts.customerCreateFailed')));
    },
    [zero]
  );

  const updateSubscription = useCallback(
    (args: Parameters<typeof mutators.payments.updateSubscription>[0]) => {
      const result = zero.mutate(mutators.payments.updateSubscription(args));
      toast.success(t('common.paymentToasts.subscriptionUpdated'));
      onServerError(result, () => toast.error(t('common.paymentToasts.subscriptionUpdateFailed')));
    },
    [zero]
  );

  const recordPayment = useCallback(
    (args: Parameters<typeof mutators.payments.recordPayment>[0]) => {
      const result = zero.mutate(mutators.payments.recordPayment(args));
      toast.success(t('common.paymentToasts.paymentRecorded'));
      onServerError(result, () => toast.error(t('common.paymentToasts.paymentRecordFailed')));
    },
    [zero]
  );

  const createPayment = useCallback(
    (args: Parameters<typeof mutators.payments.createPayment>[0]) => {
      const result = zero.mutate(mutators.payments.createPayment(args));
      toast.success(t('common.paymentToasts.paymentCreated'));
      onServerError(result, () => toast.error(t('common.paymentToasts.paymentCreateFailed')));
      return result;
    },
    [zero]
  );

  const deletePayment = useCallback(
    (args: Parameters<typeof mutators.payments.deletePayment>[0]) => {
      const result = zero.mutate(mutators.payments.deletePayment(args));
      toast.success(t('common.paymentToasts.paymentDeleted'));
      onServerError(result, () => toast.error(t('common.paymentToasts.paymentDeleteFailed')));
    },
    [zero]
  );

  return {
    createCustomer,
    updateSubscription,
    recordPayment,
    createPayment,
    deletePayment,
  };
}

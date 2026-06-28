import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

export function useCalendarSubscriptionActions() {
  const zero = useZero();
  const { t } = useTranslation();

  const subscribeToCalendar = useCallback(
    (args: Parameters<typeof mutators.calendarSubscriptions.subscribe>[0]) => {
      const result = zero.mutate(mutators.calendarSubscriptions.subscribe(args));
      toast.success(t('features.calendar.toasts.subscribed'));
      onServerError(result, () => toast.error(t('features.calendar.toasts.subscribeFailed')));
      return result;
    },
    [zero, t]
  );

  const updateCalendarSubscription = useCallback(
    (args: Parameters<typeof mutators.calendarSubscriptions.update>[0]) => {
      const result = zero.mutate(mutators.calendarSubscriptions.update(args));
      onServerError(result, () => toast.error(t('features.calendar.toasts.updateFailed')));
      return result;
    },
    [zero, t]
  );

  const unsubscribeFromCalendar = useCallback(
    (args: Parameters<typeof mutators.calendarSubscriptions.unsubscribe>[0]) => {
      const result = zero.mutate(mutators.calendarSubscriptions.unsubscribe(args));
      toast.success(t('features.calendar.toasts.unsubscribed'));
      onServerError(result, () => toast.error(t('features.calendar.toasts.unsubscribeFailed')));
      return result;
    },
    [zero, t]
  );

  return {
    subscribeToCalendar,
    updateCalendarSubscription,
    unsubscribeFromCalendar,
  };
}

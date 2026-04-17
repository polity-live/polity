import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for meeting bookings (meetings as events).
 * Every function wraps a mutator + toast feedback.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useMeetingActions() {
  const zero = useZero()
  const { t } = useTranslation()

  const bookMeeting = useCallback(
    (eventId: string, instanceDate?: number | null) => {
      const result = zero.mutate(mutators.events.bookMeeting({
        event_id: eventId,
        instance_date: instanceDate ?? null,
      }))
      toast.success(t('features.meet.toasts.booked'))
      onServerError(result, () => toast.error(t('features.meet.toasts.bookFailed')))
    },
    [zero],
  )

  const cancelMeetingBooking = useCallback(
    (eventId: string, instanceDate?: number | null) => {
      const result = zero.mutate(mutators.events.cancelMeetingBooking({
        event_id: eventId,
        instance_date: instanceDate ?? null,
      }))
      toast.success(t('features.meet.toasts.bookingCancelled'))
      onServerError(result, () => toast.error(t('features.meet.toasts.cancelFailed')))
    },
    [zero],
  )

  return { bookMeeting, cancelMeetingBooking }
}

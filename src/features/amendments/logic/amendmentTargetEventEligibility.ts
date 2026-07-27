import { encodeAppError, throwAppError } from '@/features/shared/errors';

export const AMENDMENT_TARGET_EVENT_CLOSED_MESSAGE = encodeAppError('event_deadline_expired');

export interface AmendmentTargetEventDeadlineLike {
  amendment_deadline?: number | null;
}

export function isAmendmentTargetEventOpen(
  event: AmendmentTargetEventDeadlineLike | null | undefined,
  now: number = Date.now()
) {
  const amendmentDeadline = event?.amendment_deadline ?? null;
  return amendmentDeadline == null || amendmentDeadline > now;
}

export function assertAmendmentTargetEventOpen(
  event: AmendmentTargetEventDeadlineLike | null | undefined,
  now: number = Date.now()
) {
  if (!isAmendmentTargetEventOpen(event, now)) {
    throwAppError('event_deadline_expired');
  }
}

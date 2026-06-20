export const AMENDMENT_TARGET_EVENT_CLOSED_MESSAGE =
  'Die Antragsfrist fuer dieses Event ist abgelaufen.';

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
    throw new Error(AMENDMENT_TARGET_EVENT_CLOSED_MESSAGE);
  }
}

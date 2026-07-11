export type AmendmentForwardingStatus = 'pending' | 'forwarded' | 'rejected' | 'tie';

export interface AmendmentForwardingPreviewModel {
  status: AmendmentForwardingStatus;
  nextGroupId?: string | null;
  nextGroupName?: string | null;
  nextEventId?: string | null;
  nextEventTitle: string;
  nextEventStartDate?: number | null;
}

interface ForwardingStepRunLike {
  status?: string | null;
  decision_status?: string | null;
}

interface ForwardingTargetStepRunLike {
  agenda_item_id?: string | null;
  vote_id?: string | null;
  target_group?: { id?: string | null; name?: string | null } | null;
  event?: {
    id?: string | null;
    title?: string | null;
    start_date?: number | null;
  } | null;
}

export function deriveAmendmentForwardingStatus(
  currentStepRun: ForwardingStepRunLike | null | undefined,
  nextStepRun: ForwardingTargetStepRunLike | null | undefined
): AmendmentForwardingStatus {
  const decisionStatus = currentStepRun?.decision_status ?? currentStepRun?.status ?? null;

  if (decisionStatus === 'rejected') return 'rejected';
  if (decisionStatus === 'tie') return 'tie';

  const currentStepApproved =
    currentStepRun?.status === 'approved' || currentStepRun?.decision_status === 'approved';
  const targetStepMaterialized = Boolean(nextStepRun?.agenda_item_id && nextStepRun?.vote_id);

  return currentStepApproved && targetStepMaterialized ? 'forwarded' : 'pending';
}

export function buildAmendmentForwardingPreview(args: {
  amendmentId?: string | null;
  currentStepRun?: ForwardingStepRunLike | null;
  nextStepRun?: ForwardingTargetStepRunLike | null;
}): AmendmentForwardingPreviewModel | null {
  const { amendmentId, currentStepRun, nextStepRun } = args;
  if (!amendmentId || !nextStepRun?.event) return null;

  return {
    status: deriveAmendmentForwardingStatus(currentStepRun, nextStepRun),
    nextGroupId: nextStepRun.target_group?.id ?? null,
    nextGroupName: nextStepRun.target_group?.name ?? null,
    nextEventId: nextStepRun.event.id ?? null,
    nextEventTitle: nextStepRun.event.title ?? 'Next event',
    nextEventStartDate: nextStepRun.event.start_date ?? null,
  };
}

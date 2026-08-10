interface AmendmentPathStepLike {
  id?: string;
  target_group_id?: string | null;
  target_group?: { name?: string | null } | null;
  workflow_step?: { label?: string | null } | null;
  event_id?: string | null;
  event?: { id?: string | null; title?: string | null; start_date?: number | null } | null;
  starts_at?: number | null;
  agenda_item_id?: string | null;
  vote_id?: string | null;
  decision_status?: string | null;
  status?: string | null;
  order_index?: number | null;
}

const APPROVED_PATH_STATUSES = new Set([
  'approved',
  'accepted',
  'supported',
  'merged',
  'completed',
]);

const REJECTED_PATH_STATUSES = new Set(['rejected', 'withdrawn']);

const ACTIVE_PATH_STATUSES = new Set(['forward_confirmed', 'scheduled', 'in_vote']);

export function normalizePathStepStatus(status?: string | null) {
  if (!status) {
    return 'pending';
  }

  if (APPROVED_PATH_STATUSES.has(status)) {
    return 'approved';
  }

  if (REJECTED_PATH_STATUSES.has(status)) {
    return 'rejected';
  }

  if (ACTIVE_PATH_STATUSES.has(status)) {
    return 'active';
  }

  return 'pending';
}

export function isLikelyActiveAmendmentStep(
  step: Pick<AmendmentPathStepLike, 'status' | 'decision_status'>
) {
  const effectiveStatus = step.decision_status ?? step.status ?? null;
  return (
    effectiveStatus === 'forward_confirmed' ||
    effectiveStatus === 'scheduled' ||
    effectiveStatus === 'in_vote' ||
    effectiveStatus === 'pending_event' ||
    step.status === 'scheduled' ||
    step.status === 'in_vote' ||
    step.status === 'pending_event'
  );
}

export function findLikelyActiveAmendmentStep<
  TStepRun extends Pick<AmendmentPathStepLike, 'id' | 'status' | 'decision_status' | 'order_index'>,
>(stepRuns: readonly TStepRun[]) {
  return (
    stepRuns.find(step => isLikelyActiveAmendmentStep(step)) ??
    stepRuns.find(step => getFirstUnresolvedAmendmentStepId([step]) === step.id) ??
    null
  );
}

export function getFirstUnresolvedAmendmentStepId<
  TStepRun extends Pick<AmendmentPathStepLike, 'id' | 'status' | 'decision_status' | 'order_index'>,
>(stepRuns: readonly TStepRun[]) {
  return (
    [...stepRuns]
      .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
      .find(step => {
        const effectiveState = normalizePathStepStatus(step.decision_status ?? step.status);
        return effectiveState !== 'approved' && effectiveState !== 'rejected';
      })?.id ?? null
  );
}

export function buildAmendmentPathGroupTypeById<
  TStepRun extends Pick<AmendmentPathStepLike, 'target_group_id'>,
>(stepRuns: readonly TStepRun[]) {
  return new Map(
    stepRuns
      .filter(step => step.target_group_id)
      .map(step => [step.target_group_id as string, null] as const)
  );
}

export function buildAmendmentPathVisualizationData<TStepRun extends AmendmentPathStepLike>(
  stepRuns: readonly TStepRun[],
  options?: {
    isEventRequestPending?: (stepRun: TStepRun) => boolean;
    activeStepId?: string | null;
  }
) {
  return stepRuns.map(step => ({
    groupId: step.target_group_id ?? null,
    groupName: step.target_group?.name ?? step.workflow_step?.label ?? 'Unknown group',
    eventId: step.event_id ?? null,
    eventTitle: step.event?.title ?? 'Pending event',
    eventStartDate: step.event?.start_date ?? step.starts_at ?? null,
    agendaItemId: step.agenda_item_id ?? null,
    amendmentVoteId: step.vote_id ?? null,
    forwardingStatus: step.decision_status ?? step.status ?? 'previous_decision_outstanding',
    rawStatus: step.status ?? null,
    rawDecisionStatus: step.decision_status ?? null,
    order: step.order_index ?? null,
    isActiveStep: Boolean(options?.activeStepId && step.id === options.activeStepId),
    eventRequestPending: options?.isEventRequestPending
      ? options.isEventRequestPending(step)
      : false,
  }));
}

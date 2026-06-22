import {
  isMockCRTimelineItem,
  isPendingSubmissionCRTimelineItem,
} from './createMockCRTimelineItems';

interface AgendaChangeRequestLogItem {
  id?: string | null;
  agenda_item_id?: string | null;
  change_request_id?: string | null;
  vote_id?: string | null;
  order_index?: number | null;
  status?: string | null;
  is_closing_vote?: boolean | null;
  step_kind?: string | null;
  _voteStepKind?: string | null;
  _votePlaceholder?: boolean | null;
  process_branch_id?: string | null;
  change_request?: {
    id?: string | null;
    title?: string | null;
    status?: string | null;
    voting_status?: string | null;
    confirmation_status?: string | null;
    process_branch_id?: string | null;
  } | null;
  vote?: {
    id?: string | null;
    status?: string | null;
    purpose?: string | null;
    choices?: readonly unknown[] | null;
  } | null;
}

export function logAgendaChangeRequestItems(
  scope: string,
  payload: {
    agendaItemId?: string | null;
    amendmentId?: string | null;
    editingMode?: string | null;
    selectedBranchId?: string | null;
    selectedItemId?: string | null;
    items: readonly AgendaChangeRequestLogItem[];
    pendingDisplayItems?: readonly AgendaChangeRequestLogItem[];
  }
) {
  if (!import.meta.env.DEV) return;

  const summarize = (item: AgendaChangeRequestLogItem) => ({
    id: item.id ?? null,
    agendaItemId: item.agenda_item_id ?? null,
    changeRequestId: item.change_request_id ?? item.change_request?.id ?? null,
    voteId: item.vote_id ?? item.vote?.id ?? null,
    orderIndex: item.order_index ?? null,
    status: item.status ?? null,
    voteStatus: item.vote?.status ?? null,
    votePurpose: item.vote?.purpose ?? null,
    stepKind: item.step_kind ?? null,
    syntheticStepKind: item._voteStepKind ?? null,
    branchId: item.process_branch_id ?? item.change_request?.process_branch_id ?? null,
    isFinalVote: Boolean(item.is_closing_vote),
    isPlaceholder: Boolean(item._votePlaceholder),
    isSynthetic: isMockCRTimelineItem(item),
    isPendingSubmission: isPendingSubmissionCRTimelineItem(item),
    choiceCount: item.vote?.choices?.length ?? 0,
  });

  console.debug(`[AgendaChangeRequests:${scope}]`, {
    agendaItemId: payload.agendaItemId ?? null,
    amendmentId: payload.amendmentId ?? null,
    editingMode: payload.editingMode ?? null,
    selectedBranchId: payload.selectedBranchId ?? null,
    selectedItemId: payload.selectedItemId ?? null,
    items: payload.items.map(summarize),
    pendingDisplayItems: payload.pendingDisplayItems?.map(summarize) ?? [],
  });
}

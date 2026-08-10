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
  _scope: string,
  _payload: {
    agendaItemId?: string | null;
    amendmentId?: string | null;
    editingMode?: string | null;
    selectedBranchId?: string | null;
    selectedItemId?: string | null;
    items: readonly AgendaChangeRequestLogItem[];
    pendingDisplayItems?: readonly AgendaChangeRequestLogItem[];
  }
) {
  // Intentionally retained as a no-op compatibility hook for former development logging.
}

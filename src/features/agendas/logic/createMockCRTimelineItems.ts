import { translate as translateText } from '@/features/shared/hooks/use-translation';
/**
 * Creates mock ChangeRequestTimelineRow-compatible objects from CR summaries.
 * Used to display change requests in the timeline card style before event final voting is initialized.
 */

export interface CRSummary {
  id: string;
  crId?: string;
  displayCrId?: string;
  branchDisplayNumber?: number;
  branchScopedCrNumber?: number;
  branchSequenceNumber?: number | null;
  changedCharacterCount?: number | null;
  title: string;
  description: string;
  status: string; // 'open' | 'approved' | 'accepted' | 'rejected' | 'declined'
  type?: string;
  text?: string;
  newText?: string;
  properties?: Record<string, string>;
  newProperties?: Record<string, string>;
  justification?: string;
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
  suggestionId?: string | null;
  discussionId?: string | null;
  changeRequestEntityId?: string | null;
  processBranchId?: string | null;
  logicalKey?: string | null;
  votingDeadline?: number | null;
  closeTrigger?: string | null;
  eligibleVoterCount?: number;
  votedCollaboratorCount?: number;
  resolutionMethod?: string | null;
  visibilityScope?: string | null;
  resolvedInMode?: string | null;
  votingStatus?: string | null;
  userVote?: string | null;
  confirmationStatus?: 'pending' | 'confirmed' | null;
  changeRequestStatus?: string | null;
}

function isAcceptedStatus(status: string) {
  return status === 'approved' || status === 'accepted';
}

function isRejectedStatus(status: string) {
  return status === 'declined' || status === 'rejected';
}

function mapCRStatusToTimelineStatus(status: string): string {
  if (isAcceptedStatus(status) || isRejectedStatus(status)) return 'completed';
  return 'pending';
}

export function isPendingSubmissionCRTimelineItem(item: {
  _originalStatus?: string | null;
  change_request?: {
    status?: string | null;
    voting_status?: string | null;
    confirmation_status?: string | null;
    confirmationStatus?: string | null;
    change_request_status?: string | null;
    changeRequestStatus?: string | null;
  } | null;
}) {
  const cr = item.change_request;
  return (
    item._originalStatus === 'pending_submission' ||
    cr?.status === 'pending_submission' ||
    cr?.voting_status === 'pending_submission' ||
    cr?.change_request_status === 'pending_submission' ||
    cr?.changeRequestStatus === 'pending_submission' ||
    cr?.confirmation_status === 'pending' ||
    cr?.confirmationStatus === 'pending'
  );
}

export function isMockCRTimelineItem(item: {
  id?: string | null;
  vote_id?: string | null;
  vote?: { id?: string | null } | null;
}) {
  return (
    item.id?.startsWith('mock-cr-') ||
    item.vote_id?.startsWith('mock-vote-') ||
    item.vote?.id?.startsWith('mock-vote-')
  );
}

function createMockVote(itemId: string, cr: CRSummary) {
  const isCompleted = isAcceptedStatus(cr.status) || isRejectedStatus(cr.status);
  const tallyPhase = isCompleted ? 'final' : 'indicative';
  const voteStatus = isCompleted ? 'closed' : 'indicative';
  const totalVotes = (cr.votesFor ?? 0) + (cr.votesAgainst ?? 0) + (cr.votesAbstain ?? 0);

  return {
    id: `mock-vote-${itemId}`,
    status: voteStatus,
    majority_type: 'simple' as const,
    visibility: null,
    choices: [
      {
        id: `mock-choice-yes-${itemId}`,
        vote_id: `mock-vote-${itemId}`,
        label: translateText('generated.inline.0001_yes_fb360f9c'),
        order_index: 0,
      },
      {
        id: `mock-choice-no-${itemId}`,
        vote_id: `mock-vote-${itemId}`,
        label: translateText('generated.inline.0002_no_fd128635'),
        order_index: 1,
      },
      {
        id: `mock-choice-abstain-${itemId}`,
        vote_id: `mock-vote-${itemId}`,
        label: translateText('generated.inline.0003_abstain_6dcb7d80'),
        order_index: 2,
      },
    ],
    voters: Array.from({ length: totalVotes }, (_, index) => ({
      id: `mock-voter-${itemId}-${index}`,
      vote_id: `mock-vote-${itemId}`,
      user_id: `mock-user-${index}`,
    })),
    indicative_participations: [] as never[],
    indicative_decisions: [] as never[],
    final_participations: [] as never[],
    final_decisions: [] as never[],
    offline_tallies: [
      {
        id: `mock-tally-yes-${itemId}`,
        vote_id: `mock-vote-${itemId}`,
        phase: tallyPhase,
        choice_id: `mock-choice-yes-${itemId}`,
        count: cr.votesFor ?? 0,
      },
      {
        id: `mock-tally-no-${itemId}`,
        vote_id: `mock-vote-${itemId}`,
        phase: tallyPhase,
        choice_id: `mock-choice-no-${itemId}`,
        count: cr.votesAgainst ?? 0,
      },
      {
        id: `mock-tally-abstain-${itemId}`,
        vote_id: `mock-vote-${itemId}`,
        phase: tallyPhase,
        choice_id: `mock-choice-abstain-${itemId}`,
        count: cr.votesAbstain ?? 0,
      },
    ],
  };
}

/**
 * Build an array of mock timeline items from CR summaries,
 * compatible with ChangeRequestTimelineRow for rendering in ChangeRequestTimelineCard.
 * Appends a Final Vote item at the end.
 */
export function createMockCRTimelineItems(crSummaries: CRSummary[]) {
  const items = crSummaries.map((cr, index) => {
    const persistedChangeRequestId = cr.changeRequestEntityId ?? cr.id;
    const suggestionId = cr.suggestionId ?? cr.discussionId ?? cr.id;

    return {
      id: `mock-cr-${persistedChangeRequestId}`,
      agenda_item_id: 'mock-agenda',
      change_request_id: persistedChangeRequestId,
      _processBranchId: cr.processBranchId ?? null,
      vote_id: `mock-vote-${persistedChangeRequestId}`,
      order_index: index,
      is_closing_vote: false,
      status: mapCRStatusToTimelineStatus(cr.status),
      change_request: {
        id: persistedChangeRequestId,
        amendment_id: null,
        process_branch_id: cr.processBranchId ?? null,
        user_id: null,
        title: cr.title || cr.crId || `CR-${index + 1}`,
        cr_id: cr.crId ?? null,
        display_cr_id: cr.displayCrId ?? cr.crId ?? null,
        displayCrId: cr.displayCrId ?? cr.crId ?? null,
        branch_display_number: cr.branchDisplayNumber ?? null,
        branchDisplayNumber: cr.branchDisplayNumber ?? null,
        branch_scoped_cr_number: cr.branchScopedCrNumber ?? null,
        branchScopedCrNumber: cr.branchScopedCrNumber ?? null,
        branch_sequence_number: cr.branchSequenceNumber ?? cr.branchScopedCrNumber ?? null,
        branchSequenceNumber: cr.branchSequenceNumber ?? cr.branchScopedCrNumber ?? null,
        changed_character_count: cr.changedCharacterCount ?? null,
        changedCharacterCount: cr.changedCharacterCount ?? null,
        change_type: cr.type ?? null,
        original_text: cr.text ?? null,
        new_text: cr.newText ?? null,
        original_properties: cr.properties ?? null,
        new_properties: cr.newProperties ?? null,
        suggestion_id: suggestionId,
        description: cr.description || null,
        status: cr.status || null,
        votes_for: cr.votesFor ?? 0,
        votes_against: cr.votesAgainst ?? 0,
        votes_abstain: cr.votesAbstain ?? 0,
        voting_status: cr.votingStatus ?? null,
        user_vote: cr.userVote ?? null,
        voting_deadline: cr.votingDeadline ?? null,
        close_trigger: cr.closeTrigger ?? null,
        eligible_voter_count: cr.eligibleVoterCount ?? 0,
        voted_collaborator_count: cr.votedCollaboratorCount ?? 0,
        resolution_method: cr.resolutionMethod ?? null,
        visibility_scope: cr.visibilityScope ?? null,
        resolved_in_mode: cr.resolvedInMode ?? null,
        confirmation_status: cr.confirmationStatus ?? null,
        change_request_status: cr.changeRequestStatus ?? cr.status ?? null,
        created_at: null,
        updated_at: null,
        user: null,
      },
      vote: createMockVote(persistedChangeRequestId, cr),
      // Store original status for tab filtering
      _originalStatus: cr.status,
    };
  });

  return items;
}

export type MockCRTimelineItem = ReturnType<typeof createMockCRTimelineItems>[number];

/**
 * Determine the tab filter status for a timeline item.
 * Works for both real ChangeRequestTimelineRow and mock items.
 */
export function getCRFilterStatus(
  item: { status?: string | null; is_closing_vote?: boolean; _originalStatus?: string },
  getVoteResultFn?: (item: never) => string
): 'open' | 'accepted' | 'rejected' {
  // Mock items carry the original CR status
  if (item._originalStatus) {
    if (isAcceptedStatus(item._originalStatus)) return 'accepted';
    if (isRejectedStatus(item._originalStatus)) return 'rejected';
    return 'open';
  }

  // Real timeline items
  if (item.status === 'completed' && getVoteResultFn) {
    const result = getVoteResultFn(item as never);
    if (result === 'passed') return 'accepted';
    if (result === 'rejected') return 'rejected';
  }

  if (item.status === 'completed') return 'accepted'; // fallback for completed without result fn
  return 'open';
}

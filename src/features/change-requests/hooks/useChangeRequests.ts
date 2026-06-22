import { useMemo } from 'react';
import type { Value } from 'platejs';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import {
  countChangedCharacters,
  extractSuggestionContent,
  hasRenderableSuggestionContent,
  suggestionContentFromChangeRequestSnapshot,
  type SuggestionProperties,
  type SuggestionContent,
} from '../utils/suggestion-extraction';
import {
  buildCanonicalChangeRequestRecords,
  type CanonicalSavedChangeRequest,
} from '../logic/canonicalChangeRequests';

/** Shape of entries in the amendment's `discussions` JSON column */
interface DiscussionEntry {
  id: string;
  crId?: string;
  changeRequestEntityId?: string;
  title?: string;
  description?: string;
  justification?: string;
  status?: string;
  confirmationStatus?: 'pending' | 'confirmed' | null;
  changeRequestStatus?: string | null;
  createdAt?: number;
  userId?: string;
  comments?: readonly { text?: string; value?: string; userId?: string }[];
}

interface ChangeRequestVoteRow {
  id: string;
  vote?: string | null;
  user_id?: string;
  created_at?: number;
  user?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar?: string | null;
  } | null;
}

type ChangeRequestRowForView = Omit<CanonicalSavedChangeRequest, 'votes'> & {
  description?: string | null;
  user_id?: string | null;
  creator?: { id?: string | null } | null;
  user?: { id?: string | null } | null;
  voting_deadline?: number | null;
  resolution_method?: string | null;
  visibility_scope?: string | null;
  resolved_in_mode?: string | null;
  branch_sequence_number?: number | null;
  changed_character_count?: number | null;
  changedCharacterCount?: number | null;
  votes?: readonly ChangeRequestVoteRow[] | null;
};

export interface ChangeRequest {
  id: string;
  processBranchId: string | null;
  crId: string;
  crNumber: number;
  displayCrId?: string;
  branchDisplayNumber?: number;
  branchScopedCrNumber?: number;
  branchSequenceNumber?: number | null;
  changedCharacterCount: number;
  title: string;
  description: string;
  type: string;
  text: string;
  newText: string;
  properties: SuggestionProperties;
  newProperties: SuggestionProperties;
  proposedChange: string;
  justification: string;
  isResolved: boolean;
  status: string;
  resolution: string | null;
  resolvedAt: number | null;
  resolvedBy: string | null;
  createdAt: number;
  userId: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  votingDeadline: number | null;
  closeTrigger: string | null;
  eligibleVoterCount: number;
  votedCollaboratorCount: number;
  resolutionMethod: string | null;
  visibilityScope: string | null;
  resolvedInMode: string | null;
  votingStatus: string | null;
  confirmationStatus: 'pending' | 'confirmed' | null;
  changeRequestStatus: string | null;
  userVote: string | null;
  comments: readonly { text?: string; value?: string; userId?: string }[];
  votes: readonly {
    id: string;
    vote?: string | null;
    user_id?: string;
    created_at?: number;
    user?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      avatar?: string | null;
    } | null;
  }[];
  discussionId: string | null;
  suggestionId: string | null;
  changeRequestEntityId?: string;
  logicalKey?: string;
}

function isApprovedStatus(status: string | null | undefined) {
  return status === 'approved' || status === 'accepted';
}

function isDeclinedStatus(status: string | null | undefined) {
  return status === 'declined' || status === 'rejected';
}

function isActiveCollaborator(collaborator: { status?: string | null }) {
  return (
    collaborator.status === 'active' ||
    collaborator.status === 'collaborator' ||
    collaborator.status === 'member' ||
    collaborator.status === 'admin'
  );
}

function hasAmendmentVoteRight(
  collaborator: {
    role?: {
      action_rights?:
        | readonly {
            resource?: string | null;
            action?: string | null;
            amendment_id?: string | null;
            amendment?: { id?: string | null } | null;
          }[]
        | null;
    } | null;
  },
  amendmentId: string
) {
  return (collaborator.role?.action_rights ?? []).some(
    right =>
      right.resource === 'amendments' &&
      right.action === 'vote' &&
      (!right.amendment_id || right.amendment_id === amendmentId) &&
      (!right.amendment?.id || right.amendment.id === amendmentId)
  );
}

function getCollaboratorUserId(collaborator: {
  user_id?: string | null;
  user?: { id?: string | null } | null;
}) {
  return collaborator.user_id ?? collaborator.user?.id ?? null;
}

function normalizeInternalCRVotingCloseTrigger(value: string | null | undefined) {
  return value === 'after_minutes' ? 'after_minutes' : 'all_collaborators_voted';
}

function getTimestamp(row: { updated_at?: number | null; updatedAt?: number | null }) {
  return row.updated_at ?? row.updatedAt ?? null;
}

function getCreatedAt(row: { created_at?: number | null; createdAt?: number | null }) {
  return row.created_at ?? row.createdAt ?? 0;
}

function getCreatorId(row: {
  user_id?: string | null;
  creator?: { id?: string | null } | null;
  user?: { id?: string | null } | null;
}) {
  return row.user_id ?? row.creator?.id ?? row.user?.id ?? '';
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getBestSuggestionContent({
  discussionId,
  documentContent,
  changeRequest,
}: {
  discussionId?: string | null;
  documentContent: Value | undefined;
  changeRequest?: {
    change_type?: string | null;
    original_text?: string | null;
    new_text?: string | null;
    original_properties?: any;
    new_properties?: any;
  } | null;
}): SuggestionContent {
  if (discussionId) {
    const liveContent = extractSuggestionContent(discussionId, documentContent);
    if (hasRenderableSuggestionContent(liveContent)) {
      return liveContent;
    }
  }

  if (changeRequest) {
    const snapshotContent = suggestionContentFromChangeRequestSnapshot(changeRequest);
    if (hasRenderableSuggestionContent(snapshotContent)) {
      return snapshotContent;
    }
  }

  return { type: 'unknown', text: '', newText: '', properties: {}, newProperties: {} };
}

function getPersistedChangedCharacterCount(
  changeRequest?: {
    changed_character_count?: number | null;
    changedCharacterCount?: number | null;
  } | null
) {
  const value = changeRequest?.changed_character_count ?? changeRequest?.changedCharacterCount;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveChangedCharacterCount(
  changeRequest:
    | {
        changed_character_count?: number | null;
        changedCharacterCount?: number | null;
      }
    | null
    | undefined,
  suggestionContent: SuggestionContent
) {
  const persistedCount = getPersistedChangedCharacterCount(changeRequest);
  const computedCount = countChangedCharacters(suggestionContent);
  if (persistedCount !== null && persistedCount > 0) return persistedCount;
  if (computedCount > 0) return computedCount;
  return persistedCount ?? computedCount;
}

export function useChangeRequests(amendmentId: string, currentUserId?: string) {
  // Fetch amendment data using hook
  const {
    amendment,
    changeRequests: amendmentChangeRequests,
    changeRequestsWithVotes,
    collaborators,
    isLoading: amendmentLoading,
  } = useAmendmentState({ amendmentId, includeChangeRequestsWithVotes: true });

  // Fetch document and users via facade
  const { documents: docResults, isLoading: facadeLoading } = useAmendmentState({
    amendmentId,
    includeDocuments: true,
  });

  const document = docResults?.[0];
  const savedChangeRequests = useMemo<readonly ChangeRequestRowForView[]>(
    () =>
      (changeRequestsWithVotes.length > 0
        ? changeRequestsWithVotes
        : amendmentChangeRequests) as readonly ChangeRequestRowForView[],
    [amendmentChangeRequests, changeRequestsWithVotes]
  );

  // Extract change requests from discussions and saved entities
  const changeRequests = useMemo<ChangeRequest[]>(() => {
    const eligibleVotingCollaboratorIds = new Set(
      (collaborators ?? [])
        .filter(isActiveCollaborator)
        .filter(collaborator => hasAmendmentVoteRight(collaborator, amendmentId))
        .map(getCollaboratorUserId)
        .filter(Boolean)
    );
    const closeTrigger = normalizeInternalCRVotingCloseTrigger(
      amendment?.internal_cr_voting_close_trigger
    );

    const getUserVote = (changeRequest?: (typeof savedChangeRequests)[number]) =>
      changeRequest?.votes?.find(vote => vote.user_id === currentUserId)?.vote ??
      changeRequest?.votes?.[0]?.vote ??
      null;

    return buildCanonicalChangeRequestRecords({
      discussions: amendment?.discussions as readonly DiscussionEntry[] | null | undefined,
      changeRequests: savedChangeRequests,
    }).map(record => {
      const discussion = record.discussion;
      const cr = record.changeRequest;
      const snapshotChangeRequest = record.snapshotChangeRequest ?? cr;
      const suggestionContent = getBestSuggestionContent({
        discussionId: discussion?.id,
        documentContent: document?.content as Value | undefined,
        changeRequest: snapshotChangeRequest,
      });
      const changedCharacterCount = resolveChangedCharacterCount(cr, suggestionContent);
      const resolvedStatus = cr?.status ?? discussion?.status;
      const isResolved = isApprovedStatus(resolvedStatus) || isDeclinedStatus(resolvedStatus);
      const displayCrId = record.displayCrId ?? cr?.title ?? '';

      return {
        id: cr?.id ?? discussion?.id ?? record.logicalKey,
        processBranchId: cr?.process_branch_id ?? null,
        logicalKey: record.logicalKey,
        discussionId: discussion?.id ?? null,
        suggestionId: discussion?.id ?? null,
        crId: displayCrId,
        crNumber: parseInt(displayCrId?.replace('CR-', '') || '0'),
        branchSequenceNumber: cr?.branch_sequence_number ?? null,
        changedCharacterCount,
        title: record.displayTitle,
        description: getOptionalString(discussion?.description) ?? cr?.description ?? '',
        type: suggestionContent.type,
        text: suggestionContent.text,
        newText: suggestionContent.newText,
        properties: suggestionContent.properties,
        newProperties: suggestionContent.newProperties,
        proposedChange: suggestionContent.newText || suggestionContent.text,
        justification:
          getOptionalString(discussion?.justification) ??
          getOptionalString((cr as { justification?: unknown } | null)?.justification) ??
          '',
        isResolved,
        status: cr?.status ?? discussion?.status ?? 'open',
        resolution: isResolved ? (resolvedStatus ?? null) : null,
        resolvedAt: isResolved && cr ? getTimestamp(cr) : null,
        resolvedBy: isResolved && cr ? getCreatorId(cr) : null,
        createdAt: discussion?.createdAt ?? (cr ? getCreatedAt(cr) : 0),
        userId: discussion?.userId ?? (cr ? getCreatorId(cr) : ''),
        votesFor: cr?.votes_for ?? 0,
        votesAgainst: cr?.votes_against ?? 0,
        votesAbstain: cr?.votes_abstain ?? 0,
        votingDeadline: cr?.voting_deadline ?? null,
        closeTrigger,
        eligibleVoterCount: eligibleVotingCollaboratorIds.size,
        votedCollaboratorCount:
          (cr?.votes_for ?? 0) + (cr?.votes_against ?? 0) + (cr?.votes_abstain ?? 0),
        resolutionMethod: cr?.resolution_method ?? null,
        visibilityScope: cr?.visibility_scope ?? null,
        resolvedInMode: cr?.resolved_in_mode ?? null,
        votingStatus: cr?.voting_status ?? null,
        confirmationStatus:
          discussion?.confirmationStatus ??
          (cr?.status === 'pending_submission' ? 'pending' : cr ? 'confirmed' : null),
        changeRequestStatus: cr?.status ?? discussion?.changeRequestStatus ?? null,
        userVote: getUserVote(cr ?? undefined),
        comments: discussion?.comments || [],
        votes: cr?.votes || [],
        changeRequestEntityId: cr?.id ?? discussion?.changeRequestEntityId,
      } as ChangeRequest;
    });
  }, [
    amendment?.discussions,
    amendment?.internal_cr_voting_close_trigger,
    collaborators,
    currentUserId,
    document?.content,
    savedChangeRequests,
  ]);

  // Separate open and closed requests
  const openChangeRequests = useMemo(
    () => changeRequests.filter(req => !req.isResolved),
    [changeRequests]
  );

  const closedChangeRequests = useMemo(
    () => changeRequests.filter(req => req.isResolved),
    [changeRequests]
  );

  const approvedChangeRequests = useMemo(
    () =>
      closedChangeRequests.filter(
        req => isApprovedStatus(req.status) || isApprovedStatus(req.resolution)
      ),
    [closedChangeRequests]
  );

  const declinedChangeRequests = useMemo(
    () =>
      closedChangeRequests.filter(
        req => isDeclinedStatus(req.status) || isDeclinedStatus(req.resolution)
      ),
    [closedChangeRequests]
  );

  // Get unique user IDs from change requests
  const userIds = useMemo(
    () => Array.from(new Set(changeRequests.map(cr => cr.userId).filter(Boolean))),
    [changeRequests]
  );

  // Fetch users for all creators from facade
  const { allUsers: usersResults } = useAmendmentState({
    includeAllUsers: userIds.length > 0,
  });

  // Create a map of userId to user
  const users = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    if (usersResults) {
      usersResults.forEach(user => {
        if (user?.id) {
          map[user.id] = {
            name:
              `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.handle || 'Unknown',
          };
        }
      });
    }
    return map;
  }, [usersResults]);

  const isLoading = amendmentLoading || facadeLoading;

  return {
    amendment,
    document,
    changeRequests,
    openChangeRequests,
    closedChangeRequests,
    approvedChangeRequests,
    declinedChangeRequests,
    users,
    collaborators,
    isLoading,
  };
}

import { useMemo } from 'react';
import type { Value } from 'platejs';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import {
  extractSuggestionContent,
  type SuggestionProperties,
} from '../utils/suggestion-extraction';

/** Shape of entries in the amendment's `discussions` JSON column */
interface DiscussionEntry {
  id: string;
  crId?: string;
  changeRequestEntityId?: string;
  title?: string;
  description?: string;
  justification?: string;
  status?: string;
  createdAt?: number;
  userId?: string;
  comments?: readonly { text?: string; value?: string; userId?: string }[];
}

export interface ChangeRequest {
  id: string;
  crId: string;
  crNumber: number;
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
}

function isApprovedStatus(status: string | null | undefined) {
  return status === 'approved' || status === 'accepted';
}

function isDeclinedStatus(status: string | null | undefined) {
  return status === 'declined' || status === 'rejected';
}

function isActiveCollaborator(collaborator: { status?: string | null }) {
  return (
    collaborator.status === 'collaborator' ||
    collaborator.status === 'member' ||
    collaborator.status === 'admin'
  );
}

function normalizeInternalCRVotingCloseTrigger(value: string | null | undefined) {
  return value === 'after_minutes' ? 'after_minutes' : 'all_collaborators_voted';
}

export function useChangeRequests(amendmentId: string, currentUserId?: string) {
  // Fetch amendment data using hook
  const {
    amendment,
    changeRequests: savedChangeRequests,
    collaborators,
    isLoading: amendmentLoading,
  } = useAmendmentState({ amendmentId });

  // Fetch document and users via facade
  const { documents: docResults, isLoading: facadeLoading } = useAmendmentState({
    amendmentId,
    includeDocuments: true,
  });

  const document = docResults?.[0];

  // Extract change requests from discussions and saved entities
  const changeRequests = useMemo<ChangeRequest[]>(() => {
    const openRequests: ChangeRequest[] = [];
    const closedRequests: ChangeRequest[] = [];
    const activeCollaboratorIds = new Set(
      (collaborators ?? [])
        .filter(isActiveCollaborator)
        .map(collaborator => collaborator.user_id)
        .filter(Boolean)
    );
    const closeTrigger = normalizeInternalCRVotingCloseTrigger(
      amendment?.internal_cr_voting_close_trigger
    );
    const changeRequestById = new Map<string, (typeof savedChangeRequests)[number]>();
    const changeRequestByTitle = new Map<string, (typeof savedChangeRequests)[number]>();
    const discussionByChangeRequestId = new Map<string, DiscussionEntry>();
    const discussionByCrId = new Map<string, DiscussionEntry>();

    for (const changeRequest of savedChangeRequests ?? []) {
      if (changeRequest.id) {
        changeRequestById.set(changeRequest.id, changeRequest);
      }
      if (changeRequest.title) {
        changeRequestByTitle.set(changeRequest.title, changeRequest);
      }
    }

    if (amendment?.discussions && Array.isArray(amendment.discussions)) {
      for (const discussion of amendment.discussions as readonly DiscussionEntry[]) {
        if (discussion.changeRequestEntityId) {
          discussionByChangeRequestId.set(discussion.changeRequestEntityId, discussion);
        }
        if (discussion.crId) {
          discussionByCrId.set(discussion.crId, discussion);
        }
      }
    }

    const getUserVote = (changeRequest?: (typeof savedChangeRequests)[number]) =>
      changeRequest?.votes?.find(vote => vote.user_id === currentUserId)?.vote ??
      changeRequest?.votes?.[0]?.vote ??
      null;

    // Process open change requests from amendment.discussions
    if (amendment?.discussions && Array.isArray(amendment.discussions)) {
      openRequests.push(
        ...(amendment.discussions as readonly DiscussionEntry[])
          .filter(discussion => !!discussion.crId)
          .map(suggestion => {
            const suggestionContent = extractSuggestionContent(
              suggestion.id,
              document?.content as Value | undefined
            );

            const matchingChangeRequest =
              (suggestion.changeRequestEntityId
                ? changeRequestById.get(suggestion.changeRequestEntityId)
                : undefined) ??
              (suggestion.crId ? changeRequestByTitle.get(suggestion.crId) : undefined) ??
              (suggestion.title ? changeRequestByTitle.get(suggestion.title) : undefined);
            const userVote = getUserVote(matchingChangeRequest);
            const resolvedStatus = matchingChangeRequest?.status ?? suggestion.status;
            const isResolved = isApprovedStatus(resolvedStatus) || isDeclinedStatus(resolvedStatus);

            return {
              id: suggestion.id,
              discussionId: suggestion.id,
              suggestionId: suggestion.id,
              crId: suggestion.crId ?? '',
              crNumber: parseInt(suggestion.crId?.replace('CR-', '') || '0'),
              title: suggestion.title || suggestion.crId || '',
              description: suggestion.description || '',
              type: suggestionContent.type,
              text: suggestionContent.text,
              newText: suggestionContent.newText,
              properties: suggestionContent.properties,
              newProperties: suggestionContent.newProperties,
              proposedChange: suggestionContent.newText || suggestionContent.text,
              justification: suggestion.justification || '',
              isResolved,
              status: matchingChangeRequest?.status || 'open',
              resolution: isResolved ? (resolvedStatus ?? null) : null,
              resolvedAt: isResolved ? (matchingChangeRequest?.updated_at ?? null) : null,
              resolvedBy: isResolved ? (matchingChangeRequest?.user_id ?? null) : null,
              createdAt: suggestion.createdAt ?? 0,
              userId: suggestion.userId ?? '',
              votesFor: matchingChangeRequest?.votes_for ?? 0,
              votesAgainst: matchingChangeRequest?.votes_against ?? 0,
              votesAbstain: matchingChangeRequest?.votes_abstain ?? 0,
              votingDeadline: matchingChangeRequest?.voting_deadline ?? null,
              closeTrigger,
              eligibleVoterCount: activeCollaboratorIds.size,
              votedCollaboratorCount:
                (matchingChangeRequest?.votes_for ?? 0) +
                (matchingChangeRequest?.votes_against ?? 0) +
                (matchingChangeRequest?.votes_abstain ?? 0),
              resolutionMethod: matchingChangeRequest?.resolution_method ?? null,
              visibilityScope: matchingChangeRequest?.visibility_scope ?? null,
              resolvedInMode: matchingChangeRequest?.resolved_in_mode ?? null,
              votingStatus: matchingChangeRequest?.voting_status ?? null,
              userVote,
              comments: suggestion.comments || [],
              votes: matchingChangeRequest?.votes || [],
              changeRequestEntityId: matchingChangeRequest?.id ?? suggestion.changeRequestEntityId,
            } as ChangeRequest;
          })
      );
    }

    // Process closed change requests from savedChangeRequests entity
    if (savedChangeRequests && Array.isArray(savedChangeRequests)) {
      const openRequestCrIds = new Set(openRequests.map(r => r.crId));
      const openRequestTitles = new Set(openRequests.map(r => r.title).filter(Boolean));
      const openRequestEntityIds = new Set(
        openRequests.map(r => r.changeRequestEntityId).filter(Boolean)
      );

      closedRequests.push(
        ...savedChangeRequests
          .filter(cr => {
            if (
              openRequestEntityIds.has(cr.id) ||
              openRequestCrIds.has(cr.title) ||
              openRequestTitles.has(cr.title)
            ) {
              return false;
            }
            return isApprovedStatus(cr.status) || isDeclinedStatus(cr.status);
          })
          .map(cr => ({
            id: cr.id,
            discussionId:
              (cr.id ? discussionByChangeRequestId.get(cr.id)?.id : undefined) ??
              (cr.title ? discussionByCrId.get(cr.title)?.id : undefined) ??
              null,
            suggestionId:
              (cr.id ? discussionByChangeRequestId.get(cr.id)?.id : undefined) ??
              (cr.title ? discussionByCrId.get(cr.title)?.id : undefined) ??
              null,
            crId: discussionByChangeRequestId.get(cr.id)?.crId ?? cr.title,
            crNumber: parseInt(
              (discussionByChangeRequestId.get(cr.id)?.crId ?? cr.title)?.replace('CR-', '') || '0'
            ),
            title: cr.title,
            description: cr.description || '',
            type: 'unknown',
            text: cr.proposedChange || '',
            newText: '',
            properties: {},
            newProperties: {},
            proposedChange: cr.proposedChange || '',
            justification: cr.justification || '',
            isResolved: true,
            status: cr.status,
            resolution: cr.status,
            resolvedAt: cr.updatedAt,
            resolvedBy: cr.creator?.id,
            createdAt: cr.createdAt,
            userId: cr.creator?.id,
            votesFor: cr.votes_for ?? 0,
            votesAgainst: cr.votes_against ?? 0,
            votesAbstain: cr.votes_abstain ?? 0,
            votingDeadline: cr.voting_deadline ?? null,
            closeTrigger,
            eligibleVoterCount: activeCollaboratorIds.size,
            votedCollaboratorCount:
              (cr.votes_for ?? 0) + (cr.votes_against ?? 0) + (cr.votes_abstain ?? 0),
            resolutionMethod: cr.resolution_method ?? null,
            visibilityScope: cr.visibility_scope ?? null,
            resolvedInMode: cr.resolved_in_mode ?? null,
            votingStatus: cr.voting_status ?? null,
            userVote: getUserVote(cr),
            comments: [],
            votes: cr.votes || [],
            changeRequestEntityId: cr.id,
          }))
      );
    }

    // Combine and sort by CR number
    return [...openRequests, ...closedRequests].sort((a, b) => a.crNumber - b.crNumber);
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

import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { zql } from '../schema';
import {
  applyChangeRequestVoteResultToContent,
  findChangeRequestDiscussion,
  getChangeRequestResolutionStatus,
  resolveChangeRequestByVoteResult,
  type DiscussionEntry,
  type VoteResult,
} from './server-resolution';
import { normalizeInternalChangeRequestResolutionVisibility } from './visibility';

export const INTERNAL_CR_VOTING_DEFAULT_TRIGGER = 'all_collaborators_voted' as const;
export const INTERNAL_CR_VOTING_DEFAULT_DURATION_MINUTES = 5;
export const INTERNAL_CR_VOTING_CLOSE_TRIGGERS = [
  'all_collaborators_voted',
  'after_minutes',
] as const;

type InternalCRVotingCloseTrigger = (typeof INTERNAL_CR_VOTING_CLOSE_TRIGGERS)[number];
interface InternalCRVotingTx {
  run: (query: any) => Promise<any>;
  mutate: any;
}

interface InternalCRVotingCtx {
  readonly userID: string;
}

interface ChangeRequestVoteRow {
  id: string;
  user_id: string;
  vote?: string | null;
  created_at?: number | null;
}

interface InternalChangeRequestRow {
  id: string;
  amendment_id: string;
  title?: string | null;
  status?: string | null;
  voting_status?: string | null;
  created_at?: number | null;
  created_in_mode?: string | null;
}

const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ['collaborator', 'member', 'admin'];
const INTERNAL_CHANGE_REQUEST_MODES = new Set([
  null,
  undefined,
  'edit',
  'view',
  'suggest_internal',
  'vote_internal',
]);

function isFinalChangeRequestStatus(status: string | null | undefined) {
  return (
    status === 'accepted' || status === 'approved' || status === 'rejected' || status === 'declined'
  );
}

function isOpenChangeRequest(changeRequest: {
  status?: string | null;
  voting_status?: string | null;
}) {
  return (
    !isFinalChangeRequestStatus(changeRequest.status) && changeRequest.voting_status !== 'completed'
  );
}

function isInternalChangeRequest(changeRequest: { created_in_mode?: string | null }) {
  return INTERNAL_CHANGE_REQUEST_MODES.has(changeRequest.created_in_mode);
}

function stableChangeRequestOrder(left: InternalChangeRequestRow, right: InternalChangeRequestRow) {
  const byCreatedAt = (left.created_at ?? 0) - (right.created_at ?? 0);
  return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
}

function getLatestChangeRequestVotes(votes: readonly ChangeRequestVoteRow[]) {
  const latestVoteByUser = new Map<string, ChangeRequestVoteRow>();
  const duplicateVoteIds: string[] = [];

  for (const vote of [...votes].sort((left, right) => {
    const byCreatedAt = (right.created_at ?? 0) - (left.created_at ?? 0);
    return byCreatedAt !== 0 ? byCreatedAt : right.id.localeCompare(left.id);
  })) {
    if (!latestVoteByUser.has(vote.user_id)) {
      latestVoteByUser.set(vote.user_id, vote);
      continue;
    }
    duplicateVoteIds.push(vote.id);
  }

  return { latestVoteByUser, duplicateVoteIds };
}

function countChangeRequestVotes(votes: Iterable<ChangeRequestVoteRow>) {
  let votes_for = 0;
  let votes_against = 0;
  let votes_abstain = 0;

  for (const vote of votes) {
    if (vote.vote === 'accept') votes_for += 1;
    if (vote.vote === 'reject') votes_against += 1;
    if (vote.vote === 'abstain') votes_abstain += 1;
  }

  return { votes_for, votes_against, votes_abstain };
}

function getVoteResult(counts: { votes_for: number; votes_against: number }): VoteResult {
  return counts.votes_for > counts.votes_against ? 'passed' : 'rejected';
}

export function normalizeInternalCRVotingCloseTrigger(
  value: string | null | undefined
): InternalCRVotingCloseTrigger {
  return value === 'after_minutes' ? value : INTERNAL_CR_VOTING_DEFAULT_TRIGGER;
}

export function normalizeInternalCRVotingDurationMinutes(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : INTERNAL_CR_VOTING_DEFAULT_DURATION_MINUTES;
}

export async function normalizeInternalChangeRequestVoteCounts(
  tx: InternalCRVotingTx,
  changeRequestId: string,
  now = Date.now()
) {
  const votes = await tx.run(zql.change_request_vote.where('change_request_id', changeRequestId));
  const { latestVoteByUser, duplicateVoteIds } = getLatestChangeRequestVotes(votes);

  for (const voteId of duplicateVoteIds) {
    await tx.mutate.change_request_vote.delete({ id: voteId });
  }

  const counts = countChangeRequestVotes(latestVoteByUser.values());
  await tx.mutate.change_request.update({
    id: changeRequestId,
    ...counts,
    updated_at: now,
  });

  return { counts, latestVoteByUser };
}

async function activeCollaboratorUserIds(tx: InternalCRVotingTx, amendmentId: string) {
  const collaborators = await tx.run(
    zql.amendment_collaborator
      .where('amendment_id', amendmentId)
      .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
  );

  return [
    ...new Set<string>(
      collaborators
        .map((collaborator: any) => collaborator.user_id)
        .filter((userId: unknown): userId is string => typeof userId === 'string')
    ),
  ];
}

export async function resolveInternalChangeRequestVote({
  tx,
  ctx,
  changeRequestId,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  ctx: InternalCRVotingCtx;
  changeRequestId: string;
  now?: number;
}) {
  const changeRequest = await tx.run(zql.change_request.where('id', changeRequestId).one());
  if (!changeRequest || !isOpenChangeRequest(changeRequest)) {
    return null;
  }

  const { counts } = await normalizeInternalChangeRequestVoteCounts(tx, changeRequestId, now);
  const voteResult = getVoteResult(counts);
  const amendment = await tx.run(zql.amendment.where('id', changeRequest.amendment_id).one());

  return resolveChangeRequestByVoteResult({
    tx: tx as any,
    ctx,
    changeRequestId,
    voteResult,
    now,
    resolutionMethod: 'internal_vote',
    resolvedInMode: 'vote_internal',
    visibilityScope: normalizeInternalChangeRequestResolutionVisibility(
      amendment?.internal_cr_resolution_visibility
    ),
  });
}

export async function maybeFinalizeInternalChangeRequestVote({
  tx,
  ctx,
  changeRequestId,
  reason,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  ctx: InternalCRVotingCtx;
  changeRequestId: string;
  reason: 'after_vote' | 'deadline';
  now?: number;
}) {
  const changeRequest = await tx.run(zql.change_request.where('id', changeRequestId).one());
  if (!changeRequest || !isOpenChangeRequest(changeRequest)) {
    return null;
  }

  const amendment = await tx.run(zql.amendment.where('id', changeRequest.amendment_id).one());
  if (!amendment) {
    return null;
  }

  const trigger = normalizeInternalCRVotingCloseTrigger(amendment.internal_cr_voting_close_trigger);

  if (trigger === 'after_minutes') {
    if (!changeRequest.voting_deadline || changeRequest.voting_deadline > now) {
      return null;
    }
    return resolveInternalChangeRequestVote({ tx, ctx, changeRequestId, now });
  }

  if (reason === 'after_vote' && trigger === 'all_collaborators_voted') {
    const { latestVoteByUser } = await normalizeInternalChangeRequestVoteCounts(
      tx,
      changeRequestId,
      now
    );
    const collaboratorUserIds = await activeCollaboratorUserIds(tx, changeRequest.amendment_id);
    if (
      collaboratorUserIds.length > 0 &&
      collaboratorUserIds.every(userId => latestVoteByUser.has(userId))
    ) {
      return resolveInternalChangeRequestVote({ tx, ctx, changeRequestId, now });
    }
  }

  return null;
}

export async function initializeInternalChangeRequestVotingForAmendment({
  tx,
  amendment,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  amendment: {
    id: string;
    internal_cr_voting_close_trigger?: string | null;
    internal_cr_voting_duration_minutes?: number | null;
    internal_cr_resolution_visibility?: string | null;
  };
  now?: number;
}) {
  const trigger = normalizeInternalCRVotingCloseTrigger(amendment.internal_cr_voting_close_trigger);
  const openChangeRequests = await tx.run(zql.change_request.where('amendment_id', amendment.id));
  const deadline =
    trigger === 'after_minutes'
      ? now +
        normalizeInternalCRVotingDurationMinutes(amendment.internal_cr_voting_duration_minutes) *
          60_000
      : null;

  for (const changeRequest of openChangeRequests.filter(isOpenChangeRequest)) {
    await tx.mutate.change_request.update({
      id: changeRequest.id,
      voting_deadline: deadline,
      updated_at: now,
    });
  }
}

export async function finalizeExpiredInternalChangeRequestVotesForAmendment({
  tx,
  ctx,
  amendmentId,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  ctx: InternalCRVotingCtx;
  amendmentId: string;
  now?: number;
}) {
  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (
    !amendment ||
    normalizeInternalCRVotingCloseTrigger(amendment.internal_cr_voting_close_trigger) !==
      'after_minutes'
  ) {
    return [];
  }

  const changeRequests = await tx.run(zql.change_request.where('amendment_id', amendmentId));
  const expired = changeRequests.filter(
    (changeRequest: any) =>
      isOpenChangeRequest(changeRequest) &&
      changeRequest.voting_deadline &&
      changeRequest.voting_deadline <= now
  );
  const results = [];

  for (const changeRequest of expired) {
    results.push(
      await resolveInternalChangeRequestVote({
        tx,
        ctx,
        changeRequestId: changeRequest.id,
        now,
      })
    );
  }

  return results;
}

export async function finalizeInternalChangeRequestsForEventPhaseTransition({
  tx,
  ctx,
  amendmentId,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  ctx: InternalCRVotingCtx;
  amendmentId: string;
  now?: number;
}) {
  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment) {
    return [];
  }

  const changeRequests = await tx.run(zql.change_request.where('amendment_id', amendmentId));
  const openInternalChangeRequests = (changeRequests as InternalChangeRequestRow[])
    .filter(
      changeRequest => isOpenChangeRequest(changeRequest) && isInternalChangeRequest(changeRequest)
    )
    .sort(stableChangeRequestOrder);

  if (openInternalChangeRequests.length === 0) {
    return [];
  }

  const internalResolutionVisibility = normalizeInternalChangeRequestResolutionVisibility(
    amendment.internal_cr_resolution_visibility
  );
  const discussions: DiscussionEntry[] = Array.isArray(amendment.discussions)
    ? (amendment.discussions as DiscussionEntry[])
    : [];
  const nextDiscussions = [...discussions];
  const document = amendment.document_id
    ? await tx.run(zql.document.where('id', amendment.document_id).one())
    : null;
  let nextDocumentContent = document?.content as
    | Parameters<typeof applyChangeRequestVoteResultToContent>[0]
    | null
    | undefined;
  let documentContentChanged = false;
  let documentVersionCreated = false;

  const ensureDocumentVersion = async () => {
    if (!document || !document.content || documentVersionCreated) {
      return;
    }

    const latestVersion = await tx.run(
      zql.document_version
        .where('document_id', document.id)
        .orderBy('version_number', 'desc')
        .limit(1)
        .one()
    );
    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    await tx.mutate.document_version.insert({
      id: crypto.randomUUID(),
      document_id: document.id,
      amendment_id: amendmentId,
      blog_id: null,
      content: document.content as ReadonlyJSONValue,
      version_number: nextVersionNumber,
      change_summary: 'Internal change requests resolved before event phase',
      author_id: ctx.userID,
      created_at: now,
    });

    documentVersionCreated = true;
  };

  const results = [];

  for (const changeRequest of openInternalChangeRequests) {
    const { counts } = await normalizeInternalChangeRequestVoteCounts(tx, changeRequest.id, now);
    const voteResult = getVoteResult(counts);
    const status = getChangeRequestResolutionStatus(voteResult);
    const matchingDiscussion = findChangeRequestDiscussion(nextDiscussions, changeRequest);

    if (matchingDiscussion?.id && nextDocumentContent) {
      await ensureDocumentVersion();
      nextDocumentContent = applyChangeRequestVoteResultToContent(
        nextDocumentContent,
        matchingDiscussion.id,
        voteResult
      );
      documentContentChanged = true;
    }

    if (matchingDiscussion && nextDiscussions.length > 0) {
      const discussionIndex = nextDiscussions.findIndex(
        discussion => discussion.id === matchingDiscussion.id
      );
      if (discussionIndex >= 0) {
        nextDiscussions[discussionIndex] = {
          ...nextDiscussions[discussionIndex],
          status,
        };
      }
    }

    await tx.mutate.change_request.update({
      id: changeRequest.id,
      status,
      voting_status: 'completed',
      resolved_in_mode: 'vote_internal',
      resolution_method: 'internal_vote',
      visibility_scope: internalResolutionVisibility,
      updated_at: now,
    });

    results.push({ changeRequest, status });
  }

  if (document?.id && documentContentChanged && nextDocumentContent) {
    await tx.mutate.document.update({
      id: document.id,
      content: nextDocumentContent as unknown as ReadonlyJSONValue,
      updated_at: now,
    });
  }

  if (discussions.length > 0) {
    await tx.mutate.amendment.update({
      id: amendmentId,
      discussions: nextDiscussions as unknown as ReadonlyJSONValue,
      updated_at: now,
    });
  }

  return results;
}

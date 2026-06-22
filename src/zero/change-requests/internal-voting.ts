import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { zql } from '../schema';
import { buildCanonicalChangeRequestRecords } from '@/features/change-requests/logic/canonicalChangeRequests';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import {
  applyChangeRequestVoteResultToContent,
  findChangeRequestDiscussion,
  getChangeRequestResolutionStatus,
  resolveChangeRequestByVoteResult,
  type DiscussionEntry,
  type VoteResult,
} from './server-resolution';
import { normalizeInternalChangeRequestResolutionVisibility } from './visibility';
import { isEditingMode, type EditingMode } from '../amendments/editing-mode-policy';

export const INTERNAL_CR_VOTING_DEFAULT_TRIGGER = 'all_collaborators_voted' as const;
export const INTERNAL_CR_VOTING_DEFAULT_DURATION_MINUTES = 5;
export const INTERNAL_CR_VOTING_CLOSE_TRIGGERS = [
  'all_collaborators_voted',
  'after_minutes',
] as const;
const INTERNAL_EVENT_PHASE_VERSION_SUMMARY = 'Internal change requests resolved before event phase';
const INTERNAL_EVENT_PHASE_REPAIR_VERSION_SUMMARY = 'Repair internal change request resolution';

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
  process_branch_id?: string | null;
  title?: string | null;
  status?: string | null;
  voting_status?: string | null;
  resolved_in_mode?: string | null;
  resolution_method?: string | null;
  visibility_scope?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
  created_in_mode?: string | null;
  votes_for?: number | null;
  votes_against?: number | null;
  votes_abstain?: number | null;
  change_type?: string | null;
  original_text?: string | null;
  new_text?: string | null;
  original_properties?: ReadonlyJSONValue | null;
  new_properties?: ReadonlyJSONValue | null;
}

const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ['active', 'collaborator', 'member', 'admin'];
const INTERNAL_CHANGE_REQUEST_MODES = new Set<EditingMode>([
  'edit',
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
  const rawMode = changeRequest.created_in_mode?.trim();
  const mode = rawMode ? (isEditingMode(rawMode) ? rawMode : null) : 'edit';
  return mode ? INTERNAL_CHANGE_REQUEST_MODES.has(mode) : false;
}

function stableChangeRequestOrder(left: InternalChangeRequestRow, right: InternalChangeRequestRow) {
  const byCreatedAt = (left.created_at ?? 0) - (right.created_at ?? 0);
  return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
}

function matchesProcessBranch(
  changeRequest: { process_branch_id?: string | null },
  processBranchId: string | null | undefined
) {
  if (processBranchId === undefined) {
    return true;
  }

  return (changeRequest.process_branch_id ?? null) === (processBranchId ?? null);
}

function changeRequestRecordOrder(
  left: {
    displayCrId: string | null;
    displayTitle: string;
    changeRequest: InternalChangeRequestRow | null;
  },
  right: {
    displayCrId: string | null;
    displayTitle: string;
    changeRequest: InternalChangeRequestRow | null;
  }
) {
  const leftNumber = parseInt(left.displayCrId?.replace('CR-', '') || '0');
  const rightNumber = parseInt(right.displayCrId?.replace('CR-', '') || '0');
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;

  const leftRow = left.changeRequest;
  const rightRow = right.changeRequest;
  if (leftRow && rightRow) {
    const byCreatedAt = (leftRow.created_at ?? 0) - (rightRow.created_at ?? 0);
    if (byCreatedAt !== 0) return byCreatedAt;
  }

  return left.displayTitle.localeCompare(right.displayTitle);
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

function getLatestChangeRequestVotes(
  votes: readonly ChangeRequestVoteRow[],
  eligibleUserIds?: ReadonlySet<string>
) {
  const latestVoteByUser = new Map<string, ChangeRequestVoteRow>();
  const duplicateVoteIds: string[] = [];

  for (const vote of [...votes].sort((left, right) => {
    const byCreatedAt = (right.created_at ?? 0) - (left.created_at ?? 0);
    return byCreatedAt !== 0 ? byCreatedAt : right.id.localeCompare(left.id);
  })) {
    if (eligibleUserIds && !eligibleUserIds.has(vote.user_id)) {
      continue;
    }
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

function getVoteResultFromStatus(status: string | null | undefined): VoteResult {
  return status === 'accepted' || status === 'approved' ? 'passed' : 'rejected';
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
  now = Date.now(),
  eligibleUserIds?: ReadonlySet<string>
) {
  const votes = await tx.run(zql.change_request_vote.where('change_request_id', changeRequestId));
  const { latestVoteByUser, duplicateVoteIds } = getLatestChangeRequestVotes(
    votes,
    eligibleUserIds
  );

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

async function activeVotingCollaboratorUserIds(tx: InternalCRVotingTx, amendmentId: string) {
  const collaborators = await tx.run(
    zql.amendment_collaborator
      .where('amendment_id', amendmentId)
      .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
      .related('role', role => role.related('action_rights'))
  );

  return [
    ...new Set<string>(
      collaborators
        .filter((collaborator: any) => hasAmendmentVoteRight(collaborator, amendmentId))
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

  const eligibleUserIds = new Set(
    await activeVotingCollaboratorUserIds(tx, changeRequest.amendment_id)
  );
  const { counts } = await normalizeInternalChangeRequestVoteCounts(
    tx,
    changeRequestId,
    now,
    eligibleUserIds
  );
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
    const collaboratorUserIds = await activeVotingCollaboratorUserIds(
      tx,
      changeRequest.amendment_id
    );
    const { latestVoteByUser } = await normalizeInternalChangeRequestVoteCounts(
      tx,
      changeRequestId,
      now,
      new Set(collaboratorUserIds)
    );
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
  processBranchId,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  amendment: {
    id: string;
    internal_cr_voting_close_trigger?: string | null;
    internal_cr_voting_duration_minutes?: number | null;
    internal_cr_resolution_visibility?: string | null;
  };
  processBranchId?: string | null;
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

  for (const changeRequest of openChangeRequests
    .filter((changeRequest: any) => matchesProcessBranch(changeRequest, processBranchId))
    .filter(isOpenChangeRequest)) {
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
  processBranchId,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  ctx: InternalCRVotingCtx;
  amendmentId: string;
  processBranchId?: string | null;
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
      matchesProcessBranch(changeRequest, processBranchId) &&
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

function isResolvedInternalVoteChangeRequest(changeRequest: InternalChangeRequestRow) {
  return (
    isFinalChangeRequestStatus(changeRequest.status) &&
    isInternalChangeRequest(changeRequest) &&
    (changeRequest.resolution_method === 'internal_vote' ||
      changeRequest.resolved_in_mode === 'vote_internal')
  );
}

export async function repairInternalChangeRequestResolution({
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
  if (!amendment?.document_id) {
    throw new Error('Amendment document not found');
  }

  const document = await tx.run(zql.document.where('id', amendment.document_id).one());
  if (!document?.content) {
    throw new Error('Amendment document content not found');
  }

  const baseVersion = await tx.run(
    zql.document_version
      .where('document_id', amendment.document_id)
      .where('amendment_id', amendmentId)
      .where('change_summary', INTERNAL_EVENT_PHASE_VERSION_SUMMARY)
      .orderBy('created_at', 'desc')
      .limit(1)
      .one()
  );

  if (!baseVersion?.content) {
    throw new Error('No pre-event change request document version found');
  }

  const discussions: DiscussionEntry[] = Array.isArray(amendment.discussions)
    ? (amendment.discussions as DiscussionEntry[])
    : [];
  const changeRequests = (await tx.run(
    zql.change_request.where('amendment_id', amendmentId)
  )) as InternalChangeRequestRow[];
  const canonicalRecords = buildCanonicalChangeRequestRecords({
    discussions,
    changeRequests: changeRequests.filter(isResolvedInternalVoteChangeRequest),
  })
    .filter(record => !!record.changeRequest)
    .sort(changeRequestRecordOrder);

  if (canonicalRecords.length === 0) {
    return [];
  }

  let repairedContent = baseVersion.content as Parameters<
    typeof applyChangeRequestVoteResultToContent
  >[0];
  const nextDiscussions = [...discussions];
  const results = [];

  for (const record of canonicalRecords) {
    const changeRequest = record.changeRequest;
    if (!changeRequest) {
      continue;
    }

    const voteResult = getVoteResultFromStatus(changeRequest.status);
    const status = getChangeRequestResolutionStatus(voteResult);
    const matchingDiscussion =
      record.discussion ?? findChangeRequestDiscussion(nextDiscussions, changeRequest);
    let resolutionSnapshot = {};

    if (matchingDiscussion?.id) {
      const snapshot = createChangeRequestDiffSnapshot(matchingDiscussion.id, repairedContent);
      if (snapshot.change_type) {
        resolutionSnapshot = snapshot;
      }

      repairedContent = applyChangeRequestVoteResultToContent(
        repairedContent,
        matchingDiscussion.id,
        voteResult
      );

      const discussionIndex = nextDiscussions.findIndex(
        discussion => discussion.id === matchingDiscussion.id
      );
      if (discussionIndex >= 0) {
        nextDiscussions[discussionIndex] = {
          ...nextDiscussions[discussionIndex],
          changeRequestEntityId: changeRequest.id,
          status,
        };
      }
    }

    const resolutionUpdate = {
      status,
      voting_status: 'completed',
      resolved_in_mode: 'vote_internal',
      resolution_method: 'internal_vote',
      visibility_scope: changeRequest.visibility_scope ?? 'public',
      votes_for: changeRequest.votes_for ?? 0,
      votes_against: changeRequest.votes_against ?? 0,
      votes_abstain: changeRequest.votes_abstain ?? 0,
      ...resolutionSnapshot,
      updated_at: now,
    };

    for (const groupedChangeRequest of record.duplicateChangeRequests) {
      await tx.mutate.change_request.update({
        id: groupedChangeRequest.id,
        ...resolutionUpdate,
      });
    }

    results.push({ changeRequest, status });
  }

  const latestVersion = await tx.run(
    zql.document_version
      .where('document_id', document.id)
      .orderBy('version_number', 'desc')
      .limit(1)
      .one()
  );

  await tx.mutate.document_version.insert({
    id: crypto.randomUUID(),
    document_id: document.id,
    amendment_id: amendmentId,
    blog_id: null,
    content: document.content as ReadonlyJSONValue,
    version_number: (latestVersion?.version_number ?? 0) + 1,
    change_summary: INTERNAL_EVENT_PHASE_REPAIR_VERSION_SUMMARY,
    author_id: ctx.userID,
    created_at: now,
  });

  await tx.mutate.document.update({
    id: document.id,
    content: repairedContent as unknown as ReadonlyJSONValue,
    updated_at: now,
  });

  if (nextDiscussions.length > 0) {
    await tx.mutate.amendment.update({
      id: amendmentId,
      discussions: nextDiscussions as unknown as ReadonlyJSONValue,
      updated_at: now,
    });
  }

  return results;
}

export async function finalizeInternalChangeRequestsForEventPhaseTransition({
  tx,
  ctx,
  amendmentId,
  processBranchId,
  now = Date.now(),
}: {
  tx: InternalCRVotingTx;
  ctx: InternalCRVotingCtx;
  amendmentId: string;
  processBranchId?: string | null;
  now?: number;
}) {
  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment) {
    return [];
  }

  const branch = processBranchId
    ? await tx.run(zql.amendment_process_branch.where('id', processBranchId).one())
    : null;

  const changeRequests = await tx.run(zql.change_request.where('amendment_id', amendmentId));
  const openInternalChangeRequests = (changeRequests as InternalChangeRequestRow[])
    .filter(
      changeRequest =>
        matchesProcessBranch(changeRequest, processBranchId) &&
        isOpenChangeRequest(changeRequest) &&
        isInternalChangeRequest(changeRequest)
    )
    .sort(stableChangeRequestOrder);
  const discussionSource = branch ?? amendment;
  const discussions: DiscussionEntry[] = Array.isArray(discussionSource.discussions)
    ? (discussionSource.discussions as DiscussionEntry[])
    : [];
  const canonicalRecords = buildCanonicalChangeRequestRecords({
    discussions,
    changeRequests: openInternalChangeRequests,
  })
    .filter(record => !!record.changeRequest)
    .sort(changeRequestRecordOrder);

  if (canonicalRecords.length === 0) {
    return [];
  }

  const internalResolutionVisibility = normalizeInternalChangeRequestResolutionVisibility(
    amendment.internal_cr_resolution_visibility
  );
  const nextDiscussions = [...discussions];
  const documentId = branch?.document_id ?? amendment.document_id;
  const document = documentId ? await tx.run(zql.document.where('id', documentId).one()) : null;
  let nextDocumentContent = document?.content as
    | Parameters<typeof applyChangeRequestVoteResultToContent>[0]
    | null
    | undefined;
  let documentContentChanged = false;
  let documentVersionCreated = false;
  let eligibleUserIds: Set<string> | null = null;

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
      change_summary: INTERNAL_EVENT_PHASE_VERSION_SUMMARY,
      author_id: ctx.userID,
      created_at: now,
    });

    documentVersionCreated = true;
  };

  const results = [];

  if (!document?.id || !nextDocumentContent) {
    throw new Error('Cannot finalize internal change requests: document content not found.');
  }

  for (const record of canonicalRecords) {
    const changeRequest = record.changeRequest;
    if (!changeRequest) {
      continue;
    }

    const matchingDiscussion =
      record.discussion ?? findChangeRequestDiscussion(nextDiscussions, changeRequest);

    if (!matchingDiscussion?.id) {
      throw new Error(
        `Cannot finalize internal change request ${changeRequest.id}: linked document suggestion not found.`
      );
    }

    const snapshot = createChangeRequestDiffSnapshot(matchingDiscussion.id, nextDocumentContent);
    if (!snapshot.change_type) {
      throw new Error(
        `Cannot finalize internal change request ${changeRequest.id}: linked suggestion is not present in the document.`
      );
    }

    if (!eligibleUserIds) {
      eligibleUserIds = new Set(await activeVotingCollaboratorUserIds(tx, amendmentId));
    }
    const { counts } = await normalizeInternalChangeRequestVoteCounts(
      tx,
      changeRequest.id,
      now,
      eligibleUserIds
    );
    const voteResult = getVoteResult(counts);
    const status = getChangeRequestResolutionStatus(voteResult);
    const resolutionSnapshot = snapshot;

    await ensureDocumentVersion();
    nextDocumentContent = applyChangeRequestVoteResultToContent(
      nextDocumentContent,
      matchingDiscussion.id,
      voteResult
    );
    documentContentChanged = true;

    if (matchingDiscussion && nextDiscussions.length > 0) {
      const discussionIndex = nextDiscussions.findIndex(
        discussion => discussion.id === matchingDiscussion.id
      );
      if (discussionIndex >= 0) {
        nextDiscussions[discussionIndex] = {
          ...nextDiscussions[discussionIndex],
          changeRequestEntityId: changeRequest.id,
          status,
        };
      }
    }

    const resolutionUpdate = {
      status,
      voting_status: 'completed',
      resolved_in_mode: 'vote_internal',
      resolution_method: 'internal_vote',
      visibility_scope: internalResolutionVisibility,
      ...counts,
      ...resolutionSnapshot,
      updated_at: now,
    };

    for (const groupedChangeRequest of record.duplicateChangeRequests) {
      await tx.mutate.change_request.update({
        id: groupedChangeRequest.id,
        ...resolutionUpdate,
      });
    }

    results.push({ changeRequest, status });
  }

  if (document?.id && documentContentChanged && nextDocumentContent) {
    await tx.mutate.document.update({
      id: document.id,
      content: nextDocumentContent as unknown as ReadonlyJSONValue,
      updated_at: now,
    });
  }

  if (discussions.length > 0 && branch?.id) {
    await tx.mutate.amendment_process_branch.update({
      id: branch.id,
      discussions: nextDiscussions as unknown as ReadonlyJSONValue,
      updated_at: now,
    });
  } else if (discussions.length > 0) {
    await tx.mutate.amendment.update({
      id: amendmentId,
      discussions: nextDiscussions as unknown as ReadonlyJSONValue,
      updated_at: now,
    });
  }

  return results;
}

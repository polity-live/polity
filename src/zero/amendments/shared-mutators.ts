import { defineMutator } from '@rocicorp/zero';
import {
  createAmendmentSchema,
  createAmendmentFullMutatorSchema,
  updateAmendmentSchema,
  deleteAmendmentSchema,
  createAmendmentCollaboratorSchema,
  updateAmendmentCollaboratorSchema,
  deleteAmendmentCollaboratorSchema,
  createAmendmentStreetDesignSchema,
  updateAmendmentStreetDesignSchema,
  deleteAmendmentStreetDesignSchema,
  createAmendmentPathSchema,
  deleteAmendmentPathSchema,
  createAmendmentPathSegmentSchema,
  deleteAmendmentPathSegmentSchema,
  createSupportConfirmationSchema,
  updateSupportConfirmationSchema,
  upsertAmendmentGroupDecisionSchema,
  deleteAmendmentGroupDecisionSchema,
  createAmendmentProcessRunSchema,
  updateAmendmentProcessRunSchema,
  createAmendmentProcessBranchSchema,
  updateAmendmentProcessBranchSchema,
  createAmendmentProcessStepRunSchema,
  updateAmendmentProcessStepRunSchema,
  createProcessTaskSchema,
  updateProcessTaskSchema,
  deleteProcessRuntimeRecordSchema,
  initializeAmendmentProcessPathSchema,
  resolveAmendmentProcessVoteSchema,
  completeProcessTaskWithEventSchema,
  replanProcessBranchEventsSchema,
} from './schema';
import {
  createChangeRequestSchema,
  createStreetDesignChangeRequestsSchema,
  deleteChangeRequestSchema,
  finalizeExpiredInternalChangeRequestVotesSchema,
  finalizeInternalChangeRequestVoteSchema,
  repairInternalChangeRequestResolutionSchema,
  updateChangeRequestSchema,
} from '../change-requests/schema';
import {
  createChangeRequestVoteSchema,
  createAmendmentSupportVoteSchema,
  updateAmendmentSupportVoteSchema,
  deleteAmendmentSupportVoteSchema,
} from '../votes/schema';
import { zql } from '../schema';
import { denyPublicApiMutation } from '../rbac/authorize';
import {
  getOpenChangeRequestVisibilityScope,
  getResolvedChangeRequestVisibilityScope,
  INTERNAL_CR_RESOLUTION_DEFAULT_VISIBILITY,
} from '../change-requests/visibility';
import { normalizeEditingMode, type EditingMode } from './editing-mode-policy';
import {
  formatChangeRequestCrId,
  parseChangeRequestCrId,
} from '@/features/change-requests/logic/changeRequestNumbering';

function denyPublicAmendmentProcessMutation(
  tx: Parameters<typeof denyPublicApiMutation>[0],
  action: Parameters<typeof denyPublicApiMutation>[1]['action'],
  scope: string
) {
  denyPublicApiMutation(tx, { action, resource: 'amendments', scope });
}

interface ChangeRequestVoteRow {
  id: string;
  change_request_id: string;
  user_id: string;
  vote?: string | null;
  created_at: number;
}

const INTERNAL_CR_VOTING_DEFAULT_TRIGGER = 'all_collaborators_voted';
const INTERNAL_CR_VOTING_DEFAULT_DURATION_MINUTES = 5;
const INTERNAL_MODES = new Set<EditingMode>(['edit', 'suggest_internal', 'vote_internal']);
const CHANGE_REQUEST_READONLY_BRANCH_STATUSES = new Set(['rejected', 'withdrawn', 'completed']);
const CHANGE_REQUEST_READONLY_BRANCH_RESOLUTIONS = new Set([
  'merge_loser',
  'rejected',
  'withdrawn',
]);

function getChangeRequestVisibilityScope(mode: EditingMode) {
  return getOpenChangeRequestVisibilityScope(mode);
}

function getChangeRequestResolvedVisibilityScope(
  mode: EditingMode,
  internalResolutionVisibility?: string | null
) {
  return getResolvedChangeRequestVisibilityScope({
    resolvedInMode: mode,
    internalResolutionVisibility,
  });
}

function isResolvedStatus(status: string | null | undefined) {
  return isClosedChangeRequestStatus(status);
}

function getDirectResolutionMethod(mode: EditingMode) {
  if (mode === 'vote_internal') return 'internal_vote';
  if (INTERNAL_MODES.has(mode)) return 'direct_internal';
  return null;
}

function normalizeInternalCRVotingTrigger(value: string | null | undefined) {
  return value === 'after_minutes' ? value : INTERNAL_CR_VOTING_DEFAULT_TRIGGER;
}

function normalizeInternalCRVotingDurationMinutes(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : INTERNAL_CR_VOTING_DEFAULT_DURATION_MINUTES;
}

function isClosedChangeRequestStatus(status: string | null | undefined) {
  return (
    status === 'accepted' || status === 'approved' || status === 'rejected' || status === 'declined'
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeDiscussions(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getScopedChangeRequestNumber(row: {
  branch_sequence_number?: number | null;
  title?: string | null;
}) {
  const persisted = row.branch_sequence_number;
  if (typeof persisted === 'number' && Number.isFinite(persisted) && persisted > 0) {
    return Math.floor(persisted);
  }

  return parseChangeRequestCrId(row.title) ?? 0;
}

function getDiscussionCrNumber(discussion: Record<string, any>) {
  return (
    parseChangeRequestCrId(
      typeof discussion.crId === 'string'
        ? discussion.crId
        : typeof discussion.title === 'string'
          ? discussion.title
          : null
    ) ?? 0
  );
}

function sameBranch(
  row: { process_branch_id?: string | null },
  processBranchId: string | null | undefined
) {
  return (row.process_branch_id ?? null) === (processBranchId ?? null);
}

function resolveNextChangeRequestBranchSequence({
  existingChangeRequests,
  processBranchId,
  discussions,
  discussionId,
  requestedCrId,
}: {
  existingChangeRequests: readonly {
    process_branch_id?: string | null;
    branch_sequence_number?: number | null;
    title?: string | null;
  }[];
  processBranchId?: string | null;
  discussions: readonly Record<string, any>[];
  discussionId?: string | null;
  requestedCrId?: string | null;
}) {
  const scopedChangeRequests = existingChangeRequests.filter(row =>
    sameBranch(row, processBranchId)
  );
  const persistedNumbers = new Set(
    scopedChangeRequests.map(
      (row: { branch_sequence_number?: number | null; title?: string | null }) =>
        getScopedChangeRequestNumber(row)
    )
  );
  const maxFromRows = scopedChangeRequests.reduce(
    (max: number, row: { branch_sequence_number?: number | null; title?: string | null }) =>
      Math.max(max, getScopedChangeRequestNumber(row)),
    0
  );
  const targetDiscussion = discussionId
    ? (discussions.find(discussion => discussion.id === discussionId) ?? null)
    : null;
  const maxFromOtherDiscussions = discussions.reduce(
    (max, discussion) =>
      discussion === targetDiscussion ? max : Math.max(max, getDiscussionCrNumber(discussion)),
    0
  );
  const requestedNumber = parseChangeRequestCrId(requestedCrId);
  const isTargetReservation =
    requestedNumber !== null &&
    requestedNumber > 0 &&
    targetDiscussion !== null &&
    getDiscussionCrNumber(targetDiscussion) === requestedNumber;

  if (isTargetReservation && !persistedNumbers.has(requestedNumber)) {
    return requestedNumber;
  }

  const nextNumber = Math.max(maxFromRows, maxFromOtherDiscussions) + 1;

  return requestedNumber && requestedNumber >= nextNumber ? requestedNumber : nextNumber;
}

function updateDiscussionForCreatedChangeRequest({
  discussions,
  discussionId,
  requestedCrId,
  changeRequestId,
  crId,
  branchSequenceNumber,
  status,
  votingStatus,
  now,
}: {
  discussions: readonly Record<string, any>[];
  discussionId?: string | null;
  requestedCrId?: string | null;
  changeRequestId: string;
  crId: string;
  branchSequenceNumber: number;
  status?: string | null;
  votingStatus?: string | null;
  now: number;
}) {
  const targetIndex = discussions.findIndex(discussion => {
    return (
      (discussionId && discussion.id === discussionId) ||
      discussion.changeRequestEntityId === changeRequestId ||
      (requestedCrId && discussion.crId === requestedCrId)
    );
  });

  if (targetIndex < 0) {
    return null;
  }

  const nextDiscussions = [...discussions];
  const isPendingSubmission =
    status === 'pending_submission' || votingStatus === 'pending_submission';
  nextDiscussions[targetIndex] = {
    ...nextDiscussions[targetIndex],
    crId,
    changeRequestEntityId: changeRequestId,
    changeRequestStatus: status ?? nextDiscussions[targetIndex].changeRequestStatus ?? 'open',
    votingStatus: votingStatus ?? nextDiscussions[targetIndex].votingStatus ?? null,
    confirmationStatus: isPendingSubmission
      ? 'pending'
      : (nextDiscussions[targetIndex].confirmationStatus ?? 'confirmed'),
    confirmedAt: isPendingSubmission
      ? nextDiscussions[targetIndex].confirmedAt
      : (nextDiscussions[targetIndex].confirmedAt ?? now),
    branchScopedCrNumber: branchSequenceNumber,
    branchSequenceNumber,
  };

  return nextDiscussions;
}

function getAmendmentOriginId(amendment: {
  id: string;
  origin_amendment_id?: string | null;
  clone_source_id?: string | null;
}) {
  return amendment.origin_amendment_id ?? amendment.clone_source_id ?? amendment.id;
}

async function assertChangeRequestProcessBranch(
  tx: Parameters<typeof denyPublicApiMutation>[0],
  amendment: {
    id: string;
    origin_amendment_id?: string | null;
    clone_source_id?: string | null;
  } | null,
  processBranchId?: string | null
) {
  if (!processBranchId) {
    return null;
  }

  if (!amendment) {
    throw new Error('Amendment not found');
  }

  const branch = await tx.run(zql.amendment_process_branch.where('id', processBranchId).one());
  if (!branch) {
    throw new Error('Process branch not found');
  }

  const processRun = await tx.run(
    zql.amendment_process_run.where('id', branch.process_run_id).one()
  );
  if (!processRun || processRun.amendment_id !== getAmendmentOriginId(amendment)) {
    throw new Error('Process branch does not belong to this amendment.');
  }

  if (!branch.document_id) {
    throw new Error('Process branch has no document.');
  }

  if (
    CHANGE_REQUEST_READONLY_BRANCH_STATUSES.has(branch.status ?? '') ||
    CHANGE_REQUEST_READONLY_BRANCH_RESOLUTIONS.has(branch.resolution ?? '')
  ) {
    throw new Error('Process branch is read-only.');
  }

  return branch;
}

function countLatestChangeRequestVotes(votes: Iterable<ChangeRequestVoteRow>) {
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

async function upsertChangeRequestVoteAndRecompute({
  tx,
  userID,
  args,
}: {
  tx: Parameters<typeof denyPublicApiMutation>[0];
  userID: string;
  args: {
    id: string;
    change_request_id: string;
    vote?: string | null;
  };
}) {
  const changeRequest = await tx.run(zql.change_request.where('id', args.change_request_id).one());
  if (!changeRequest) {
    throw new Error('Change request not found');
  }
  if (
    isClosedChangeRequestStatus(changeRequest.status) ||
    changeRequest.voting_status === 'completed'
  ) {
    throw new Error('Change request voting is already completed');
  }

  const now = Date.now();
  const existingVotes = await tx.run(
    zql.change_request_vote.where('change_request_id', args.change_request_id)
  );
  const userVotes = existingVotes.filter(vote => vote.user_id === userID);
  const currentUserKeeper = userVotes.reduce<ChangeRequestVoteRow | null>((latest, vote) => {
    if (!latest) return vote;
    return (vote.created_at ?? 0) > (latest.created_at ?? 0) ? vote : latest;
  }, null);

  const currentVote: ChangeRequestVoteRow = currentUserKeeper
    ? {
        ...currentUserKeeper,
        vote: args.vote ?? null,
        created_at: now,
      }
    : {
        id: args.id,
        change_request_id: args.change_request_id,
        user_id: userID,
        vote: args.vote ?? null,
        created_at: now,
      };

  if (currentUserKeeper) {
    await tx.mutate.change_request_vote.update({
      id: currentUserKeeper.id,
      vote: args.vote ?? null,
      created_at: now,
    });
  } else {
    await tx.mutate.change_request_vote.insert(currentVote);
  }

  const candidateVotes = [
    ...existingVotes.filter(vote => vote.user_id !== userID),
    currentVote,
  ].sort((left, right) => {
    const byCreatedAt = (right.created_at ?? 0) - (left.created_at ?? 0);
    return byCreatedAt !== 0 ? byCreatedAt : right.id.localeCompare(left.id);
  });

  const latestVoteByUser = new Map<string, ChangeRequestVoteRow>();
  const duplicateVoteIds = new Set<string>();

  for (const vote of candidateVotes) {
    if (!latestVoteByUser.has(vote.user_id)) {
      latestVoteByUser.set(vote.user_id, vote);
      continue;
    }
    duplicateVoteIds.add(vote.id);
  }

  for (const vote of userVotes) {
    if (vote.id !== currentVote.id) {
      duplicateVoteIds.add(vote.id);
    }
  }

  for (const voteId of duplicateVoteIds) {
    await tx.mutate.change_request_vote.delete({ id: voteId });
  }

  const counts = countLatestChangeRequestVotes(latestVoteByUser.values());
  await tx.mutate.change_request.update({
    id: args.change_request_id,
    ...counts,
    updated_at: now,
  });

  return { changeRequest, counts };
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const amendmentSharedMutators = {
  create: defineMutator(createAmendmentSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    await tx.mutate.amendment.insert({
      ...args,
      origin_amendment_id: args.origin_amendment_id ?? args.clone_source_id ?? args.id,
      created_by_id: userID,
      subscriber_count: 0,
      clone_count: 0,
      change_request_count: 0,
      upvotes: 0,
      downvotes: 0,
      internal_cr_voting_close_trigger:
        args.internal_cr_voting_close_trigger ?? INTERNAL_CR_VOTING_DEFAULT_TRIGGER,
      internal_cr_voting_duration_minutes: args.internal_cr_voting_duration_minutes ?? null,
      internal_cr_resolution_visibility:
        args.internal_cr_resolution_visibility ?? INTERNAL_CR_RESOLUTION_DEFAULT_VISIBILITY,
      comment_count: 0,
      collaborator_count: 0,
      current_process_run_id: args.current_process_run_id ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  createFull: defineMutator(createAmendmentFullMutatorSchema, async ({ tx, ctx, args }) => {
    await amendmentSharedMutators.create.fn({ tx, ctx, args: args.amendment });
  }),

  update: defineMutator(updateAmendmentSchema, async ({ tx, args }) => {
    await tx.mutate.amendment.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  delete: defineMutator(deleteAmendmentSchema, async ({ tx, args }) => {
    await tx.mutate.amendment.delete({ id: args.id });
  }),

  addCollaborator: defineMutator(createAmendmentCollaboratorSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.amendment_collaborator.insert({
      ...args,
      created_at: now,
    });
  }),

  removeCollaborator: defineMutator(deleteAmendmentCollaboratorSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_collaborator.delete({ id: args.id });
  }),

  createStreetDesign: defineMutator(
    createAmendmentStreetDesignSchema,
    async ({ tx, ctx: { userID }, args }) => {
      const now = Date.now();
      const { process_branch_id: _processBranchId, ...streetDesign } = args;
      void _processBranchId;
      await tx.mutate.amendment_street_design.insert({
        ...streetDesign,
        title: args.title ?? null,
        bbox: args.bbox ?? null,
        center_lat: args.center_lat ?? null,
        center_lon: args.center_lon ?? null,
        osm_snapshot: args.osm_snapshot ?? null,
        design_state: args.design_state ?? null,
        cost_catalog_version: args.cost_catalog_version ?? null,
        cost_summary: args.cost_summary ?? null,
        created_by_id: userID,
        created_at: now,
        updated_at: now,
      });
    }
  ),

  updateStreetDesign: defineMutator(updateAmendmentStreetDesignSchema, async ({ tx, args }) => {
    const { process_branch_id: _processBranchId, ...streetDesign } = args;
    void _processBranchId;
    await tx.mutate.amendment_street_design.update({
      ...streetDesign,
      updated_at: Date.now(),
    });
  }),

  deleteStreetDesign: defineMutator(deleteAmendmentStreetDesignSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_street_design.delete({ id: args.id });
  }),

  createChangeRequest: defineMutator(
    createChangeRequestSchema,
    async ({ tx, ctx: { userID }, args }) => {
      const now = Date.now();
      const amendment = await tx.run(zql.amendment.where('id', args.amendment_id).one());
      if (!amendment) {
        throw new Error('Amendment not found');
      }

      const processBranch = await assertChangeRequestProcessBranch(
        tx,
        amendment,
        args.process_branch_id ?? null
      );
      const discussionId = args.discussion_id ?? null;
      const sourceType = args.source_type?.trim().toLowerCase() ?? '';
      const isStreetDesignChangeRequest =
        sourceType === 'street_design' ||
        sourceType === 'streetscape' ||
        sourceType.startsWith('street_design_') ||
        sourceType.startsWith('streetscape_');
      const targetDiscussions = normalizeDiscussions(
        processBranch ? processBranch.discussions : amendment.discussions
      );
      const targetDiscussion = discussionId
        ? targetDiscussions.find(discussion => discussion.id === discussionId)
        : null;
      if (!isStreetDesignChangeRequest && (!discussionId || !targetDiscussion)) {
        throw new Error(
          'Cannot create document change request: linked document suggestion not found.'
        );
      }
      const existingChangeRequestsResult = await tx.run(
        zql.change_request.where('amendment_id', args.amendment_id)
      );
      const existingChangeRequests = Array.isArray(existingChangeRequestsResult)
        ? existingChangeRequestsResult
        : [];
      const existingSuggestionChangeRequest = discussionId
        ? existingChangeRequests.find(
            changeRequest =>
              sameBranch(changeRequest, args.process_branch_id ?? null) &&
              changeRequest.suggestion_id === discussionId
          )
        : null;

      if (existingSuggestionChangeRequest) {
        const existingSequenceNumber = getScopedChangeRequestNumber(
          existingSuggestionChangeRequest
        );
        const existingCrId =
          formatChangeRequestCrId(existingSequenceNumber) ?? existingSuggestionChangeRequest.title;
        if (existingSequenceNumber > 0 && existingCrId) {
          const nextDiscussions = updateDiscussionForCreatedChangeRequest({
            discussions: targetDiscussions,
            discussionId,
            requestedCrId: args.title,
            changeRequestId: existingSuggestionChangeRequest.id,
            crId: existingCrId,
            branchSequenceNumber: existingSequenceNumber,
            status: existingSuggestionChangeRequest.status,
            votingStatus: existingSuggestionChangeRequest.voting_status,
            now,
          });
          if (nextDiscussions) {
            if (processBranch) {
              await tx.mutate.amendment_process_branch.update({
                id: processBranch.id,
                discussions: nextDiscussions,
                updated_at: now,
              });
            } else {
              await tx.mutate.amendment.update({
                id: amendment.id,
                discussions: nextDiscussions,
                updated_at: now,
              });
            }
          }
          return;
        }
      }

      const branchSequenceNumber = resolveNextChangeRequestBranchSequence({
        existingChangeRequests,
        processBranchId: args.process_branch_id ?? null,
        discussions: targetDiscussions,
        discussionId,
        requestedCrId: args.title,
      });
      const crId = formatChangeRequestCrId(branchSequenceNumber) ?? `CR-${branchSequenceNumber}`;
      const createdInMode = normalizeEditingMode(processBranch?.editing_mode ?? 'edit');
      const trigger = normalizeInternalCRVotingTrigger(amendment?.internal_cr_voting_close_trigger);
      const durationMinutes = normalizeInternalCRVotingDurationMinutes(
        amendment?.internal_cr_voting_duration_minutes
      );
      const votingDeadline =
        createdInMode === 'vote_internal' && trigger === 'after_minutes'
          ? now + durationMinutes * 60_000
          : (args.voting_deadline ?? null);
      const isResolved = isResolvedStatus(args.status);
      const changeRequestArgs = { ...args };
      delete (changeRequestArgs as { discussion_id?: unknown }).discussion_id;
      await tx.mutate.change_request.insert({
        ...changeRequestArgs,
        process_branch_id: args.process_branch_id ?? null,
        suggestion_id: discussionId,
        title: crId,
        branch_sequence_number: branchSequenceNumber,
        user_id: userID,
        changed_character_count: args.changed_character_count ?? 0,
        votes_for: 0,
        votes_against: 0,
        votes_abstain: 0,
        voting_deadline: votingDeadline,
        created_in_mode: createdInMode,
        resolved_in_mode: isResolved ? createdInMode : null,
        resolution_method: isResolved ? getDirectResolutionMethod(createdInMode) : null,
        visibility_scope: isResolved
          ? getChangeRequestResolvedVisibilityScope(
              createdInMode,
              amendment?.internal_cr_resolution_visibility
            )
          : getChangeRequestVisibilityScope(createdInMode),
        created_at: now,
        updated_at: now,
      });

      const nextDiscussions = updateDiscussionForCreatedChangeRequest({
        discussions: targetDiscussions,
        discussionId,
        requestedCrId: args.title,
        changeRequestId: args.id,
        crId,
        branchSequenceNumber,
        status: args.status,
        votingStatus: args.voting_status,
        now,
      });

      if (nextDiscussions) {
        if (processBranch) {
          await tx.mutate.amendment_process_branch.update({
            id: processBranch.id,
            discussions: nextDiscussions,
            updated_at: now,
          });
        } else {
          await tx.mutate.amendment.update({
            id: amendment.id,
            discussions: nextDiscussions,
            updated_at: now,
          });
        }
      }
    }
  ),

  createStreetDesignChangeRequests: defineMutator(
    createStreetDesignChangeRequestsSchema,
    async ({ tx, ctx, args }) => {
      for (const request of args.requests) {
        await amendmentSharedMutators.createChangeRequest.fn({ tx, ctx, args: request });
      }
    }
  ),

  voteOnChangeRequest: defineMutator(
    createChangeRequestVoteSchema,
    async ({ tx, ctx: { userID }, args }) => {
      await upsertChangeRequestVoteAndRecompute({
        tx,
        userID,
        args,
      });
    }
  ),

  finalizeInternalChangeRequestVote: defineMutator(
    finalizeInternalChangeRequestVoteSchema,
    async () => {
      return;
    }
  ),

  finalizeExpiredInternalChangeRequestVotes: defineMutator(
    finalizeExpiredInternalChangeRequestVotesSchema,
    async () => {
      return;
    }
  ),

  repairInternalChangeRequestResolution: defineMutator(
    repairInternalChangeRequestResolutionSchema,
    async () => {
      return;
    }
  ),

  supportAmendment: defineMutator(
    createAmendmentSupportVoteSchema,
    async ({ tx, ctx: { userID }, args }) => {
      const now = Date.now();
      await tx.mutate.amendment_support_vote.insert({
        ...args,
        user_id: userID,
        created_at: now,
      });
    }
  ),

  updateSupportVote: defineMutator(updateAmendmentSupportVoteSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_support_vote.update(args);
  }),

  deleteSupportVote: defineMutator(deleteAmendmentSupportVoteSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_support_vote.delete({ id: args.id });
  }),

  // Amendment Path mutators
  createPath: defineMutator(createAmendmentPathSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'create', 'amendment-process-path');
    const now = Date.now();
    await tx.mutate.amendment_path.insert({
      ...args,
      process_run_id: args.process_run_id ?? null,
      created_at: now,
    });
  }),

  deletePath: defineMutator(deleteAmendmentPathSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'delete', 'amendment-process-path');
    await tx.mutate.amendment_path.delete({ id: args.id });
  }),

  // Amendment Path Segment mutators
  createPathSegment: defineMutator(createAmendmentPathSegmentSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'create', 'amendment-path-segment');
    const now = Date.now();
    await tx.mutate.amendment_path_segment.insert({
      ...args,
      process_branch_id: args.process_branch_id ?? null,
      process_step_run_id: args.process_step_run_id ?? null,
      created_at: now,
    });
  }),

  deletePathSegment: defineMutator(deleteAmendmentPathSegmentSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'delete', 'amendment-path-segment');
    await tx.mutate.amendment_path_segment.delete({ id: args.id });
  }),

  // Support Confirmation mutators
  createSupportConfirmation: defineMutator(
    createSupportConfirmationSchema,
    async ({ tx, args }) => {
      denyPublicAmendmentProcessMutation(tx, 'create', 'support-confirmation');
      const now = Date.now();
      await tx.mutate.support_confirmation.insert({
        ...args,
        process_run_id: args.process_run_id ?? null,
        process_step_run_id: args.process_step_run_id ?? null,
        process_task_id: args.process_task_id ?? null,
        created_at: now,
      });
    }
  ),

  updateSupportConfirmation: defineMutator(
    updateSupportConfirmationSchema,
    async ({ tx, args }) => {
      denyPublicAmendmentProcessMutation(tx, 'update', 'support-confirmation');
      await tx.mutate.support_confirmation.update(args);
    }
  ),

  upsertGroupDecision: defineMutator(upsertAmendmentGroupDecisionSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'update', 'amendment-group-decision');
    const now = Date.now();
    const existing = await tx.run(
      zql.amendment_group_decision
        .where('amendment_id', args.amendment_id)
        .where('group_id', args.group_id)
        .one()
    );

    if (existing) {
      await tx.mutate.amendment_group_decision.update({
        id: existing.id,
        process_run_id: args.process_run_id ?? null,
        process_branch_id: args.process_branch_id ?? null,
        process_step_run_id: args.process_step_run_id ?? null,
        status: args.status,
        decided_at: args.decided_at ?? now,
        updated_at: now,
      });
      return;
    }

    const id = args.id ?? crypto.randomUUID();
    await tx.mutate.amendment_group_decision.insert({
      id,
      amendment_id: args.amendment_id,
      group_id: args.group_id,
      process_run_id: args.process_run_id ?? null,
      process_branch_id: args.process_branch_id ?? null,
      process_step_run_id: args.process_step_run_id ?? null,
      status: args.status,
      decided_at: args.decided_at ?? now,
      created_at: now,
      updated_at: now,
    });
  }),

  deleteGroupDecision: defineMutator(deleteAmendmentGroupDecisionSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'delete', 'amendment-group-decision');
    await tx.mutate.amendment_group_decision.delete({ id: args.id });
  }),

  // Workflow runtime mutators
  createProcessRun: defineMutator(createAmendmentProcessRunSchema, async ({ tx, ctx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'create', 'amendment-process-run');
    const now = Date.now();
    await tx.mutate.amendment_process_run.insert({
      ...args,
      root_workflow_id: args.root_workflow_id ?? null,
      selected_source_group_id: args.selected_source_group_id ?? null,
      selected_target_group_id: args.selected_target_group_id ?? null,
      selected_target_workflow_id: args.selected_target_workflow_id ?? null,
      active_branch_id: args.active_branch_id ?? null,
      terminal_step_run_id: args.terminal_step_run_id ?? null,
      evaluation_mode: args.evaluation_mode ?? null,
      evaluation_date: args.evaluation_date ?? null,
      evaluation_offset_months: args.evaluation_offset_months ?? null,
      evaluation_offset_years: args.evaluation_offset_years ?? null,
      implementation_status: args.implementation_status ?? null,
      created_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessRun: defineMutator(updateAmendmentProcessRunSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'update', 'amendment-process-run');
    await tx.mutate.amendment_process_run.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessRun: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'delete', 'amendment-process-run');
    await tx.mutate.amendment_process_run.delete({ id: args.id });
  }),

  createProcessBranch: defineMutator(createAmendmentProcessBranchSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'create', 'amendment-process-branch');
    const now = Date.now();
    const sourceDocument =
      !args.editing_mode && args.document_id
        ? await tx.run(zql.document.where('id', args.document_id).one())
        : null;
    await tx.mutate.amendment_process_branch.insert({
      ...args,
      parent_branch_id: args.parent_branch_id ?? null,
      merged_into_branch_id: args.merged_into_branch_id ?? null,
      source_step_run_id: args.source_step_run_id ?? null,
      document_version_id: args.document_version_id ?? null,
      document_id: args.document_id ?? null,
      discussions: args.discussions ?? [],
      title: args.title ?? null,
      resolution: args.resolution ?? null,
      editing_mode: args.editing_mode ?? normalizeEditingMode(sourceDocument?.editing_mode),
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessBranch: defineMutator(updateAmendmentProcessBranchSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'update', 'amendment-process-branch');
    await tx.mutate.amendment_process_branch.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessBranch: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'delete', 'amendment-process-branch');
    await tx.mutate.amendment_process_branch.delete({ id: args.id });
  }),

  createProcessStepRun: defineMutator(createAmendmentProcessStepRunSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'create', 'amendment-process-step-run');
    const now = Date.now();
    await tx.mutate.amendment_process_step_run.insert({
      ...args,
      workflow_id: args.workflow_id ?? null,
      workflow_step_id: args.workflow_step_id ?? null,
      selection_mode: args.selection_mode ?? null,
      merge_strategy: args.merge_strategy ?? null,
      source_group_id: args.source_group_id ?? null,
      target_group_id: args.target_group_id ?? null,
      event_id: args.event_id ?? null,
      agenda_item_id: args.agenda_item_id ?? null,
      vote_id: args.vote_id ?? null,
      support_confirmation_id: args.support_confirmation_id ?? null,
      decision_status: args.decision_status ?? null,
      starts_at: args.starts_at ?? null,
      ends_at: args.ends_at ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessStepRun: defineMutator(updateAmendmentProcessStepRunSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'update', 'amendment-process-step-run');
    await tx.mutate.amendment_process_step_run.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessStepRun: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'delete', 'amendment-process-step-run');
    await tx.mutate.amendment_process_step_run.delete({ id: args.id });
  }),

  createProcessTask: defineMutator(createProcessTaskSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'create', 'process-task');
    const now = Date.now();
    await tx.mutate.process_task.insert({
      ...args,
      branch_id: args.branch_id ?? null,
      step_run_id: args.step_run_id ?? null,
      title: args.title ?? null,
      description: args.description ?? null,
      group_id: args.group_id ?? null,
      target_group_id: args.target_group_id ?? null,
      event_id: args.event_id ?? null,
      agenda_item_id: args.agenda_item_id ?? null,
      support_confirmation_id: args.support_confirmation_id ?? null,
      due_at: args.due_at ?? null,
      resolved_at: args.resolved_at ?? null,
      metadata: args.metadata ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessTask: defineMutator(updateProcessTaskSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'update', 'process-task');
    await tx.mutate.process_task.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessTask: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    denyPublicAmendmentProcessMutation(tx, 'delete', 'process-task');
    await tx.mutate.process_task.delete({ id: args.id });
  }),

  initializeProcessPath: defineMutator(initializeAmendmentProcessPathSchema, async () => {
    return;
  }),

  resolveProcessVote: defineMutator(resolveAmendmentProcessVoteSchema, async () => {
    return;
  }),

  completeProcessTaskWithEvent: defineMutator(completeProcessTaskWithEventSchema, async () => {
    return;
  }),

  replanProcessBranchEvents: defineMutator(replanProcessBranchEventsSchema, async () => {
    return;
  }),

  // Amendment Collaborator update
  updateCollaborator: defineMutator(updateAmendmentCollaboratorSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_collaborator.update(args);
  }),

  // Change Request update
  updateChangeRequest: defineMutator(updateChangeRequestSchema, async ({ tx, args }) => {
    await tx.mutate.change_request.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteChangeRequest: defineMutator(deleteChangeRequestSchema, async ({ tx, args }) => {
    await tx.mutate.change_request.delete({ id: args.id });
  }),
};

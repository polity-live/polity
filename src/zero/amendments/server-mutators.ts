import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import {
  amendmentTitle,
  eventTitle,
  groupName,
  recomputeAmendmentCounters,
  recomputeEventCounters,
  recomputeGroupCounters,
  recomputeUserCounters,
  userName,
} from '../server-helpers';
import { DEFAULT_AMENDMENT_ROLES } from '../rbac/constants';
import {
  updateAmendmentSchema,
  createAmendmentCollaboratorSchema,
  deleteAmendmentCollaboratorSchema,
  updateAmendmentCollaboratorSchema,
  createAmendmentStreetDesignSchema,
  updateAmendmentStreetDesignSchema,
  deleteAmendmentStreetDesignSchema,
  createAmendmentSchema,
  deleteAmendmentSchema,
  createSupportConfirmationSchema,
  updateSupportConfirmationSchema,
  initializeAmendmentProcessPathSchema,
  resolveAmendmentProcessVoteSchema,
  completeProcessTaskWithEventSchema,
  replanProcessBranchEventsSchema,
  createProcessTaskSchema,
  updateAmendmentProcessBranchSchema,
} from './schema';
import {
  createChangeRequestSchema,
  deleteChangeRequestSchema,
  finalizeExpiredInternalChangeRequestVotesSchema,
  finalizeInternalChangeRequestVoteSchema,
  repairInternalChangeRequestResolutionSchema,
  updateChangeRequestSchema,
} from '../change-requests/schema';
import {
  createAmendmentSupportVoteSchema,
  updateAmendmentSupportVoteSchema,
  deleteAmendmentSupportVoteSchema,
  createChangeRequestVoteSchema,
} from '../votes/schema';
import {
  completeProcessTaskWithEvent,
  initializeAmendmentProcessPath,
  replanProcessBranchEvents,
  resolveAmendmentProcessVote,
} from './process-engine';
import { notifyProcessVoteResolution } from './process-notifications';
import { can } from '../rbac/can';
import { assertCanViewAmendment } from '../rbac/amendment-access';
import { canReadVisibility, requireAuthenticated, requireOwner } from '../rbac/authorize';
import { PermissionError } from '../rbac/errors';
import {
  canManuallySelectEditingMode,
  isAgendaItemStarted,
  normalizeEditingMode,
} from './editing-mode-policy';
import {
  finalizeExpiredInternalChangeRequestVotesForAmendment,
  finalizeInternalChangeRequestsForEventPhaseTransition,
  initializeInternalChangeRequestVotingForAmendment,
  maybeFinalizeInternalChangeRequestVote,
  repairInternalChangeRequestResolution,
  resolveInternalChangeRequestVote,
} from '../change-requests/internal-voting';
import { getResolvedChangeRequestVisibilityScope } from '../change-requests/visibility';
import { assertAmendmentTargetEventOpen } from '@/features/amendments/logic/amendmentTargetEventEligibility';
import {
  VOTE_PURPOSE,
  VOTE_PHASE,
  isFinalVotePhase,
  normalizeVotePhase,
} from '../votes/vote-workflow';
import { AGENDA_VOTE_STEP_KIND } from '../agendas/vote-step-kind';

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
const PENDING_SUBMISSION_STATUS = 'pending_submission';
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = new Set(['collaborator', 'member', 'admin']);
const ACTIVE_GROUP_MEMBERSHIP_STATUSES = ['active', 'member', 'admin'];
const TERMINAL_PROCESS_STEP_STATUSES = new Set([
  'approved',
  'rejected',
  'merged',
  'withdrawn',
  'completed',
]);

type AmendmentServerTx = Parameters<typeof mutators.amendments.create.fn>[0]['tx'];
type AmendmentServerCtx = Parameters<typeof mutators.amendments.create.fn>[0]['ctx'];
function getProcessTaskNotificationTitle(
  taskType: string | null | undefined,
  title?: string | null
) {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  switch (taskType) {
    case 'implementation_evaluation':
      return 'Umsetzung evaluieren';
    case 'support_confirmation':
      return 'Unterstützung bestätigen';
    default:
      return 'Event planen';
  }
}

async function loadAmendmentForMutation(tx: AmendmentServerTx, amendmentId: string) {
  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment) {
    throw new Error('Amendment not found');
  }
  return amendment;
}

async function loadProcessBranchForMutation(tx: AmendmentServerTx, branchId: string) {
  const branch = await tx.run(zql.amendment_process_branch.where('id', branchId).one());
  if (!branch) {
    throw new Error('Process branch not found');
  }
  return branch;
}

async function loadProcessRunForBranch(
  tx: AmendmentServerTx,
  branch: Awaited<ReturnType<typeof loadProcessBranchForMutation>>
) {
  const processRun = await tx.run(
    zql.amendment_process_run.where('id', branch.process_run_id).one()
  );
  if (!processRun) {
    throw new Error('Process run not found');
  }
  return processRun;
}

function getBranchMutationEditingMode(branch: { editing_mode?: string | null }) {
  return normalizeEditingMode(branch.editing_mode);
}

async function assertCanCreateAmendment(tx: AmendmentServerTx, ctx: AmendmentServerCtx) {
  requireAuthenticated(tx, ctx, { action: 'create', resource: 'amendments' });
}

async function assertCanUseAmendmentPathSourceGroup(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  sourceGroupId: string | null | undefined
) {
  requireAuthenticated(tx, ctx, { action: 'create', resource: 'amendments' });

  if (!sourceGroupId) {
    throw new PermissionError('create', 'amendments', 'source-group required');
  }

  const ownedGroup = await tx.run(
    zql.group.where('id', sourceGroupId).where('owner_id', ctx.userID).one()
  );
  if (ownedGroup) {
    return;
  }

  const activeMemberships = await tx.run(
    zql.group_membership
      .where('group_id', sourceGroupId)
      .where('user_id', ctx.userID)
      .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
      .related('membership_roles')
  );

  const hasAnyRole = activeMemberships.some(membership =>
    (membership.membership_roles ?? []).some(roleLink => Boolean(roleLink.role_id))
  );

  if (!hasAnyRole) {
    throw new PermissionError('create', 'amendments', `group:${sourceGroupId}`);
  }
}

async function assertCanMutateAmendment(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  amendmentId: string,
  action: 'update' | 'delete' | 'manage' = 'update'
) {
  await can(tx, ctx, { action, resource: 'amendments', amendmentId });
}

async function assertCanReplanProcessBranchEvents(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  branchId: string
) {
  requireAuthenticated(tx, ctx, { action: 'manage', resource: 'amendments' });

  const branch = await tx.run(zql.amendment_process_branch.where('id', branchId).one());
  if (!branch) {
    throw new Error('Process branch not found');
  }

  const processRun = await tx.run(
    zql.amendment_process_run.where('id', branch.process_run_id).one()
  );
  if (!processRun) {
    throw new Error('Process run not found');
  }

  await assertCanMutateAmendment(tx, ctx, processRun.amendment_id, 'manage');
}

async function loadFirstProcessBranchAgendaItemState(
  tx: AmendmentServerTx,
  branch: Awaited<ReturnType<typeof loadProcessBranchForMutation>>
) {
  const steps = await tx.run(
    zql.amendment_process_step_run.where('branch_id', branch.id).orderBy('order_index', 'asc')
  );
  const firstEventStep = steps.find(step => Boolean(step.event_id));
  const firstEventAgendaItems = firstEventStep?.event_id
    ? await tx.run(
        zql.agenda_item.where('event_id', firstEventStep.event_id).orderBy('order_index', 'asc')
      )
    : [];
  const linkedAgendaItem = firstEventStep?.agenda_item_id
    ? await tx.run(zql.agenda_item.where('id', firstEventStep.agenda_item_id).one())
    : null;
  const firstAgendaItem = linkedAgendaItem ?? firstEventAgendaItems[0] ?? null;

  return {
    hasProcess: true,
    firstAgendaItemStarted: firstAgendaItem ? isAgendaItemStarted(firstAgendaItem) : false,
  };
}

async function assertManualBranchEditingModeChangeAllowed(
  tx: AmendmentServerTx,
  branch: Awaited<ReturnType<typeof loadProcessBranchForMutation>>,
  targetMode: string | null | undefined
) {
  const normalizedTarget = normalizeEditingMode(targetMode);
  const currentMode = getBranchMutationEditingMode(branch);
  const processState = await loadFirstProcessBranchAgendaItemState(tx, branch);

  if (
    !canManuallySelectEditingMode(normalizedTarget, {
      ...processState,
      currentMode,
      eventSuggestionOpen: currentMode === 'suggest_event',
      eventVotingOpen: currentMode === 'event_final_closing_vote',
    })
  ) {
    throw new PermissionError('update', 'amendments', `branch_editing_mode:${normalizedTarget}`);
  }
}

async function findCurrentProcessEventId(
  tx: AmendmentServerTx,
  amendment: Awaited<ReturnType<typeof loadAmendmentForMutation>>,
  processBranchId?: string | null
) {
  if (processBranchId) {
    const branchSteps = await tx.run(
      zql.amendment_process_step_run
        .where('branch_id', processBranchId)
        .orderBy('order_index', 'asc')
    );
    const activeBranchEventStep =
      branchSteps.find(
        step => step.event_id && !TERMINAL_PROCESS_STEP_STATUSES.has(step.status ?? '')
      ) ?? branchSteps.find(step => Boolean(step.event_id));

    return activeBranchEventStep?.event_id ?? amendment.event_id ?? null;
  }

  if (!amendment.current_process_run_id) {
    return amendment.event_id ?? null;
  }

  const steps = await tx.run(
    zql.amendment_process_step_run
      .where('process_run_id', amendment.current_process_run_id)
      .orderBy('order_index', 'asc')
  );
  const activeEventStep =
    steps.find(step => step.event_id && !TERMINAL_PROCESS_STEP_STATUSES.has(step.status ?? '')) ??
    steps.find(step => Boolean(step.event_id));

  return activeEventStep?.event_id ?? amendment.event_id ?? null;
}

async function assertCanCreateChangeRequest(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  amendmentId: string,
  processBranchId?: string | null
) {
  const amendment = await loadAmendmentForMutation(tx, amendmentId);
  const branch = processBranchId ? await loadProcessBranchForMutation(tx, processBranchId) : null;
  const mode = getBranchMutationEditingMode(branch ?? { editing_mode: 'edit' });

  if (
    mode === 'view' ||
    mode === 'event_final_closing_vote' ||
    mode === 'passed' ||
    mode === 'rejected'
  ) {
    throw new PermissionError('create', 'changeRequests', `editing_mode:${mode}`);
  }

  if (mode !== 'suggest_event') {
    await assertCanMutateAmendment(tx, ctx, amendmentId, 'update');
    return amendment;
  }

  const eventId = await findCurrentProcessEventId(tx, amendment, branch?.id ?? processBranchId);
  if (!eventId) {
    throw new PermissionError('active_voting', 'events', `amendment:${amendmentId}`);
  }

  await can(tx, ctx, {
    action: 'active_voting',
    resource: 'events',
    eventId,
  });
  return amendment;
}

async function assertCanResolveProcessVote(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  agendaItemId: string
) {
  const agendaItem = await tx.run(zql.agenda_item.where('id', agendaItemId).one());
  if (!agendaItem) {
    throw new Error('Agenda item not found');
  }

  if (agendaItem.event_id) {
    await can(tx, ctx, {
      action: 'manage_votes',
      resource: 'events',
      eventId: agendaItem.event_id,
    });
    return;
  }

  if (agendaItem.amendment_id) {
    await assertCanMutateAmendment(tx, ctx, agendaItem.amendment_id, 'manage');
    return;
  }

  throw new PermissionError('manage', 'amendments', `agenda-item:${agendaItemId}`);
}

async function assertCanCompleteProcessTaskWithEvent(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  processTaskId: string,
  targetEventId: string
) {
  const task = await tx.run(zql.process_task.where('id', processTaskId).one());
  if (!task) {
    throw new Error('Process task not found');
  }

  const processRun = await tx.run(zql.amendment_process_run.where('id', task.process_run_id).one());
  if (!processRun?.amendment_id) {
    throw new Error('Amendment process run not found');
  }

  await assertCanMutateAmendment(tx, ctx, processRun.amendment_id, 'manage');

  if (task.event_id && task.event_id !== targetEventId) {
    await can(tx, ctx, {
      action: 'manage_votes',
      resource: 'events',
      eventId: task.event_id,
    });
  }

  await can(tx, ctx, {
    action: 'manage_votes',
    resource: 'events',
    eventId: targetEventId,
  });

  await assertAmendmentTargetEventIdOpen(tx, targetEventId);
}

async function assertAmendmentTargetEventIdOpen(tx: AmendmentServerTx, eventId: string) {
  const event = await tx.run(zql.event.where('id', eventId).one());
  if (!event) {
    throw new Error('Event not found');
  }

  assertAmendmentTargetEventOpen(event);
}

async function assertCanViewOrRequestCollaboration(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  amendmentId: string
) {
  requireAuthenticated(tx, ctx, { action: 'view', resource: 'amendments' });

  const amendment = await loadAmendmentForMutation(tx, amendmentId);
  if (canReadVisibility(amendment.visibility, ctx, amendment.created_by_id === ctx.userID)) {
    return;
  }

  await can(tx, ctx, { action: 'view', resource: 'amendments', amendmentId });
}

async function loadCollaboratorForMutation(tx: AmendmentServerTx, collaboratorId: string) {
  const collaborator = await tx.run(zql.amendment_collaborator.where('id', collaboratorId).one());
  if (!collaborator) {
    throw new Error('Amendment collaborator not found');
  }
  return collaborator;
}

async function loadStreetDesignForMutation(tx: AmendmentServerTx, streetDesignId: string) {
  const streetDesign = await tx.run(zql.amendment_street_design.where('id', streetDesignId).one());
  if (!streetDesign) {
    throw new Error('Amendment street design not found');
  }
  return streetDesign;
}

async function loadChangeRequestForMutation(tx: AmendmentServerTx, changeRequestId: string) {
  const changeRequest = await tx.run(zql.change_request.where('id', changeRequestId).one());
  if (!changeRequest) {
    throw new Error('Change request not found');
  }
  return changeRequest;
}

function isFinalChangeRequestStatus(status: string | null | undefined) {
  return (
    status === 'accepted' || status === 'approved' || status === 'rejected' || status === 'declined'
  );
}

async function assertCanVoteOnChangeRequest(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  changeRequestId: string
) {
  requireAuthenticated(tx, ctx, { action: 'vote', resource: 'amendments' });
  const changeRequest = await loadChangeRequestForMutation(tx, changeRequestId);
  const branch = changeRequest.process_branch_id
    ? await loadProcessBranchForMutation(tx, changeRequest.process_branch_id)
    : null;
  if (getBranchMutationEditingMode(branch ?? { editing_mode: 'edit' }) !== 'vote_internal') {
    throw new PermissionError('vote', 'amendments', 'editing_mode:vote_internal');
  }
  await can(tx, ctx, {
    action: 'vote',
    resource: 'amendments',
    amendmentId: changeRequest.amendment_id,
  });
  return changeRequest;
}

function changeRequestUpdateNeedsManage(
  args: Partial<{
    status: string | null;
    voting_status: string;
    votes_for: number;
    votes_against: number;
    votes_abstain: number;
  }>
) {
  return (
    args.status !== undefined ||
    args.voting_status !== undefined ||
    args.votes_for !== undefined ||
    args.votes_against !== undefined ||
    args.votes_abstain !== undefined
  );
}

function changeRequestUpdateTouchesVoteCounts(
  args: Partial<{
    votes_for: number;
    votes_against: number;
    votes_abstain: number;
  }>
) {
  return (
    args.votes_for !== undefined ||
    args.votes_against !== undefined ||
    args.votes_abstain !== undefined
  );
}

async function appendEventChangeRequestVoteStepIfNeeded({
  tx,
  amendment,
  changeRequest,
  now,
}: {
  tx: AmendmentServerTx;
  amendment: Awaited<ReturnType<typeof loadAmendmentForMutation>>;
  changeRequest: {
    id: string;
    title?: string | null;
    status?: string | null;
    process_branch_id?: string | null;
  };
  now: number;
}): Promise<string | null> {
  const processBranchId = changeRequest.process_branch_id ?? null;
  const branch = processBranchId ? await loadProcessBranchForMutation(tx, processBranchId) : null;
  if (getBranchMutationEditingMode(branch ?? { editing_mode: 'edit' }) !== 'suggest_event') {
    return null;
  }
  if (isFinalChangeRequestStatus(changeRequest.status)) {
    return null;
  }

  const agendaItems = await tx.run(
    zql.agenda_item.where('amendment_id', amendment.id).orderBy('order_index', 'asc')
  );
  const agendaItemRows = Array.isArray(agendaItems) ? agendaItems : [];
  if (agendaItemRows.length === 0) {
    return null;
  }
  const agendaItemById = new Map(agendaItemRows.map(item => [item.id, item]));
  const agendaItemIds = agendaItemRows.map(item => item.id);

  const existingLinks = await tx.run(
    zql.agenda_item_change_request
      .where('agenda_item_id', 'IN', agendaItemIds)
      .orderBy('order_index', 'asc')
  );
  if (existingLinks.some(link => link.change_request_id === changeRequest.id)) {
    return null;
  }

  const finalLinkCandidates = existingLinks.filter(
    link =>
      (link.is_closing_vote || link.step_kind === AGENDA_VOTE_STEP_KIND.closing) &&
      (link.process_branch_id ?? null) === processBranchId &&
      Boolean(link.vote_id)
  );

  let target: {
    agendaItem: (typeof agendaItemRows)[number];
    finalLink: (typeof existingLinks)[number] | null;
    finalVoteId: string;
    linksForAgendaItem: typeof existingLinks;
  } | null = null;

  const canAppendBeforeFinalVote = (vote: { purpose?: string | null; status?: string | null }) =>
    vote.purpose === VOTE_PURPOSE.closing &&
    !isFinalVotePhase(vote.status) &&
    normalizeVotePhase(vote.status) !== VOTE_PHASE.closed;

  for (const finalLink of finalLinkCandidates) {
    const agendaItem = agendaItemById.get(finalLink.agenda_item_id);
    if (!agendaItem || !finalLink.vote_id) {
      continue;
    }

    const finalVote = await tx.run(zql.vote.where('id', finalLink.vote_id).one());
    if (!finalVote || !canAppendBeforeFinalVote(finalVote)) {
      continue;
    }

    target = {
      agendaItem,
      finalLink,
      finalVoteId: finalLink.vote_id,
      linksForAgendaItem: existingLinks.filter(link => link.agenda_item_id === agendaItem.id),
    };
    break;
  }

  if (!target) {
    const votes = await tx.run(
      zql.vote.where('agenda_item_id', 'IN', agendaItemIds).where('amendment_id', amendment.id)
    );
    const voteRows = Array.isArray(votes) ? votes : [];
    const agendaItemOrder = new Map(agendaItemRows.map((item, index) => [item.id, index]));
    const existingBranchLinks = new Set(
      existingLinks
        .filter(link => (link.process_branch_id ?? null) === processBranchId)
        .map(link => link.agenda_item_id)
    );
    const finalVoteCandidates = voteRows
      .map(vote => {
        const agendaItemId = vote.agenda_item_id;
        if (!agendaItemId || !agendaItemById.has(agendaItemId) || !canAppendBeforeFinalVote(vote)) {
          return null;
        }

        return { vote, agendaItemId };
      })
      .filter((candidate): candidate is { vote: (typeof voteRows)[number]; agendaItemId: string } =>
        Boolean(candidate)
      )
      .sort((left, right) => {
        const leftHasBranchLinks = existingBranchLinks.has(left.agendaItemId) ? 0 : 1;
        const rightHasBranchLinks = existingBranchLinks.has(right.agendaItemId) ? 0 : 1;
        if (leftHasBranchLinks !== rightHasBranchLinks) {
          return leftHasBranchLinks - rightHasBranchLinks;
        }

        return (
          (agendaItemOrder.get(left.agendaItemId) ?? Number.MAX_SAFE_INTEGER) -
          (agendaItemOrder.get(right.agendaItemId) ?? Number.MAX_SAFE_INTEGER)
        );
      });
    const finalVoteCandidate = finalVoteCandidates[0];
    const agendaItem = finalVoteCandidate
      ? agendaItemById.get(finalVoteCandidate.agendaItemId)
      : null;

    if (finalVoteCandidate && agendaItem) {
      target = {
        agendaItem,
        finalLink: null,
        finalVoteId: finalVoteCandidate.vote.id,
        linksForAgendaItem: existingLinks.filter(link => link.agenda_item_id === agendaItem.id),
      };
    }
  }

  if (!target) {
    return null;
  }

  const accreditations = target.agendaItem.event_id
    ? await tx.run(zql.accreditation.where('event_id', target.agendaItem.event_id))
    : [];
  const voteId = crypto.randomUUID();
  await tx.mutate.vote.insert({
    id: voteId,
    agenda_item_id: target.agendaItem.id,
    amendment_id: amendment.id,
    title: changeRequest.title ?? `Change Request ${target.linksForAgendaItem.length + 1}`,
    description: null,
    status: VOTE_PHASE.indicative,
    purpose: VOTE_PURPOSE.changeRequest,
    majority_type: 'relative',
    closing_type: 'moderator',
    closing_duration_seconds: null,
    closing_end_time: null,
    visibility: 'public',
    ballot_visibility: 'named',
    created_at: now,
    updated_at: now,
  });

  const choiceLabels = ['yes', 'no', 'abstain'] as const;
  for (let index = 0; index < choiceLabels.length; index += 1) {
    const label = choiceLabels[index];
    await tx.mutate.vote_choice.insert({
      id: crypto.randomUUID(),
      vote_id: voteId,
      label,
      semantic_key: label,
      process_branch_id: null,
      order_index: index,
      created_at: now,
    });
  }

  for (const accreditation of accreditations) {
    await tx.mutate.voter.insert({
      id: crypto.randomUUID(),
      vote_id: voteId,
      user_id: accreditation.user_id,
      created_at: now,
    });
  }

  const nextOrderIndex =
    target.linksForAgendaItem.reduce(
      (max, link, index) => Math.max(max, link.order_index ?? index),
      -1
    ) + 1;
  const insertOrderIndex = target.finalLink?.order_index ?? nextOrderIndex;
  for (const link of target.linksForAgendaItem.filter(
    link => (link.order_index ?? 0) >= insertOrderIndex
  )) {
    await tx.mutate.agenda_item_change_request.update({
      id: link.id,
      order_index: (link.order_index ?? insertOrderIndex) + 1,
      updated_at: now,
    });
  }

  await tx.mutate.agenda_item_change_request.insert({
    id: crypto.randomUUID(),
    agenda_item_id: target.agendaItem.id,
    change_request_id: changeRequest.id,
    vote_id: voteId,
    order_index: insertOrderIndex,
    step_kind: AGENDA_VOTE_STEP_KIND.changeRequest,
    process_branch_id: changeRequest.process_branch_id ?? null,
    is_closing_vote: false,
    status: 'pending',
    blocked_reason: null,
    result_status: null,
    obsolete_reason: null,
    created_at: now,
    updated_at: now,
  });

  if (!target.finalLink) {
    await tx.mutate.agenda_item_change_request.insert({
      id: crypto.randomUUID(),
      agenda_item_id: target.agendaItem.id,
      change_request_id: null,
      vote_id: target.finalVoteId,
      order_index: insertOrderIndex + 1,
      step_kind: AGENDA_VOTE_STEP_KIND.closing,
      process_branch_id: processBranchId,
      is_closing_vote: true,
      status: 'pending',
      blocked_reason: null,
      result_status: null,
      obsolete_reason: null,
      created_at: now,
      updated_at: now,
    });
  }

  return target.agendaItem.event_id ?? null;
}

function getChangeRequestResolutionMetadata(
  mode: string | null | undefined,
  amendment?: { internal_cr_resolution_visibility?: string | null } | null
) {
  const normalizedMode = normalizeEditingMode(mode);
  const visibility_scope = getResolvedChangeRequestVisibilityScope({
    resolvedInMode: normalizedMode,
    internalResolutionVisibility: amendment?.internal_cr_resolution_visibility,
  });

  if (
    normalizedMode === 'edit' ||
    normalizedMode === 'suggest_internal' ||
    normalizedMode === 'view'
  ) {
    return {
      resolved_in_mode: normalizedMode,
      resolution_method: 'direct_internal',
      visibility_scope,
    };
  }

  return {
    resolved_in_mode: normalizedMode,
    resolution_method: null,
    visibility_scope,
  };
}

async function loadSupportVoteForMutation(tx: AmendmentServerTx, voteId: string) {
  const vote = await tx.run(zql.amendment_support_vote.where('id', voteId).one());
  if (!vote) {
    throw new Error('Amendment support vote not found');
  }
  return vote;
}

async function amendmentRoleWithRights(
  tx: Parameters<typeof mutators.amendments.create.fn>[0]['tx'],
  roleId: string | null | undefined
) {
  if (!roleId) return null;
  return tx.run(zql.role.where('id', roleId).related('action_rights').one());
}

function isAmendmentOwnerLikeRole(
  role:
    | {
        name?: string | null;
        action_rights?: readonly { resource?: string | null; action?: string | null }[] | null;
      }
    | null
    | undefined
) {
  if (!role) return false;
  if (role.name === 'Author' || role.name === 'Owner') return true;
  return (role.action_rights ?? []).some(
    right =>
      (right.resource === 'amendments' && right.action === 'manage') ||
      (right.resource === 'notifications' && right.action === 'manageNotifications')
  );
}

async function notifyAmendmentCollaboratorRoleChange(
  tx: Parameters<typeof mutators.amendments.create.fn>[0]['tx'],
  actorUserId: string,
  collaborator: {
    amendment_id: string;
    user_id: string;
    status?: string | null;
  },
  previousRoleId: string | null | undefined,
  nextRoleId: string | null | undefined,
  nextStatus: string | null | undefined
) {
  if (!ACTIVE_AMENDMENT_COLLABORATOR_STATUSES.has(nextStatus ?? '')) return;
  if ((previousRoleId ?? null) === (nextRoleId ?? null)) return;

  const [previousRole, nextRole, aTitle] = await Promise.all([
    amendmentRoleWithRights(tx, previousRoleId),
    amendmentRoleWithRights(tx, nextRoleId),
    amendmentTitle(tx, collaborator.amendment_id),
  ]);

  const wasOwner = isAmendmentOwnerLikeRole(previousRole);
  const isOwner = isAmendmentOwnerLikeRole(nextRole);

  if (!wasOwner && isOwner) {
    fireNotification('notifyAmendmentOwnerPromoted', {
      senderId: actorUserId,
      recipientUserId: collaborator.user_id,
      amendmentId: collaborator.amendment_id,
      amendmentTitle: aTitle,
    });
    return;
  }

  if (wasOwner && !isOwner) {
    fireNotification('notifyAmendmentOwnerDemoted', {
      senderId: actorUserId,
      recipientUserId: collaborator.user_id,
      amendmentId: collaborator.amendment_id,
      amendmentTitle: aTitle,
    });
    return;
  }

  fireNotification('notifyCollaborationRoleChanged', {
    senderId: actorUserId,
    recipientUserId: collaborator.user_id,
    amendmentId: collaborator.amendment_id,
    amendmentTitle: aTitle,
    newRole: nextRole?.name ?? 'Collaborator',
  });
}

export const amendmentServerMutators = {
  create: defineMutator(createAmendmentSchema, async ({ tx, ctx, args }) => {
    await assertCanCreateAmendment(tx, ctx);

    if (args.event_id) {
      await assertAmendmentTargetEventIdOpen(tx, args.event_id);
    }

    const sourceAmendment = args.clone_source_id
      ? await tx.run(zql.amendment.where('id', args.clone_source_id).one())
      : null;
    const createArgs = {
      ...args,
      origin_amendment_id:
        args.origin_amendment_id ??
        sourceAmendment?.origin_amendment_id ??
        args.clone_source_id ??
        args.id,
    };

    await mutators.amendments.create.fn({ tx, ctx, args: createArgs });

    const now = Date.now();
    let authorRoleId: string | null = null;
    const totalRoles = DEFAULT_AMENDMENT_ROLES.length;

    for (let index = 0; index < totalRoles; index++) {
      const roleDef = DEFAULT_AMENDMENT_ROLES[index];
      const roleId = crypto.randomUUID();

      if (roleDef.name === 'Author') {
        authorRoleId = roleId;
      }

      await tx.mutate.role.insert({
        id: roleId,
        name: roleDef.name,
        description: roleDef.description,
        scope: 'amendment',
        group_id: null,
        event_id: null,
        amendment_id: args.id,
        blog_id: null,
        assignee_kind: 'member',
        assignment_mode: 'assigned',
        visibility: 'public',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_rule: null,
        recurrence_interval: null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        default_request_role: false,
        default_invite_role: false,
        sort_order: totalRoles - 1 - index,
        created_at: now,
      });

      for (const permission of roleDef.permissions) {
        await tx.mutate.action_right.insert({
          id: crypto.randomUUID(),
          resource: permission.resource,
          action: permission.action,
          role_id: roleId,
          group_id: null,
          event_id: null,
          amendment_id: args.id,
          blog_id: null,
          created_at: now,
        });
      }
    }

    if (!authorRoleId) {
      const existingAuthorRole = await tx.run(
        zql.role
          .where('amendment_id', args.id)
          .where('scope', 'amendment')
          .where('name', 'Author')
          .one()
      );
      authorRoleId = existingAuthorRole?.id ?? null;
    }

    const existingCreatorCollaborator = await tx.run(
      zql.amendment_collaborator.where('amendment_id', args.id).where('user_id', ctx.userID).one()
    );

    if (existingCreatorCollaborator) {
      await tx.mutate.amendment_collaborator.update({
        id: existingCreatorCollaborator.id,
        role_id: authorRoleId,
        status: 'admin',
        visibility: args.visibility,
      });
    } else {
      await tx.mutate.amendment_collaborator.insert({
        id: crypto.randomUUID(),
        amendment_id: args.id,
        user_id: ctx.userID,
        role_id: authorRoleId,
        status: 'admin',
        visibility: args.visibility,
        created_at: now,
      });
    }

    await recomputeAmendmentCounters(tx, args.id);

    await recomputeUserCounters(tx, ctx.userID);

    if (args.group_id) {
      await recomputeGroupCounters(tx, args.group_id);
    }

    if (args.event_id) {
      await recomputeEventCounters(tx, args.event_id);
    }
  }),

  update: defineMutator(updateAmendmentSchema, async ({ tx, ctx, args }) => {
    await assertCanMutateAmendment(tx, ctx, args.id, 'update');
    const previousAmendment = await tx.run(zql.amendment.where('id', args.id).one());

    if (
      previousAmendment &&
      args.event_id !== undefined &&
      args.event_id &&
      args.event_id !== previousAmendment.event_id
    ) {
      await assertAmendmentTargetEventIdOpen(tx, args.event_id);
    }

    const internalVotingSettingsChanged =
      args.internal_cr_voting_close_trigger !== undefined ||
      args.internal_cr_voting_duration_minutes !== undefined;
    const now = Date.now();

    await mutators.amendments.update.fn({ tx, ctx, args });

    if (!previousAmendment) {
      return;
    }

    if (internalVotingSettingsChanged && previousAmendment.current_process_run_id) {
      const voteInternalBranches = await tx.run(
        zql.amendment_process_branch
          .where('process_run_id', previousAmendment.current_process_run_id)
          .where('editing_mode', 'vote_internal')
      );

      for (const branch of voteInternalBranches) {
        await initializeInternalChangeRequestVotingForAmendment({
          tx,
          amendment: {
            ...previousAmendment,
            ...args,
            id: previousAmendment.id,
          },
          processBranchId: branch.id,
          now,
        });
      }
    }

    const nextTitle = args.title ?? previousAmendment.title ?? 'Amendment';
    const hasProfileChanges =
      (args.title !== undefined && args.title !== previousAmendment.title) ||
      (args.reason !== undefined && args.reason !== previousAmendment.reason) ||
      (args.category !== undefined && args.category !== previousAmendment.category) ||
      (args.preamble !== undefined && args.preamble !== previousAmendment.preamble) ||
      (args.visibility !== undefined && args.visibility !== previousAmendment.visibility) ||
      (args.tags !== undefined && args.tags !== previousAmendment.tags) ||
      (args.code !== undefined && args.code !== previousAmendment.code) ||
      (args.image_url !== undefined && args.image_url !== previousAmendment.image_url) ||
      (args.x !== undefined && args.x !== previousAmendment.x) ||
      (args.youtube !== undefined && args.youtube !== previousAmendment.youtube) ||
      (args.linkedin !== undefined && args.linkedin !== previousAmendment.linkedin) ||
      (args.website !== undefined && args.website !== previousAmendment.website);

    if (hasProfileChanges) {
      fireNotification('notifyAmendmentProfileUpdated', {
        senderId: ctx.userID,
        amendmentId: args.id,
        amendmentTitle: nextTitle,
      });
    }

    const nextGroupId = args.group_id ?? previousAmendment.group_id;
    const nextEventId = args.event_id ?? previousAmendment.event_id;
    const targetChanged =
      (args.group_id !== undefined && args.group_id !== previousAmendment.group_id) ||
      (args.event_id !== undefined && args.event_id !== previousAmendment.event_id);

    if (targetChanged && nextGroupId && nextEventId) {
      const [nextGroupName, nextEventTitle] = await Promise.all([
        groupName(tx, nextGroupId),
        eventTitle(tx, nextEventId),
      ]);

      fireNotification('notifyAmendmentTargetSet', {
        senderId: ctx.userID,
        amendmentId: args.id,
        amendmentTitle: nextTitle,
        groupId: nextGroupId,
        groupName: nextGroupName,
        eventId: nextEventId,
        eventTitle: nextEventTitle,
      });
    }
  }),

  delete: defineMutator(deleteAmendmentSchema, async ({ tx, ctx, args }) => {
    await assertCanMutateAmendment(tx, ctx, args.id, 'delete');
    const amd = await tx.run(zql.amendment.where('id', args.id).one());

    await mutators.amendments.delete.fn({ tx, ctx, args });

    if (amd?.created_by_id) {
      await recomputeUserCounters(tx, amd.created_by_id);
    }

    if (amd?.group_id) {
      await recomputeGroupCounters(tx, amd.group_id);
    }

    if (amd?.event_id) {
      await recomputeEventCounters(tx, amd.event_id);
    }

    if (amd?.clone_source_id) {
      await recomputeAmendmentCounters(tx, amd.clone_source_id);
    }
  }),

  addCollaborator: defineMutator(createAmendmentCollaboratorSchema, async ({ tx, ctx, args }) => {
    const isSelfRequest = args.user_id === ctx.userID && args.status === 'requested';
    if (isSelfRequest) {
      await assertCanViewOrRequestCollaboration(tx, ctx, args.amendment_id);
    } else {
      await assertCanMutateAmendment(tx, ctx, args.amendment_id, 'manage');
    }

    await mutators.amendments.addCollaborator.fn({ tx, ctx, args });

    if (!args.amendment_id) return;

    await recomputeAmendmentCounters(tx, args.amendment_id);

    const [aTitle, uName] = await Promise.all([
      amendmentTitle(tx, args.amendment_id),
      userName(tx, ctx.userID),
    ]);

    if (args.status === 'requested') {
      fireNotification('notifyCollaborationRequest', {
        senderId: ctx.userID,
        senderName: uName,
        amendmentId: args.amendment_id,
        amendmentTitle: aTitle,
      });
    } else if (args.status === 'invited' && args.user_id) {
      fireNotification('notifyCollaborationInvite', {
        senderId: ctx.userID,
        recipientUserId: args.user_id,
        amendmentId: args.amendment_id,
        amendmentTitle: aTitle,
      });
    }
  }),

  removeCollaborator: defineMutator(
    deleteAmendmentCollaboratorSchema,
    async ({ tx, ctx, args }) => {
      const collab = await tx.run(zql.amendment_collaborator.where('id', args.id).one());
      if (!collab) {
        throw new Error('Amendment collaborator not found');
      }

      if (collab.user_id !== ctx.userID) {
        await assertCanMutateAmendment(tx, ctx, collab.amendment_id, 'manage');
      }

      await mutators.amendments.removeCollaborator.fn({ tx, ctx, args });

      if (!collab) return;

      await recomputeAmendmentCounters(tx, collab.amendment_id);

      const aId = collab.amendment_id;
      const collabUserId = collab.user_id;
      const status = collab.status;
      const isSelf = ctx.userID === collabUserId;

      const [aTitle, uName] = await Promise.all([
        amendmentTitle(tx, aId),
        userName(tx, collabUserId),
      ]);

      if (isSelf) {
        if (status === 'requested') {
          fireNotification('notifyCollaborationRequestWithdrawn', {
            senderId: ctx.userID,
            senderName: uName,
            amendmentId: aId,
            amendmentTitle: aTitle,
          });
        } else if (status === 'invited') {
          fireNotification('notifyCollaborationInvitationDeclined', {
            senderId: ctx.userID,
            senderName: uName,
            amendmentId: aId,
            amendmentTitle: aTitle,
          });
        } else {
          fireNotification('notifyCollaborationWithdrawn', {
            senderId: ctx.userID,
            senderName: uName,
            amendmentId: aId,
            amendmentTitle: aTitle,
          });
        }
      } else {
        if (status === 'requested') {
          fireNotification('notifyCollaborationRejected', {
            senderId: ctx.userID,
            recipientUserId: collabUserId,
            amendmentId: aId,
            amendmentTitle: aTitle,
          });
        } else {
          fireNotification('notifyCollaborationRemoved', {
            senderId: ctx.userID,
            recipientUserId: collabUserId,
            amendmentId: aId,
            amendmentTitle: aTitle,
          });
        }
      }
    }
  ),

  updateCollaborator: defineMutator(
    updateAmendmentCollaboratorSchema,
    async ({ tx, ctx, args }) => {
      const oldCollab = await loadCollaboratorForMutation(tx, args.id);
      const isSelfStatusUpdate =
        oldCollab.user_id === ctx.userID &&
        args.status !== undefined &&
        args.role_id === undefined &&
        args.visibility === undefined;
      if (!isSelfStatusUpdate) {
        await assertCanMutateAmendment(tx, ctx, oldCollab.amendment_id, 'manage');
      }

      await mutators.amendments.updateCollaborator.fn({ tx, ctx, args });

      if (!oldCollab) return;

      await recomputeAmendmentCounters(tx, oldCollab.amendment_id);

      const aId = oldCollab.amendment_id;
      const collabUserId = oldCollab.user_id;
      const oldStatus = oldCollab.status;
      const newStatus = args.status;
      const isSelf = ctx.userID === collabUserId;
      const nextStatus = args.status ?? oldCollab.status;
      const nextRoleId = args.role_id !== undefined ? args.role_id : oldCollab.role_id;

      const aTitle = await amendmentTitle(tx, aId);

      if (newStatus === 'member' && (oldStatus === 'requested' || oldStatus === 'invited')) {
        if (isSelf) {
          const uName = await userName(tx, ctx.userID);
          fireNotification('notifyCollaborationInvitationAccepted', {
            senderId: ctx.userID,
            senderName: uName,
            amendmentId: aId,
            amendmentTitle: aTitle,
          });
        } else {
          fireNotification('notifyCollaborationApproved', {
            senderId: ctx.userID,
            recipientUserId: collabUserId,
            amendmentId: aId,
            amendmentTitle: aTitle,
          });
        }
      }

      if (args.role_id !== undefined && args.role_id !== oldCollab.role_id) {
        await notifyAmendmentCollaboratorRoleChange(
          tx,
          ctx.userID,
          oldCollab,
          oldCollab.role_id,
          nextRoleId,
          nextStatus
        );
      }
    }
  ),

  createStreetDesign: defineMutator(
    createAmendmentStreetDesignSchema,
    async ({ tx, ctx, args }) => {
      await assertCanMutateAmendment(tx, ctx, args.amendment_id, 'update');
      await mutators.amendments.createStreetDesign.fn({ tx, ctx, args });
    }
  ),

  updateStreetDesign: defineMutator(
    updateAmendmentStreetDesignSchema,
    async ({ tx, ctx, args }) => {
      const streetDesign = await loadStreetDesignForMutation(tx, args.id);
      await assertCanMutateAmendment(tx, ctx, streetDesign.amendment_id, 'update');
      await mutators.amendments.updateStreetDesign.fn({ tx, ctx, args });
    }
  ),

  deleteStreetDesign: defineMutator(
    deleteAmendmentStreetDesignSchema,
    async ({ tx, ctx, args }) => {
      const streetDesign = await loadStreetDesignForMutation(tx, args.id);
      await assertCanMutateAmendment(tx, ctx, streetDesign.amendment_id, 'update');
      await mutators.amendments.deleteStreetDesign.fn({ tx, ctx, args });
    }
  ),

  createChangeRequest: defineMutator(createChangeRequestSchema, async ({ tx, ctx, args }) => {
    await assertCanCreateChangeRequest(tx, ctx, args.amendment_id, args.process_branch_id ?? null);

    await mutators.amendments.createChangeRequest.fn({ tx, ctx, args });

    if (args.status === PENDING_SUBMISSION_STATUS) {
      const amendment = await tx.run(zql.amendment.where('id', args.amendment_id).one());
      await recomputeAmendmentCounters(tx, args.amendment_id);
      if (amendment?.event_id) {
        await recomputeEventCounters(tx, amendment.event_id);
      }
      return;
    }

    const now = Date.now();
    const [aTitle, senderName, amendment] = await Promise.all([
      amendmentTitle(tx, args.amendment_id),
      userName(tx, ctx.userID),
      tx.run(zql.amendment.where('id', args.amendment_id).one()),
    ]);

    const appendedEventId = amendment
      ? await appendEventChangeRequestVoteStepIfNeeded({
          tx,
          amendment,
          changeRequest: {
            id: args.id,
            title: args.title,
            status: args.status,
            process_branch_id: args.process_branch_id ?? null,
          },
          now,
        })
      : null;

    await recomputeAmendmentCounters(tx, args.amendment_id);

    fireNotification('notifyChangeRequestCreated', {
      senderId: ctx.userID,
      senderName,
      amendmentId: args.amendment_id,
      amendmentTitle: aTitle,
    });

    const notificationEventId = appendedEventId ?? amendment?.event_id ?? null;
    if (notificationEventId) {
      fireNotification('notifyEventChangeRequestCreated', {
        senderId: ctx.userID,
        senderName,
        eventId: notificationEventId,
        eventTitle: await eventTitle(tx, notificationEventId),
        amendmentId: args.amendment_id,
        amendmentTitle: aTitle,
      });

      await recomputeEventCounters(tx, notificationEventId);
    }
  }),

  voteOnChangeRequest: defineMutator(createChangeRequestVoteSchema, async ({ tx, ctx, args }) => {
    const changeRequest = await assertCanVoteOnChangeRequest(tx, ctx, args.change_request_id);
    const now = Date.now();

    await maybeFinalizeInternalChangeRequestVote({
      tx,
      ctx,
      changeRequestId: changeRequest.id,
      reason: 'deadline',
      now,
    });

    const currentChangeRequest = await loadChangeRequestForMutation(tx, changeRequest.id);
    if (
      isFinalChangeRequestStatus(currentChangeRequest.status) ||
      currentChangeRequest.voting_status === 'completed'
    ) {
      throw new Error('Change request voting is already completed');
    }

    await mutators.amendments.voteOnChangeRequest.fn({ tx, ctx, args });
    await maybeFinalizeInternalChangeRequestVote({
      tx,
      ctx,
      changeRequestId: changeRequest.id,
      reason: 'after_vote',
      now,
    });

    if (changeRequest.user_id === ctx.userID) {
      return;
    }

    const [aTitle, senderName] = await Promise.all([
      amendmentTitle(tx, changeRequest.amendment_id),
      userName(tx, ctx.userID),
    ]);

    fireNotification('notifyChangeRequestVoteCast', {
      senderId: ctx.userID,
      senderName,
      recipientUserId: changeRequest.user_id,
      changeRequestId: changeRequest.id,
      amendmentId: changeRequest.amendment_id,
      amendmentTitle: aTitle,
      voteType: args.vote ?? 'vote',
    });
  }),

  finalizeInternalChangeRequestVote: defineMutator(
    finalizeInternalChangeRequestVoteSchema,
    async ({ tx, ctx, args }) => {
      const now = Date.now();
      const changeRequest = await loadChangeRequestForMutation(tx, args.change_request_id);
      const amendment = await loadAmendmentForMutation(tx, changeRequest.amendment_id);
      const branch = changeRequest.process_branch_id
        ? await loadProcessBranchForMutation(tx, changeRequest.process_branch_id)
        : null;

      if (getBranchMutationEditingMode(branch ?? { editing_mode: 'edit' }) !== 'vote_internal') {
        throw new PermissionError('manage', 'amendments', 'editing_mode:vote_internal');
      }
      if (
        isFinalChangeRequestStatus(changeRequest.status) ||
        changeRequest.voting_status === 'completed'
      ) {
        throw new Error('Change request voting is already completed');
      }

      await assertCanMutateAmendment(tx, ctx, changeRequest.amendment_id, 'manage');

      await resolveInternalChangeRequestVote({
        tx,
        ctx,
        changeRequestId: changeRequest.id,
        now,
      });

      await recomputeAmendmentCounters(tx, changeRequest.amendment_id);

      if (amendment.event_id) {
        await recomputeEventCounters(tx, amendment.event_id);
      }
    }
  ),

  finalizeExpiredInternalChangeRequestVotes: defineMutator(
    finalizeExpiredInternalChangeRequestVotesSchema,
    async ({ tx, ctx, args }) => {
      await assertCanViewAmendment(tx, ctx, args.amendment_id);
      const now = Date.now();
      await finalizeExpiredInternalChangeRequestVotesForAmendment({
        tx,
        ctx,
        amendmentId: args.amendment_id,
        processBranchId: args.process_branch_id ?? undefined,
        now,
      });

      await recomputeAmendmentCounters(tx, args.amendment_id);
      const amendment = await tx.run(zql.amendment.where('id', args.amendment_id).one());
      if (amendment?.event_id) {
        await recomputeEventCounters(tx, amendment.event_id);
      }
    }
  ),

  repairInternalChangeRequestResolution: defineMutator(
    repairInternalChangeRequestResolutionSchema,
    async ({ tx, ctx, args }) => {
      await assertCanMutateAmendment(tx, ctx, args.amendment_id, 'update');
      const now = Date.now();
      await repairInternalChangeRequestResolution({
        tx,
        ctx,
        amendmentId: args.amendment_id,
        now,
      });

      await recomputeAmendmentCounters(tx, args.amendment_id);
      const amendment = await tx.run(zql.amendment.where('id', args.amendment_id).one());
      if (amendment?.event_id) {
        await recomputeEventCounters(tx, amendment.event_id);
      }
    }
  ),

  updateChangeRequest: defineMutator(updateChangeRequestSchema, async ({ tx, ctx, args }) => {
    const previous = await loadChangeRequestForMutation(tx, args.id);
    const amendment = await loadAmendmentForMutation(tx, previous.amendment_id);
    const branch = previous.process_branch_id
      ? await loadProcessBranchForMutation(tx, previous.process_branch_id)
      : null;
    const branchMode = getBranchMutationEditingMode(branch ?? { editing_mode: 'edit' });
    if (
      args.status !== undefined &&
      isFinalChangeRequestStatus(args.status) &&
      !isFinalChangeRequestStatus(previous.status) &&
      (branchMode === 'suggest_event' ||
        branchMode === 'vote_internal' ||
        branchMode === 'event_final_closing_vote')
    ) {
      throw new PermissionError('update', 'amendments', `editing_mode:${branchMode}`);
    }

    const isSubmittingOwnPendingChangeRequest =
      previous.user_id === ctx.userID &&
      previous.status === PENDING_SUBMISSION_STATUS &&
      args.status === 'open' &&
      (args.voting_status === undefined || args.voting_status === 'open') &&
      !changeRequestUpdateTouchesVoteCounts(args);

    if (
      previous.user_id !== ctx.userID ||
      (changeRequestUpdateNeedsManage(args) && !isSubmittingOwnPendingChangeRequest)
    ) {
      await assertCanMutateAmendment(tx, ctx, previous.amendment_id, 'update');
    }

    await mutators.amendments.updateChangeRequest.fn({ tx, ctx, args });

    const now = Date.now();

    if (
      args.status !== undefined &&
      isFinalChangeRequestStatus(args.status) &&
      !isFinalChangeRequestStatus(previous.status)
    ) {
      await tx.mutate.change_request.update({
        id: previous.id,
        ...getChangeRequestResolutionMetadata(branchMode, amendment),
        updated_at: now,
      });
    }

    const appendedEventId =
      args.status === 'open' && previous.status !== 'open'
        ? await appendEventChangeRequestVoteStepIfNeeded({
            tx,
            amendment,
            changeRequest: {
              id: previous.id,
              title: previous.title,
              status: args.status,
              process_branch_id: previous.process_branch_id ?? null,
            },
            now,
          })
        : null;

    await recomputeAmendmentCounters(tx, previous.amendment_id);

    const counterEventId = appendedEventId ?? amendment?.event_id ?? null;
    if (counterEventId) {
      await recomputeEventCounters(tx, counterEventId);
    }

    if (
      isSubmittingOwnPendingChangeRequest ||
      (previous.status === PENDING_SUBMISSION_STATUS && args.status === 'open')
    ) {
      const [aTitle, senderName] = await Promise.all([
        amendmentTitle(tx, previous.amendment_id),
        userName(tx, ctx.userID),
      ]);

      fireNotification('notifyChangeRequestCreated', {
        senderId: ctx.userID,
        senderName,
        amendmentId: previous.amendment_id,
        amendmentTitle: aTitle,
      });

      const notificationEventId = appendedEventId ?? amendment?.event_id ?? null;
      if (notificationEventId) {
        fireNotification('notifyEventChangeRequestCreated', {
          senderId: ctx.userID,
          senderName,
          eventId: notificationEventId,
          eventTitle: await eventTitle(tx, notificationEventId),
          amendmentId: previous.amendment_id,
          amendmentTitle: aTitle,
        });
      }
    }

    if (
      args.status === 'approved' &&
      previous.status !== 'approved' &&
      previous.user_id !== ctx.userID
    ) {
      const aTitle = await amendmentTitle(tx, previous.amendment_id);
      fireNotification('notifyChangeRequestAccepted', {
        senderId: ctx.userID,
        recipientUserId: previous.user_id,
        amendmentId: previous.amendment_id,
        amendmentTitle: aTitle,
      });
    }

    if (
      args.status === 'rejected' &&
      previous.status !== 'rejected' &&
      previous.user_id !== ctx.userID
    ) {
      const aTitle = await amendmentTitle(tx, previous.amendment_id);
      fireNotification('notifyChangeRequestRejected', {
        senderId: ctx.userID,
        recipientUserId: previous.user_id,
        amendmentId: previous.amendment_id,
        amendmentTitle: aTitle,
      });
    }
  }),

  deleteChangeRequest: defineMutator(deleteChangeRequestSchema, async ({ tx, ctx, args }) => {
    const previous = await loadChangeRequestForMutation(tx, args.id);
    if (previous.status !== PENDING_SUBMISSION_STATUS) {
      throw new Error('Only pending change request submissions can be deleted');
    }

    if (previous.user_id !== ctx.userID) {
      await assertCanMutateAmendment(tx, ctx, previous.amendment_id, 'manage');
    }

    await mutators.amendments.deleteChangeRequest.fn({ tx, ctx, args });
    await recomputeAmendmentCounters(tx, previous.amendment_id);

    const amendment = await tx.run(zql.amendment.where('id', previous.amendment_id).one());
    if (amendment?.event_id) {
      await recomputeEventCounters(tx, amendment.event_id);
    }
  }),

  createSupportConfirmation: defineMutator(
    createSupportConfirmationSchema,
    async ({ tx, ctx, args }) => {
      await mutators.amendments.createSupportConfirmation.fn({ tx, ctx, args });

      if (!args.group_id) {
        return;
      }

      const [aTitle, gName, eTitle] = await Promise.all([
        amendmentTitle(tx, args.amendment_id),
        groupName(tx, args.group_id),
        args.event_id ? eventTitle(tx, args.event_id) : Promise.resolve(undefined),
      ]);

      fireNotification('notifySupportConfirmationRequired', {
        senderId: ctx.userID,
        groupId: args.group_id,
        groupName: gName,
        amendmentId: args.amendment_id,
        amendmentTitle: aTitle,
        changeRequestTitle: 'Accepted change request',
        eventId: args.event_id ?? undefined,
        eventTitle: eTitle,
      });
    }
  ),

  updateSupportConfirmation: defineMutator(
    updateSupportConfirmationSchema,
    async ({ tx, ctx, args }) => {
      const previousConfirmation = await tx.run(
        zql.support_confirmation.where('id', args.id).one()
      );

      await mutators.amendments.updateSupportConfirmation.fn({
        tx,
        ctx,
        args: {
          ...args,
          confirmed_by_id: args.confirmed_by_id ?? ctx.userID,
        },
      });

      if (
        !previousConfirmation ||
        !previousConfirmation.group_id ||
        !args.status ||
        args.status === previousConfirmation.status
      ) {
        return;
      }

      const [aTitle, gName, eTitle] = await Promise.all([
        amendmentTitle(tx, previousConfirmation.amendment_id),
        groupName(tx, previousConfirmation.group_id),
        previousConfirmation.event_id
          ? eventTitle(tx, previousConfirmation.event_id)
          : Promise.resolve(undefined),
      ]);

      if (args.status === 'confirmed') {
        fireNotification('notifySupportConfirmed', {
          senderId: ctx.userID,
          amendmentId: previousConfirmation.amendment_id,
          amendmentTitle: aTitle,
          groupId: previousConfirmation.group_id,
          groupName: gName,
        });
        fireNotification('notifyGroupAmendmentSupportConfirmed', {
          senderId: ctx.userID,
          amendmentId: previousConfirmation.amendment_id,
          amendmentTitle: aTitle,
          groupId: previousConfirmation.group_id,
          groupName: gName,
          eventId: previousConfirmation.event_id ?? undefined,
          eventTitle: eTitle,
        });
      }

      if (args.status === 'declined') {
        fireNotification('notifySupportDeclined', {
          senderId: ctx.userID,
          amendmentId: previousConfirmation.amendment_id,
          amendmentTitle: aTitle,
          groupId: previousConfirmation.group_id,
          groupName: gName,
        });
      }
    }
  ),

  updateProcessBranch: defineMutator(
    updateAmendmentProcessBranchSchema,
    async ({ tx, ctx, args }) => {
      const previousBranch = await loadProcessBranchForMutation(tx, args.id);
      const processRun = await loadProcessRunForBranch(tx, previousBranch);
      await assertCanMutateAmendment(tx, ctx, processRun.amendment_id, 'update');

      const previousMode = getBranchMutationEditingMode(previousBranch);
      const nextMode =
        args.editing_mode !== undefined ? normalizeEditingMode(args.editing_mode) : previousMode;
      const editingModeChanged = args.editing_mode !== undefined && nextMode !== previousMode;
      const now = Date.now();

      if (editingModeChanged) {
        if (
          TERMINAL_PROCESS_STEP_STATUSES.has(previousBranch.status ?? '') ||
          previousBranch.resolution === 'rejected' ||
          previousBranch.resolution === 'withdrawn' ||
          previousBranch.resolution === 'merge_loser'
        ) {
          throw new PermissionError('update', 'amendments', 'branch:terminal');
        }

        await assertManualBranchEditingModeChangeAllowed(tx, previousBranch, nextMode);

        if (
          previousMode === 'vote_internal' &&
          (nextMode === 'suggest_event' || nextMode === 'event_final_closing_vote')
        ) {
          await finalizeInternalChangeRequestsForEventPhaseTransition({
            tx,
            ctx,
            amendmentId: processRun.amendment_id,
            processBranchId: previousBranch.id,
            now,
          });
        }
      }

      await tx.mutate.amendment_process_branch.update({
        ...args,
        ...(args.editing_mode !== undefined ? { editing_mode: nextMode } : {}),
        updated_at: now,
      });

      if (editingModeChanged && nextMode === 'vote_internal') {
        const amendment = await loadAmendmentForMutation(tx, processRun.amendment_id);
        await initializeInternalChangeRequestVotingForAmendment({
          tx,
          amendment,
          processBranchId: previousBranch.id,
          now,
        });
      }

      if (editingModeChanged) {
        fireNotification('notifyWorkflowChanged', {
          senderId: ctx.userID,
          amendmentId: processRun.amendment_id,
          amendmentTitle: await amendmentTitle(tx, processRun.amendment_id),
          newStatus: nextMode,
        });
      }
    }
  ),

  createProcessTask: defineMutator(createProcessTaskSchema, async ({ tx, ctx, args }) => {
    await mutators.amendments.createProcessTask.fn({ tx, ctx, args });

    if (args.status !== 'open' || !args.group_id) {
      return;
    }

    fireNotification('notifyProcessTaskCreated', {
      senderId: ctx.userID,
      groupId: args.group_id,
      groupName: await groupName(tx, args.group_id),
      taskTitle: getProcessTaskNotificationTitle(args.task_type, args.title),
    });
  }),

  initializeProcessPath: defineMutator(
    initializeAmendmentProcessPathSchema,
    async ({ tx, ctx, args }) => {
      await assertCanUseAmendmentPathSourceGroup(tx, ctx, args.source_group_id);
      await assertCanMutateAmendment(tx, ctx, args.amendment_id, 'manage');
      await initializeAmendmentProcessPath(tx, ctx.userID, args);
    }
  ),

  resolveProcessVote: defineMutator(
    resolveAmendmentProcessVoteSchema,
    async ({ tx, ctx, args }) => {
      await assertCanResolveProcessVote(tx, ctx, args.agenda_item_id);
      const resolution = await resolveAmendmentProcessVote(tx, args, ctx.userID);
      await notifyProcessVoteResolution(tx, ctx.userID, args.agenda_item_id, resolution);
    }
  ),

  completeProcessTaskWithEvent: defineMutator(
    completeProcessTaskWithEventSchema,
    async ({ tx, ctx, args }) => {
      await assertCanCompleteProcessTaskWithEvent(tx, ctx, args.process_task_id, args.event_id);
      await completeProcessTaskWithEvent(tx, ctx.userID, args);
    }
  ),

  replanProcessBranchEvents: defineMutator(
    replanProcessBranchEventsSchema,
    async ({ tx, ctx, args }) => {
      await assertCanReplanProcessBranchEvents(tx, ctx, args.branch_id);
      await replanProcessBranchEvents(tx, ctx.userID, args);
    }
  ),

  supportAmendment: defineMutator(createAmendmentSupportVoteSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'vote', resource: 'amendments' });
    const amendment = await assertCanViewAmendment(tx, ctx, args.amendment_id);

    await mutators.amendments.supportAmendment.fn({ tx, ctx, args });
    await recomputeAmendmentCounters(tx, args.amendment_id);

    const [senderName, adminCollaborator] = await Promise.all([
      userName(tx, ctx.userID),
      tx.run(
        zql.amendment_collaborator
          .where('amendment_id', args.amendment_id)
          .where('status', 'admin')
          .one()
      ),
    ]);
    const recipientUserId = [adminCollaborator?.user_id, amendment.created_by_id].find(
      id => id && id !== ctx.userID
    );
    if (recipientUserId) {
      fireNotification('notifyAmendmentVoted', {
        senderId: ctx.userID,
        senderName,
        recipientUserId,
        amendmentId: args.amendment_id,
        amendmentTitle: amendment.title ?? 'Amendment',
        voteType: (args.vote ?? 1) > 0 ? 'upvote' : 'downvote',
      });
    }
  }),

  updateSupportVote: defineMutator(updateAmendmentSupportVoteSchema, async ({ tx, ctx, args }) => {
    const existingVote = await loadSupportVoteForMutation(tx, args.id);
    requireOwner(tx, ctx, existingVote.user_id, { action: 'update', resource: 'amendments' });

    await mutators.amendments.updateSupportVote.fn({ tx, ctx, args });

    await recomputeAmendmentCounters(tx, existingVote.amendment_id);
  }),

  deleteSupportVote: defineMutator(deleteAmendmentSupportVoteSchema, async ({ tx, ctx, args }) => {
    const existingVote = await loadSupportVoteForMutation(tx, args.id);
    requireOwner(tx, ctx, existingVote.user_id, { action: 'delete', resource: 'amendments' });

    await mutators.amendments.deleteSupportVote.fn({ tx, ctx, args });

    await recomputeAmendmentCounters(tx, existingVote.amendment_id);
  }),
};

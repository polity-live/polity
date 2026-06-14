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
} from './schema';
import { createChangeRequestSchema, updateChangeRequestSchema } from '../change-requests/schema';
import {
  createAmendmentSupportVoteSchema,
  updateAmendmentSupportVoteSchema,
  deleteAmendmentSupportVoteSchema,
  createChangeRequestVoteSchema,
} from '../votes/schema';
import {
  completeProcessTaskWithEvent,
  initializeAmendmentProcessPath,
  resolveAmendmentProcessVote,
} from './process-engine';
import { notifyProcessVoteResolution } from './process-notifications';
import { can } from '../rbac/can';
import { canReadVisibility, requireAuthenticated, requireOwner } from '../rbac/authorize';
import { PermissionError } from '../rbac/errors';

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = new Set(['collaborator', 'member', 'admin']);

type AmendmentServerTx = Parameters<typeof mutators.amendments.create.fn>[0]['tx'];
type AmendmentServerCtx = Parameters<typeof mutators.amendments.create.fn>[0]['ctx'];

async function loadAmendmentForMutation(tx: AmendmentServerTx, amendmentId: string) {
  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment) {
    throw new Error('Amendment not found');
  }
  return amendment;
}

async function assertCanCreateAmendment(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  args: { group_id?: string | null; event_id?: string | null }
) {
  requireAuthenticated(tx, ctx, { action: 'create', resource: 'amendments' });

  if (args.group_id) {
    await can(tx, ctx, { action: 'create', resource: 'amendments', groupId: args.group_id });
  }

  if (args.event_id) {
    await can(tx, ctx, { action: 'create', resource: 'amendments', eventId: args.event_id });
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

async function assertCanVoteOnChangeRequest(
  tx: AmendmentServerTx,
  ctx: AmendmentServerCtx,
  changeRequestId: string
) {
  requireAuthenticated(tx, ctx, { action: 'vote', resource: 'amendments' });
  const changeRequest = await loadChangeRequestForMutation(tx, changeRequestId);
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
    await assertCanCreateAmendment(tx, ctx, args);

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

    await mutators.amendments.update.fn({ tx, ctx, args });

    if (!previousAmendment) {
      return;
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

    if (args.editing_mode !== undefined && args.editing_mode !== previousAmendment.editing_mode) {
      fireNotification('notifyWorkflowChanged', {
        senderId: ctx.userID,
        amendmentId: args.id,
        amendmentTitle: nextTitle,
        newStatus: args.editing_mode ?? 'updated',
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
    await assertCanMutateAmendment(tx, ctx, args.amendment_id, 'update');

    await mutators.amendments.createChangeRequest.fn({ tx, ctx, args });

    const [aTitle, senderName, amendment] = await Promise.all([
      amendmentTitle(tx, args.amendment_id),
      userName(tx, ctx.userID),
      tx.run(zql.amendment.where('id', args.amendment_id).one()),
    ]);

    await recomputeAmendmentCounters(tx, args.amendment_id);

    fireNotification('notifyChangeRequestCreated', {
      senderId: ctx.userID,
      senderName,
      amendmentId: args.amendment_id,
      amendmentTitle: aTitle,
    });

    if (amendment?.event_id) {
      await recomputeEventCounters(tx, amendment.event_id);
    }
  }),

  voteOnChangeRequest: defineMutator(createChangeRequestVoteSchema, async ({ tx, ctx, args }) => {
    const changeRequest = await assertCanVoteOnChangeRequest(tx, ctx, args.change_request_id);

    await mutators.amendments.voteOnChangeRequest.fn({ tx, ctx, args });

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

  updateChangeRequest: defineMutator(updateChangeRequestSchema, async ({ tx, ctx, args }) => {
    const previous = await loadChangeRequestForMutation(tx, args.id);
    if (previous.user_id !== ctx.userID || changeRequestUpdateNeedsManage(args)) {
      await assertCanMutateAmendment(tx, ctx, previous.amendment_id, 'update');
    }

    await mutators.amendments.updateChangeRequest.fn({ tx, ctx, args });

    await recomputeAmendmentCounters(tx, previous.amendment_id);

    const amendment = await tx.run(zql.amendment.where('id', previous.amendment_id).one());
    if (amendment?.event_id) {
      await recomputeEventCounters(tx, amendment.event_id);
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

      const [aTitle, gName] = await Promise.all([
        amendmentTitle(tx, previousConfirmation.amendment_id),
        groupName(tx, previousConfirmation.group_id),
      ]);

      if (args.status === 'confirmed') {
        fireNotification('notifySupportConfirmed', {
          senderId: ctx.userID,
          amendmentId: previousConfirmation.amendment_id,
          amendmentTitle: aTitle,
          groupId: previousConfirmation.group_id,
          groupName: gName,
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

  initializeProcessPath: defineMutator(
    initializeAmendmentProcessPathSchema,
    async ({ tx, ctx, args }) => {
      await assertCanMutateAmendment(tx, ctx, args.amendment_id, 'manage');
      await initializeAmendmentProcessPath(tx, ctx.userID, args);
    }
  ),

  resolveProcessVote: defineMutator(
    resolveAmendmentProcessVoteSchema,
    async ({ tx, ctx, args }) => {
      await assertCanResolveProcessVote(tx, ctx, args.agenda_item_id);
      const resolution = await resolveAmendmentProcessVote(tx, args);
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

  supportAmendment: defineMutator(createAmendmentSupportVoteSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'vote', resource: 'amendments' });
    await can(tx, ctx, { action: 'vote', resource: 'amendments', amendmentId: args.amendment_id });

    await mutators.amendments.supportAmendment.fn({ tx, ctx, args });
    await recomputeAmendmentCounters(tx, args.amendment_id);
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

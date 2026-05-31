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
  createAmendmentSchema,
  deleteAmendmentSchema,
  createSupportConfirmationSchema,
  updateSupportConfirmationSchema,
} from './schema';
import { createChangeRequestSchema, updateChangeRequestSchema } from '../change-requests/schema';
import {
  createAmendmentSupportVoteSchema,
  updateAmendmentSupportVoteSchema,
  deleteAmendmentSupportVoteSchema,
  createChangeRequestVoteSchema,
} from '../votes/schema';

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
export const amendmentServerMutators = {
  create: defineMutator(createAmendmentSchema, async ({ tx, ctx, args }) => {
    await mutators.amendments.create.fn({ tx, ctx, args });

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
      const oldCollab = await tx.run(zql.amendment_collaborator.where('id', args.id).one());

      await mutators.amendments.updateCollaborator.fn({ tx, ctx, args });

      if (!oldCollab) return;

      await recomputeAmendmentCounters(tx, oldCollab.amendment_id);

      const aId = oldCollab.amendment_id;
      const collabUserId = oldCollab.user_id;
      const oldStatus = oldCollab.status;
      const newStatus = args.status;
      const isSelf = ctx.userID === collabUserId;

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
    }
  ),

  createChangeRequest: defineMutator(createChangeRequestSchema, async ({ tx, ctx, args }) => {
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
    await mutators.amendments.voteOnChangeRequest.fn({ tx, ctx, args });

    const changeRequest = await tx.run(
      zql.change_request.where('id', args.change_request_id).one()
    );
    if (!changeRequest || changeRequest.user_id === ctx.userID) {
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
    const previous = await tx.run(zql.change_request.where('id', args.id).one());

    await mutators.amendments.updateChangeRequest.fn({ tx, ctx, args });

    if (!previous) return;

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

  supportAmendment: defineMutator(createAmendmentSupportVoteSchema, async ({ tx, ctx, args }) => {
    await mutators.amendments.supportAmendment.fn({ tx, ctx, args });
    await recomputeAmendmentCounters(tx, args.amendment_id);
  }),

  updateSupportVote: defineMutator(updateAmendmentSupportVoteSchema, async ({ tx, ctx, args }) => {
    const existingVote = await tx.run(zql.amendment_support_vote.where('id', args.id).one());

    await mutators.amendments.updateSupportVote.fn({ tx, ctx, args });

    if (!existingVote) return;

    await recomputeAmendmentCounters(tx, existingVote.amendment_id);
  }),

  deleteSupportVote: defineMutator(deleteAmendmentSupportVoteSchema, async ({ tx, ctx, args }) => {
    const existingVote = await tx.run(zql.amendment_support_vote.where('id', args.id).one());

    await mutators.amendments.deleteSupportVote.fn({ tx, ctx, args });

    if (!existingVote) return;

    await recomputeAmendmentCounters(tx, existingVote.amendment_id);
  }),
};

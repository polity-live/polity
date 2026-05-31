import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import {
  isActiveGroupStatus,
  recomputeEventCounters,
  syncUserWithEventConversation,
} from '../server-helpers';
import { resolveChildBaseGroups } from '@/features/groups/logic/hierarchy';

type EventTx = Parameters<typeof mutators.events.create.fn>[0]['tx'];

async function addParticipantRoleLink(
  tx: EventTx,
  args: {
    eventParticipantId: string;
    roleId: string;
    assignedById?: string | null;
  }
) {
  const existingLink = await tx.run(
    zql.event_participant_role
      .where('event_participant_id', args.eventParticipantId)
      .where('role_id', args.roleId)
      .one()
  );

  if (existingLink) {
    return;
  }

  const now = Date.now();
  await tx.mutate.event_participant_role.insert({
    id: crypto.randomUUID(),
    event_participant_id: args.eventParticipantId,
    role_id: args.roleId,
    assigned_at: now,
    assigned_by_id: args.assignedById ?? null,
    created_at: now,
  });
}

async function syncParticipantRoleLinks(
  tx: EventTx,
  args: {
    eventParticipantId: string;
    roleIds: string[];
    assignedById?: string | null;
  }
) {
  const desiredRoleIds = [...new Set(args.roleIds.filter(Boolean))];
  const existingLinks = await tx.run(
    zql.event_participant_role.where('event_participant_id', args.eventParticipantId)
  );
  const desiredRoleIdSet = new Set(desiredRoleIds);
  const existingRoleIds = new Set(existingLinks.map(link => link.role_id));

  for (const link of existingLinks) {
    if (!desiredRoleIdSet.has(link.role_id)) {
      await tx.mutate.event_participant_role.delete({ id: link.id });
    }
  }

  for (const roleId of desiredRoleIds) {
    if (!existingRoleIds.has(roleId)) {
      await addParticipantRoleLink(tx, {
        eventParticipantId: args.eventParticipantId,
        roleId,
        assignedById: args.assignedById,
      });
    }
  }
}

function isEventOngoingOrUpcomingByEndDate(event: {
  end_date?: number | null;
  start_date?: number | null;
}) {
  const inviteCutoff = event.end_date ?? event.start_date ?? null;
  return inviteCutoff != null && inviteCutoff >= Date.now();
}

async function getEligibleGeneralAssemblyUserIds(tx: EventTx, groupId: string) {
  const group = await tx.run(zql.group.where('id', groupId).one());
  if (!group) {
    return {
      eligibleUserIds: new Set<string>(),
      descendantBaseGroupIds: [] as string[],
    };
  }

  const groupMemberships = await tx.run(zql.group_membership.where('group_id', groupId));
  const eligibleUserIds = new Set(
    groupMemberships
      .filter(membership => isActiveGroupStatus(membership.status))
      .filter(membership => group.group_type !== 'hierarchical' || membership.source !== 'derived')
      .map(membership => membership.user_id)
  );

  let descendantBaseGroupIds: string[] = [];

  if (group.group_type === 'hierarchical') {
    const [groups, hierarchyRelationships] = await Promise.all([
      tx.run(zql.group),
      tx.run(
        zql.group_relationship.where('with_right', 'passiveVotingRight').where('status', 'active')
      ),
    ]);
    const groupsById = new Map(groups.map(currentGroup => [currentGroup.id, currentGroup]));

    descendantBaseGroupIds = [
      ...new Set(resolveChildBaseGroups(groupId, hierarchyRelationships, groupsById)),
    ];

    if (descendantBaseGroupIds.length > 0) {
      const descendantMemberships = await tx.run(
        zql.group_membership.where('group_id', 'IN', descendantBaseGroupIds)
      );

      for (const membership of descendantMemberships) {
        if (membership.source === 'direct' && isActiveGroupStatus(membership.status)) {
          eligibleUserIds.add(membership.user_id);
        }
      }
    }
  }

  return {
    eligibleUserIds,
    descendantBaseGroupIds,
  };
}

export async function reconcileGeneralAssemblyParticipantsForEvent(
  tx: EventTx,
  eventId: string,
  assignedById?: string | null
) {
  const event = await tx.run(zql.event.where('id', eventId).one());
  if (!event || event.event_type !== 'general_assembly' || !event.group_id) {
    return;
  }

  console.info('Server validation started', {
    flow: 'general-assembly-reconcile',
    eventId: event.id,
    groupId: event.group_id,
    assignedById: assignedById ?? null,
  });

  const [{ eligibleUserIds, descendantBaseGroupIds }, eventRoles, participants] = await Promise.all(
    [
      getEligibleGeneralAssemblyUserIds(tx, event.group_id),
      tx.run(
        zql.role.where('event_id', event.id).where('scope', 'event').orderBy('sort_order', 'asc')
      ),
      tx.run(
        zql.event_participant
          .where('event_id', event.id)
          .related('participant_roles', q => q.related('role'))
      ),
    ]
  );
  const participantByUserId = new Map(
    participants.map(participant => [participant.user_id, participant])
  );
  const defaultInviteRole =
    eventRoles.find(role => role.default_invite_role) ??
    eventRoles.find(role => role.name === 'Participant' && role.assignee_kind !== 'guest') ??
    null;
  const shouldAutoInvite = isEventOngoingOrUpcomingByEndDate(event);
  const addedUserIds: string[] = [];
  const removedUserIds: string[] = [];

  for (const userId of eligibleUserIds) {
    if (!shouldAutoInvite || participantByUserId.has(userId)) {
      continue;
    }

    const participantId = crypto.randomUUID();
    await tx.mutate.event_participant.insert({
      id: participantId,
      event_id: event.id,
      user_id: userId,
      group_id: event.group_id,
      status: 'invited',
      visibility: event.visibility ?? 'public',
      instance_date: null,
      created_at: Date.now(),
    });

    if (defaultInviteRole?.id) {
      await syncParticipantRoleLinks(tx, {
        eventParticipantId: participantId,
        roleIds: [defaultInviteRole.id],
        assignedById,
      });
    }

    addedUserIds.push(userId);
  }

  for (const participant of participants) {
    if (!shouldAutoInvite) {
      continue;
    }

    if (eligibleUserIds.has(participant.user_id)) {
      continue;
    }

    const roleLinks = participant.participant_roles ?? [];
    const hasOnlyGuestRoles =
      roleLinks.length > 0 && roleLinks.every(link => link.role?.assignee_kind === 'guest');

    if (hasOnlyGuestRoles) {
      continue;
    }

    for (const link of roleLinks) {
      await tx.mutate.event_participant_role.delete({ id: link.id });
    }
    await tx.mutate.event_participant.delete({ id: participant.id });
    removedUserIds.push(participant.user_id);
  }

  if (addedUserIds.length > 0 || removedUserIds.length > 0) {
    await recomputeEventCounters(tx, event.id);

    for (const userId of new Set([...addedUserIds, ...removedUserIds])) {
      await syncUserWithEventConversation(tx, {
        eventId: event.id,
        userId,
      });
    }

    const senderId = assignedById ?? event.creator_id;
    const resolvedEventTitle = event.title ?? 'Event';
    for (const userId of addedUserIds) {
      fireNotification('notifyEventInvite', {
        senderId,
        recipientUserId: userId,
        eventId: event.id,
        eventTitle: resolvedEventTitle,
      });
    }

    console.info('[general-assembly-reconcile]', {
      eventId: event.id,
      groupId: event.group_id,
      shouldAutoInvite,
      descendantBaseGroupIds,
      eligibleUserCount: eligibleUserIds.size,
      addedUserIds,
      removedUserIds,
    });
  }

  console.info('Server successful', {
    flow: 'general-assembly-reconcile',
    eventId: event.id,
    groupId: event.group_id,
    addedUserIds,
    removedUserIds,
  });
}

export async function reconcileGeneralAssemblyParticipantsForGroups(
  tx: EventTx,
  groupIds: readonly string[],
  assignedById?: string | null
) {
  const uniqueGroupIds = [...new Set(groupIds.filter(Boolean))];
  for (const groupId of uniqueGroupIds) {
    const allGeneralAssemblyEvents = await tx.run(
      zql.event.where('group_id', groupId).where('event_type', 'general_assembly')
    );
    const events = allGeneralAssemblyEvents.filter(event => event.status !== 'cancelled');

    console.info('[general-assembly-reconcile:group-events]', {
      groupId,
      assignedById: assignedById ?? null,
      eventIds: events.map(event => event.id),
      eventCount: events.length,
      allEventIds: allGeneralAssemblyEvents.map(event => event.id),
      allEventStatuses: allGeneralAssemblyEvents.map(event => ({
        eventId: event.id,
        status: event.status ?? null,
      })),
    });

    for (const event of events) {
      await reconcileGeneralAssemblyParticipantsForEvent(tx, event.id, assignedById);
    }
  }
}

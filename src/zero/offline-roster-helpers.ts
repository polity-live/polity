import { type Transaction } from '@rocicorp/zero';
import { resolveChildBaseGroups } from '@/features/groups/logic/hierarchy';
import { buildDerivedGroupNetworkMetaMap } from './network/derived';
import {
  buildOfflineMembershipPersonKey,
  loadEffectiveOfflineMembershipsForGroup,
} from './groups/offline-membership-helpers';
import { loadActiveHierarchyRelationships } from './groups/membership-helpers';
import { zql, type Schema } from './schema';

type ZeroTransaction = Transaction<Schema>;

interface GroupLike {
  id: string;
  group_type?: string | null;
  connected_group_id?: string | null;
  sibling_membership_mode?: string | null;
  parliament_source_group_ids?: string[];
}

interface OfflinePersonLike {
  id: string;
  connected_user_id?: string | null;
}

function isActiveGroupStatus(status: string | null | undefined) {
  return status === 'active' || status === 'member' || status === 'admin';
}

function isActiveEventStatus(status: string | null | undefined) {
  return status === 'active' || status === 'confirmed' || status === 'member' || status === 'admin';
}

function buildDistinctPersonIds(args: {
  activeUserIds: readonly string[];
  offlinePeople: readonly OfflinePersonLike[];
}) {
  const personIds = new Set<string>();

  for (const userId of args.activeUserIds) {
    if (userId) {
      personIds.add(`user:${userId}`);
    }
  }

  for (const offlinePerson of args.offlinePeople) {
    if (offlinePerson.connected_user_id) {
      personIds.add(`user:${offlinePerson.connected_user_id}`);
      continue;
    }

    personIds.add(`offline:${offlinePerson.id}`);
  }

  return personIds;
}

async function loadHierarchyContext(tx: ZeroTransaction) {
  const groups = await tx.run(zql.group);
  const groupsById = new Map<string, GroupLike>(groups.map(group => [group.id, group]));
  const hierarchyRelationships = await loadActiveHierarchyRelationships(tx, groupsById);

  return {
    groupsById,
    hierarchyRelationships,
  };
}

async function loadNetworkGroupContext(tx: ZeroTransaction) {
  const [groups, links, rights, rules] = await Promise.all([
    tx.run(zql.group),
    tx.run(zql.network_link),
    tx.run(zql.network_link_right),
    tx.run(zql.network_link_membership_rule),
  ]);

  const metaByGroupId = buildDerivedGroupNetworkMetaMap({
    groupIds: groups.map(group => group.id),
    links,
    rights,
    rules,
  });

  const groupsById = new Map<string, GroupLike>(
    groups.map(group => [group.id, { ...group, ...(metaByGroupId.get(group.id) ?? {}) }])
  );

  return { groupsById };
}

async function resolveOfflineRosterSourceGroupIdsForGroup(
  tx: ZeroTransaction,
  group: GroupLike,
  groupsById: ReadonlyMap<string, GroupLike>,
  visitedGroupIds = new Set<string>()
): Promise<string[]> {
  if (!group.id || visitedGroupIds.has(group.id)) {
    return [];
  }

  visitedGroupIds.add(group.id);

  if (group.group_type === 'base') {
    return [group.id];
  }

  if (group.group_type === 'hierarchical') {
    const { groupsById, hierarchyRelationships } = await loadHierarchyContext(tx);
    const descendantBaseGroupIds = resolveChildBaseGroups(
      group.id,
      hierarchyRelationships,
      groupsById
    );
    return descendantBaseGroupIds.length > 0 ? descendantBaseGroupIds : [group.id];
  }

  if (group.group_type !== 'sibling') {
    return [];
  }

  if (group.sibling_membership_mode === 'elected' && group.connected_group_id) {
    const connectedGroup = groupsById.get(group.connected_group_id);
    if (!connectedGroup) {
      return [];
    }

    return resolveOfflineRosterSourceGroupIdsForGroup(
      tx,
      connectedGroup,
      groupsById,
      visitedGroupIds
    );
  }

  if (group.sibling_membership_mode === 'parliament') {
    const sourceGroupIds = new Set<string>();

    for (const sourceGroupId of group.parliament_source_group_ids ?? []) {
      const sourceGroup = groupsById.get(sourceGroupId);
      if (!sourceGroup) {
        continue;
      }

      const resolvedGroupIds = await resolveOfflineRosterSourceGroupIdsForGroup(
        tx,
        sourceGroup,
        groupsById,
        visitedGroupIds
      );
      for (const resolvedGroupId of resolvedGroupIds) {
        sourceGroupIds.add(resolvedGroupId);
      }
    }

    return [...sourceGroupIds];
  }

  return [];
}

export async function resolveOfflineRosterSourceGroupIds(
  tx: ZeroTransaction,
  groupId: string
): Promise<string[]> {
  const { groupsById } = await loadNetworkGroupContext(tx);
  const group = groupsById.get(groupId);
  if (!group) {
    return [];
  }

  return resolveOfflineRosterSourceGroupIdsForGroup(tx, group, groupsById);
}

export async function loadOfflineRosterMembersForGroup(tx: ZeroTransaction, groupId: string) {
  const sourceGroupIds = await resolveOfflineRosterSourceGroupIds(tx, groupId);
  if (sourceGroupIds.length === 0) {
    return [];
  }

  return tx.run(
    zql.group_offline_member
      .where('group_id', 'IN', sourceGroupIds)
      .related('group')
      .related('connected_user')
      .related('created_by')
      .orderBy('created_at', 'asc')
  );
}

export async function computeDistinctGroupMemberCount(tx: ZeroTransaction, groupId: string) {
  const [memberships, offlineMemberships] = await Promise.all([
    tx.run(zql.group_membership.where('group_id', groupId)),
    loadEffectiveOfflineMembershipsForGroup(tx, groupId),
  ]);

  const activeUserIds = memberships
    .filter(membership => isActiveGroupStatus(membership.status))
    .map(membership => membership.user_id);
  const offlinePeople = offlineMemberships
    .map(membership => membership.group_offline_member)
    .filter(
      (
        offlineMember
      ): offlineMember is NonNullable<
        (typeof offlineMemberships)[number]['group_offline_member']
      > =>
        Boolean(
          buildOfflineMembershipPersonKey({
            offlineMemberId: offlineMember?.id,
            connectedUserId: offlineMember?.connected_user_id,
          })
        )
    );

  return buildDistinctPersonIds({
    activeUserIds,
    offlinePeople,
  }).size;
}

export async function computeDistinctEventParticipantCount(tx: ZeroTransaction, eventId: string) {
  const [participants, offlineParticipants] = await Promise.all([
    tx.run(zql.event_participant.where('event_id', eventId)),
    tx.run(zql.event_offline_participant.where('event_id', eventId)),
  ]);

  return buildDistinctPersonIds({
    activeUserIds: [...new Set(participants.map(participant => participant.user_id))],
    offlinePeople: offlineParticipants,
  }).size;
}

export async function getOfflineRosterMembersForGeneralAssembly(
  tx: ZeroTransaction,
  groupId: string
) {
  return loadOfflineRosterMembersForGroup(tx, groupId);
}

export function getDefaultOfflineParticipationChannel(args: {
  attendanceMode?: string | null;
  connectedUserId?: string | null;
}) {
  if (args.attendanceMode === 'hybrid') {
    return args.connectedUserId ? 'online' : 'offline';
  }

  return 'offline';
}

export async function getHybridOfflineOverrideUserIdsForEvent(
  tx: ZeroTransaction,
  eventId: string
) {
  const offlineParticipants = await tx.run(
    zql.event_offline_participant.where('event_id', eventId)
  );
  const userIds = new Set<string>();

  for (const participant of offlineParticipants) {
    if (participant.connected_user_id && participant.participation_channel === 'offline') {
      userIds.add(participant.connected_user_id);
    }
  }

  return userIds;
}

export async function getConfirmedOfflineAttendeeCount(tx: ZeroTransaction, eventId: string) {
  const offlineParticipants = await tx.run(
    zql.event_offline_participant.where('event_id', eventId)
  );

  return buildDistinctPersonIds({
    activeUserIds: [],
    offlinePeople: offlineParticipants.filter(
      participant =>
        participant.attendance_status === 'confirmed' &&
        participant.participation_channel === 'offline'
    ),
  }).size;
}

export async function eventAllowsOnlineVoting(tx: ZeroTransaction, eventId: string) {
  const event = await tx.run(zql.event.where('id', eventId).one());
  return event?.attendance_mode !== 'offline';
}

export async function isUserForcedOfflineForEvent(
  tx: ZeroTransaction,
  eventId: string,
  userId: string
) {
  const offlineParticipants = await tx.run(
    zql.event_offline_participant.where('event_id', eventId).where('connected_user_id', userId)
  );

  return offlineParticipants.some(participant => participant.participation_channel === 'offline');
}

export async function getEffectiveOnlineParticipantUserIdsForEvent(
  tx: ZeroTransaction,
  eventId: string
) {
  const [participants, forcedOfflineUserIds] = await Promise.all([
    tx.run(zql.event_participant.where('event_id', eventId)),
    getHybridOfflineOverrideUserIdsForEvent(tx, eventId),
  ]);

  return participants
    .filter(participant => isActiveEventStatus(participant.status))
    .map(participant => participant.user_id)
    .filter(userId => !forcedOfflineUserIds.has(userId));
}

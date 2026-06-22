import type { GroupConnectionListRow, GroupConnectionRequestListRow } from '@/zero/network/queries';
import {
  buildDerivedGroupNetworkMetaMap as buildZeroDerivedGroupNetworkMetaMap,
  getDefaultDerivedGroupNetworkMeta,
} from '@/zero/network/derived';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  GroupRelationshipType,
  NormalizedGroupRelationship,
} from '../types/network.types';

export type DerivedGroupNetworkMeta = ReturnType<typeof getDefaultDerivedGroupNetworkMeta>;
type NormalizableGroupConnection = Omit<GroupConnectionListRow, 'from_group' | 'to_group'> &
  Partial<Pick<GroupConnectionListRow, 'from_group' | 'to_group'>>;

function isActiveConnectionStatus(status: string | null | undefined) {
  return status === 'active';
}

function getRelationshipTypeForGroup(
  connection: Pick<
    GroupConnectionListRow,
    'connection_type' | 'parent_group_id' | 'child_group_id'
  >,
  groupId: string
): GroupRelationshipType {
  if (connection.connection_type === 'peer') {
    return 'sibling';
  }
  return connection.parent_group_id === groupId ? 'parent' : 'child';
}

function getMembershipFields(connection: NormalizableGroupConnection) {
  const rule = connection.membership_rule;
  const mode =
    rule?.membership_mode === 'all_members' ||
    rule?.membership_mode === 'role_members' ||
    rule?.membership_mode === 'selected_source_groups'
      ? rule.membership_mode
      : 'none';
  return {
    member_source_group_id: rule?.member_source_group_id ?? null,
    member_target_group_id: rule?.member_target_group_id ?? null,
    membership_mode: mode as CanonicalMembershipMode,
    required_source_role_id: rule?.required_source_role_id ?? null,
    required_source_role: rule?.required_source_role ?? null,
    eligible_origin_group_ids:
      rule?.origins
        ?.map(origin => origin.eligible_origin_group_id)
        .filter((id): id is string => Boolean(id)) ?? [],
  };
}

function groupForId(connection: NormalizableGroupConnection, groupId: string) {
  if (connection.group_a_id === groupId) {
    return connection.group_a ?? null;
  }
  if (connection.group_b_id === groupId) {
    return connection.group_b ?? null;
  }
  return null;
}

function structuralEndpoints(connection: NormalizableGroupConnection) {
  if (
    connection.connection_type === 'hierarchy' &&
    connection.parent_group_id &&
    connection.child_group_id
  ) {
    return {
      groupId: connection.parent_group_id,
      relatedGroupId: connection.child_group_id,
    };
  }
  return { groupId: connection.group_a_id, relatedGroupId: connection.group_b_id };
}

export function getSiblingMembershipKind(
  membershipMode: CanonicalMembershipMode | null | undefined
): 'open' | 'elected' | 'parliament' | null {
  switch (membershipMode) {
    case 'role_members':
      return 'elected';
    case 'selected_source_groups':
      return 'parliament';
    case 'none':
    case 'all_members':
      return 'open';
    default:
      return null;
  }
}

export function getCanonicalMembershipModeLabel(
  membershipMode: CanonicalMembershipMode | null | undefined
) {
  switch (membershipMode) {
    case 'all_members':
      return 'All active members';
    case 'role_members':
      return 'Members with selected role';
    case 'selected_source_groups':
      return 'Parliament membership';
    default:
      return 'No automatic membership';
  }
}

export function getCanonicalRelationshipTypeForGroup(
  connection: Pick<
    GroupConnectionListRow,
    'connection_type' | 'parent_group_id' | 'child_group_id' | 'group_a_id' | 'group_b_id'
  >,
  currentGroupId: string
): GroupRelationshipType | null {
  if (connection.group_a_id !== currentGroupId && connection.group_b_id !== currentGroupId) {
    return null;
  }
  return getRelationshipTypeForGroup(connection as GroupConnectionListRow, currentGroupId);
}

export function getRightDirectionFromGrantEndpoints(args: {
  currentGroupId: string;
  grant: { holder_group_id: string; scope_group_id: string };
}): Exclude<GroupRelationshipDirection, 'none' | 'mutual'> | null {
  if (args.grant.scope_group_id === args.currentGroupId) {
    return 'current_grants_right_to_partner';
  }
  if (args.grant.holder_group_id === args.currentGroupId) {
    return 'partner_grants_right_to_current';
  }
  return null;
}

export function deriveNormalizedGroupConnectionRelationships(
  connection: NormalizableGroupConnection
): NormalizedGroupRelationship[] {
  const membership = getMembershipFields(connection);
  const structure = structuralEndpoints(connection);
  const base = {
    connection_id: connection.id,
    connection_request_id: null,
    membership_request_id: null,
    connection_type:
      connection.connection_type === 'peer' ? ('peer' as const) : ('hierarchy' as const),
    parent_group_id: connection.parent_group_id ?? null,
    child_group_id: connection.child_group_id ?? null,
    ...membership,
  };
  const rows: NormalizedGroupRelationship[] = [
    {
      ...base,
      id: `${connection.id}:structure`,
      grant_id: null,
      request_item_kind: 'structure',
      group_id: structure.groupId,
      related_group_id: structure.relatedGroupId,
      relationship_type: getRelationshipTypeForGroup(connection, structure.groupId),
      with_right: null,
      status: connection.status ?? null,
      initiator_group_id: null,
      created_at: connection.created_at,
      group: groupForId(connection, structure.groupId),
      related_group: groupForId(connection, structure.relatedGroupId),
    },
  ];

  for (const grant of connection.grants ?? []) {
    rows.push({
      ...base,
      id: grant.id,
      grant_id: grant.id,
      request_item_kind: 'right',
      group_id: grant.holder_group_id,
      related_group_id: grant.scope_group_id,
      relationship_type: getRelationshipTypeForGroup(connection, grant.holder_group_id),
      with_right: grant.right_key,
      status: grant.status ?? null,
      initiator_group_id: grant.initiator_group_id ?? null,
      created_at: grant.created_at,
      group: grant.holder_group ?? groupForId(connection, grant.holder_group_id),
      related_group: grant.scope_group ?? groupForId(connection, grant.scope_group_id),
    });
  }
  return rows;
}

export function deriveNormalizedGroupRelationships(
  connections: readonly NormalizableGroupConnection[]
) {
  return connections.flatMap(deriveNormalizedGroupConnectionRelationships);
}

function requestGroupForId(request: GroupConnectionRequestListRow, groupId: string) {
  if (request.group_a_id === groupId) {
    return request.group_a ?? null;
  }
  if (request.group_b_id === groupId) {
    return request.group_b ?? null;
  }
  return null;
}

function getPrimaryMembershipRuleRequest(request: GroupConnectionRequestListRow) {
  const requests = request.membership_rule_requests ?? [];
  if (requests.length <= 1) {
    return requests[0] ?? null;
  }

  return [...requests].sort(
    (left, right) =>
      (right.updated_at ?? right.created_at ?? 0) - (left.updated_at ?? left.created_at ?? 0)
  )[0];
}

export function deriveNormalizedGroupConnectionRequestRelationships(
  request: GroupConnectionRequestListRow
): NormalizedGroupRelationship[] {
  const membershipRequest = getPrimaryMembershipRuleRequest(request);
  const membershipMode =
    membershipRequest?.membership_mode === 'all_members' ||
    membershipRequest?.membership_mode === 'role_members' ||
    membershipRequest?.membership_mode === 'selected_source_groups'
      ? membershipRequest.membership_mode
      : 'none';
  const sourceId =
    request.desired_connection_type === 'hierarchy'
      ? (request.desired_parent_group_id ?? request.group_a_id)
      : request.group_a_id;
  const targetId =
    request.desired_connection_type === 'hierarchy'
      ? (request.desired_child_group_id ?? request.group_b_id)
      : request.group_b_id;
  const base = {
    connection_id: request.active_connection_id ?? request.proposed_connection_id,
    connection_request_id: request.id,
    membership_request_id: null,
    connection_type:
      request.desired_connection_type === 'peer' ? ('peer' as const) : ('hierarchy' as const),
    parent_group_id: request.desired_parent_group_id ?? null,
    child_group_id: request.desired_child_group_id ?? null,
    member_source_group_id: membershipRequest?.member_source_group_id ?? null,
    member_target_group_id: membershipRequest?.member_target_group_id ?? null,
    membership_mode: membershipMode as CanonicalMembershipMode,
    required_source_role_id: membershipRequest?.required_source_role_id ?? null,
    required_source_role: membershipRequest?.required_source_role ?? null,
    eligible_origin_group_ids:
      membershipRequest?.origins
        ?.map(origin => origin.eligible_origin_group_id)
        .filter((id): id is string => Boolean(id)) ?? [],
  };
  const relationshipType = (groupId: string): GroupRelationshipType =>
    request.desired_connection_type === 'peer'
      ? 'sibling'
      : request.desired_parent_group_id === groupId
        ? 'parent'
        : 'child';
  const rows: NormalizedGroupRelationship[] = [
    {
      ...base,
      id: `${request.id}:structure`,
      grant_id: null,
      request_item_kind: 'structure',
      group_id: sourceId,
      related_group_id: targetId,
      relationship_type: relationshipType(sourceId),
      with_right: null,
      status: request.structure_status,
      initiator_group_id: request.initiator_group_id,
      created_at: request.created_at,
      group: requestGroupForId(request, sourceId),
      related_group: requestGroupForId(request, targetId),
    },
  ];

  if (
    membershipRequest &&
    membershipMode !== 'none' &&
    membershipRequest.member_source_group_id &&
    membershipRequest.member_target_group_id
  ) {
    const membershipSourceId = membershipRequest.member_source_group_id;
    const membershipTargetId = membershipRequest.member_target_group_id;
    rows.push({
      ...base,
      id: membershipRequest.id,
      grant_id: null,
      membership_request_id: membershipRequest.id,
      request_item_kind: 'membership',
      group_id: membershipSourceId,
      related_group_id: membershipTargetId,
      relationship_type: relationshipType(membershipSourceId),
      with_right: null,
      status: membershipRequest.status,
      initiator_group_id: request.initiator_group_id,
      created_at: membershipRequest.created_at ?? request.created_at,
      group: requestGroupForId(request, membershipSourceId),
      related_group: requestGroupForId(request, membershipTargetId),
    });
  }

  for (const grant of request.grant_requests ?? []) {
    rows.push({
      ...base,
      id: grant.id,
      grant_id: grant.id,
      request_item_kind: 'right',
      group_id: grant.holder_group_id,
      related_group_id: grant.scope_group_id,
      relationship_type: relationshipType(grant.holder_group_id),
      with_right: grant.right_key,
      status: grant.status,
      initiator_group_id: grant.initiator_group_id,
      created_at: grant.created_at,
      group: grant.holder_group ?? requestGroupForId(request, grant.holder_group_id),
      related_group: grant.scope_group ?? requestGroupForId(request, grant.scope_group_id),
    });
  }
  return rows;
}

export function deriveNormalizedGroupConnectionRequestRows(
  requests: readonly GroupConnectionRequestListRow[]
) {
  return requests.flatMap(deriveNormalizedGroupConnectionRequestRelationships);
}

export function buildDerivedGroupNetworkMetaMap(
  connections: readonly NormalizableGroupConnection[],
  explicitGroupIds?: readonly string[]
) {
  const groupIds = new Set(explicitGroupIds ?? []);
  for (const connection of connections) {
    groupIds.add(connection.group_a_id);
    groupIds.add(connection.group_b_id);
  }
  return buildZeroDerivedGroupNetworkMetaMap({
    groupIds: [...groupIds],
    connections,
    grants: connections.flatMap(connection => connection.grants ?? []),
    rules: connections.flatMap(connection =>
      connection.membership_rule ? [connection.membership_rule] : []
    ),
  });
}

export function getPrimaryConnectionForPair(args: {
  currentGroupId: string;
  otherGroupId: string;
  connections: readonly GroupConnectionListRow[];
  relationshipType?: GroupRelationshipType | null;
}) {
  return (
    [...args.connections]
      .filter(connection => {
        const touches =
          (connection.group_a_id === args.currentGroupId &&
            connection.group_b_id === args.otherGroupId) ||
          (connection.group_a_id === args.otherGroupId &&
            connection.group_b_id === args.currentGroupId);
        return (
          touches &&
          (!args.relationshipType ||
            getCanonicalRelationshipTypeForGroup(connection, args.currentGroupId) ===
              args.relationshipType)
        );
      })
      .sort(
        (left, right) =>
          (right.updated_at ?? right.created_at) - (left.updated_at ?? left.created_at)
      )[0] ?? null
  );
}

export function buildRightDirectionsForConnection(args: {
  currentGroupId: string;
  connection: {
    grants?:
      | readonly {
          right_key: string;
          holder_group_id: string;
          scope_group_id: string;
          status?: string | null;
        }[]
      | null;
  };
  includePending?: boolean;
}) {
  const directions: Record<string, GroupRelationshipDirection> = {
    informationRight: 'none',
    amendmentRight: 'none',
    rightToSpeak: 'none',
    activeVotingRight: 'none',
    passiveVotingRight: 'none',
  };
  for (const grant of args.connection.grants ?? []) {
    if (
      !isActiveConnectionStatus(grant.status) &&
      !(args.includePending && (grant.status === 'pending' || grant.status === 'requested'))
    ) {
      continue;
    }
    const relative = getRightDirectionFromGrantEndpoints({
      currentGroupId: args.currentGroupId,
      grant,
    });
    if (!relative) {
      continue;
    }
    const existing = directions[grant.right_key];
    directions[grant.right_key] =
      existing !== 'none' && existing !== relative ? 'mutual' : relative;
  }
  return directions;
}

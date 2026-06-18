import { normalizeMembershipRule } from './membershipRules';

export type NetworkStatusLike = string | null | undefined;

export interface GroupConnectionRowLike {
  id: string;
  group_a_id: string;
  group_b_id: string;
  connection_type: 'hierarchy' | 'peer' | string;
  parent_group_id?: string | null;
  child_group_id?: string | null;
  status?: NetworkStatusLike;
  created_at?: number | null;
  updated_at?: number | null;
}

export interface GroupRightGrantRowLike {
  id: string;
  connection_id: string;
  right_key: string;
  holder_group_id: string;
  scope_group_id: string;
  status?: NetworkStatusLike;
  initiator_group_id?: string | null;
  created_at?: number | null;
}

export interface GroupMembershipRuleRowLike {
  id: string;
  connection_id: string;
  member_source_group_id: string;
  member_target_group_id: string;
  membership_mode: 'all_members' | 'role_members' | 'selected_source_groups' | string;
  required_source_role_id?: string | null;
  origins?: readonly { eligible_origin_group_id?: string | null }[] | null;
}

export interface DerivedNetworkRelationshipRow {
  id: string;
  connection_id: string;
  grant_id: string | null;
  group_id: string;
  related_group_id: string;
  relationship_type: 'parent' | 'child' | 'sibling';
  with_right: string | null;
  status: string | null;
  initiator_group_id: string | null;
  created_at: number;
  connection_type: 'hierarchy' | 'peer';
  parent_group_id: string | null;
  child_group_id: string | null;
  member_source_group_id: string | null;
  member_target_group_id: string | null;
  membership_mode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  required_source_role_id: string | null;
  eligible_origin_group_ids: string[];
}

export interface DerivedGroupNetworkMeta {
  group_type: 'base' | 'hierarchical' | 'sibling';
  has_hierarchy_children: boolean;
  has_sibling_connections: boolean;
  connected_group_id: string | null;
  sibling_membership_mode: 'open' | 'elected' | 'parliament' | null;
  primary_sibling_membership_mode:
    | 'none'
    | 'all_members'
    | 'role_members'
    | 'selected_source_groups'
    | null;
  sibling_role_id: string | null;
  parliament_source_group_ids: string[];
  primary_incoming_sibling_membership_mode:
    | 'none'
    | 'all_members'
    | 'role_members'
    | 'selected_source_groups'
    | null;
  primary_outgoing_sibling_membership_mode:
    | 'none'
    | 'all_members'
    | 'role_members'
    | 'selected_source_groups'
    | null;
  incoming_sibling_role_id: string | null;
  outgoing_sibling_role_id: string | null;
  incoming_parliament_source_group_ids: string[];
  outgoing_parliament_source_group_ids: string[];
  primary_sibling_connection_id: string | null;
}

export function getDefaultDerivedGroupNetworkMeta(): DerivedGroupNetworkMeta {
  return {
    group_type: 'base',
    has_hierarchy_children: false,
    has_sibling_connections: false,
    connected_group_id: null,
    sibling_membership_mode: null,
    primary_sibling_membership_mode: null,
    sibling_role_id: null,
    parliament_source_group_ids: [],
    primary_incoming_sibling_membership_mode: null,
    primary_outgoing_sibling_membership_mode: null,
    incoming_sibling_role_id: null,
    outgoing_sibling_role_id: null,
    incoming_parliament_source_group_ids: [],
    outgoing_parliament_source_group_ids: [],
    primary_sibling_connection_id: null,
  };
}

export function isActiveNetworkStatus(status: NetworkStatusLike) {
  return status === 'active';
}

function getRelationshipType(
  connection: GroupConnectionRowLike,
  perspectiveGroupId: string
): DerivedNetworkRelationshipRow['relationship_type'] {
  if (connection.connection_type === 'peer') {
    return 'sibling';
  }
  return connection.parent_group_id === perspectiveGroupId ? 'parent' : 'child';
}

function getMembershipFields(rule?: GroupMembershipRuleRowLike | null) {
  const normalized = normalizeMembershipRule(rule);
  return {
    member_source_group_id: normalized?.member_source_group_id ?? null,
    member_target_group_id: normalized?.member_target_group_id ?? null,
    membership_mode: normalized?.membership_mode ?? ('none' as const),
    required_source_role_id: normalized?.required_source_role_id ?? null,
    eligible_origin_group_ids: normalized?.eligible_origin_group_ids ?? [],
  };
}

export function deriveGroupRelationships(args: {
  connections: readonly GroupConnectionRowLike[];
  grants: readonly GroupRightGrantRowLike[];
  rules: readonly GroupMembershipRuleRowLike[];
  includeInactive?: boolean;
}) {
  const includeInactive = args.includeInactive ?? true;
  const connectionsById = new Map(args.connections.map(connection => [connection.id, connection]));
  const rulesByConnectionId = new Map(args.rules.map(rule => [rule.connection_id, rule]));
  const rows: DerivedNetworkRelationshipRow[] = [];

  for (const connection of args.connections) {
    if (!includeInactive && !isActiveNetworkStatus(connection.status)) {
      continue;
    }

    const rule = rulesByConnectionId.get(connection.id);
    const sourceGroupId =
      connection.connection_type === 'hierarchy'
        ? (connection.parent_group_id ?? connection.group_a_id)
        : (rule?.member_source_group_id ?? connection.group_a_id);
    const targetGroupId =
      connection.connection_type === 'hierarchy'
        ? (connection.child_group_id ?? connection.group_b_id)
        : (rule?.member_target_group_id ?? connection.group_b_id);

    rows.push({
      id: `${connection.id}:structure`,
      connection_id: connection.id,
      grant_id: null,
      group_id: sourceGroupId,
      related_group_id: targetGroupId,
      relationship_type: getRelationshipType(connection, sourceGroupId),
      with_right: null,
      status: (connection.status ?? null) as string | null,
      initiator_group_id: null,
      created_at: connection.created_at ?? Date.now(),
      connection_type: connection.connection_type === 'peer' ? 'peer' : 'hierarchy',
      parent_group_id: connection.parent_group_id ?? null,
      child_group_id: connection.child_group_id ?? null,
      ...getMembershipFields(rule),
    });
  }

  for (const grant of args.grants) {
    const connection = connectionsById.get(grant.connection_id);
    if (!connection) {
      continue;
    }
    if (
      !includeInactive &&
      (!isActiveNetworkStatus(connection.status) || !isActiveNetworkStatus(grant.status))
    ) {
      continue;
    }

    rows.push({
      id: grant.id,
      connection_id: connection.id,
      grant_id: grant.id,
      group_id: grant.holder_group_id,
      related_group_id: grant.scope_group_id,
      relationship_type: getRelationshipType(connection, grant.holder_group_id),
      with_right: grant.right_key,
      status: (grant.status ?? connection.status ?? null) as string | null,
      initiator_group_id: grant.initiator_group_id ?? null,
      created_at: grant.created_at ?? connection.created_at ?? Date.now(),
      connection_type: connection.connection_type === 'peer' ? 'peer' : 'hierarchy',
      parent_group_id: connection.parent_group_id ?? null,
      child_group_id: connection.child_group_id ?? null,
      ...getMembershipFields(rulesByConnectionId.get(connection.id)),
    });
  }

  return rows;
}

function toSiblingMembershipKind(
  mode: DerivedNetworkRelationshipRow['membership_mode']
): 'open' | 'elected' | 'parliament' | null {
  switch (mode) {
    case 'role_members':
      return 'elected';
    case 'selected_source_groups':
      return 'parliament';
    case 'all_members':
      return 'open';
    default:
      return null;
  }
}

function uniqueStrings(values: readonly (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildDerivedGroupNetworkMetaMap(args: {
  groupIds: readonly string[];
  connections?: readonly GroupConnectionRowLike[];
  grants?: readonly GroupRightGrantRowLike[];
  rules: readonly GroupMembershipRuleRowLike[];
}) {
  const connections = args.connections ?? [];
  const rulesByConnectionId = new Map(args.rules.map(rule => [rule.connection_id, rule]));
  const result = new Map<string, DerivedGroupNetworkMeta>();

  for (const groupId of args.groupIds) {
    const meta = getDefaultDerivedGroupNetworkMeta();
    const activeConnections = connections.filter(
      connection =>
        isActiveNetworkStatus(connection.status) &&
        (connection.group_a_id === groupId || connection.group_b_id === groupId)
    );

    meta.has_hierarchy_children = activeConnections.some(
      connection =>
        connection.connection_type === 'hierarchy' && connection.parent_group_id === groupId
    );

    if (meta.has_hierarchy_children) {
      meta.group_type = 'hierarchical';
    }

    const peerConnections = activeConnections.filter(
      connection => connection.connection_type === 'peer'
    );
    meta.has_sibling_connections = peerConnections.length > 0;

    const sortedPeerConnections = [...peerConnections].sort(
      (left, right) =>
        (right.updated_at ?? right.created_at ?? 0) - (left.updated_at ?? left.created_at ?? 0)
    );
    const peerConnection = sortedPeerConnections[0];

    if (peerConnection) {
      const peerMembershipContexts = sortedPeerConnections.map(connection => ({
        connection,
        rule: normalizeMembershipRule(rulesByConnectionId.get(connection.id)),
      }));
      const primaryIncomingContext =
        peerMembershipContexts.find(context => context.rule?.member_target_group_id === groupId) ??
        null;
      const primaryOutgoingContext =
        peerMembershipContexts.find(context => context.rule?.member_source_group_id === groupId) ??
        null;
      const incomingParliamentSourceGroupIds = uniqueStrings(
        peerMembershipContexts.flatMap(context =>
          context.rule?.member_target_group_id === groupId &&
          context.rule.membership_mode === 'selected_source_groups'
            ? context.rule.eligible_origin_group_ids
            : []
        )
      );
      const outgoingParliamentSourceGroupIds = uniqueStrings(
        peerMembershipContexts.flatMap(context =>
          context.rule?.member_source_group_id === groupId &&
          context.rule.membership_mode === 'selected_source_groups'
            ? context.rule.eligible_origin_group_ids
            : []
        )
      );

      if (!meta.has_hierarchy_children) {
        meta.group_type = 'sibling';
      }
      meta.primary_sibling_connection_id = peerConnection.id;
      meta.connected_group_id =
        peerConnection.group_a_id === groupId
          ? peerConnection.group_b_id
          : peerConnection.group_a_id;
      meta.primary_incoming_sibling_membership_mode = primaryIncomingContext
        ? (primaryIncomingContext.rule?.membership_mode ?? 'none')
        : 'none';
      meta.primary_outgoing_sibling_membership_mode = primaryOutgoingContext
        ? (primaryOutgoingContext.rule?.membership_mode ?? 'none')
        : 'none';
      meta.primary_sibling_membership_mode = meta.primary_incoming_sibling_membership_mode;
      meta.sibling_membership_mode = toSiblingMembershipKind(
        meta.primary_incoming_sibling_membership_mode
      );
      meta.incoming_sibling_role_id = primaryIncomingContext
        ? (primaryIncomingContext.rule?.required_source_role_id ?? null)
        : null;
      meta.outgoing_sibling_role_id = primaryOutgoingContext
        ? (primaryOutgoingContext.rule?.required_source_role_id ?? null)
        : null;
      meta.sibling_role_id = meta.incoming_sibling_role_id;
      meta.incoming_parliament_source_group_ids = incomingParliamentSourceGroupIds;
      meta.outgoing_parliament_source_group_ids = outgoingParliamentSourceGroupIds;
      meta.parliament_source_group_ids = meta.incoming_parliament_source_group_ids;
    }

    result.set(groupId, meta);
  }

  return result;
}

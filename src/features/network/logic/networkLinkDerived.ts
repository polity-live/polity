import type { NetworkLinkChangeRequestListRow, NetworkLinkListRow } from '@/zero/network/queries';
import type {
  CanonicalMembershipMode,
  CanonicalNetworkLinkDirection,
  GroupRelationshipDirection,
  GroupRelationshipType,
  NormalizedGroupRelationship,
} from '../types/network.types';
import {
  getMembershipRuleConfig,
  hasActiveMembershipRules,
  normalizeMembershipRules,
} from '@/zero/network/membershipRules';

export interface DerivedGroupNetworkMeta {
  group_type: 'base' | 'hierarchical' | 'sibling';
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
  primary_sibling_link_id: string | null;
}

function isDirectionActive(direction: CanonicalNetworkLinkDirection, side: 'forward' | 'backward') {
  return direction === side || direction === 'bidirectional';
}

function isAcceptedNetworkStatus(status: string | null | undefined) {
  return status == null || status === 'active' || status === 'accepted';
}

function getDefaultDerivedGroupNetworkMeta(): DerivedGroupNetworkMeta {
  return {
    group_type: 'base',
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
    primary_sibling_link_id: null,
  };
}

function getIncomingMembershipRuleForGroup(args: {
  groupId: string;
  link: Pick<NetworkLinkListRow, 'source_group_id' | 'target_group_id'>;
  membershipRule: NetworkLinkListRow['membership_rule'];
}) {
  return getMembershipRuleConfig(
    args.membershipRule,
    args.link.source_group_id === args.groupId ? 'backward' : 'forward'
  );
}

function getOutgoingMembershipRuleForGroup(args: {
  groupId: string;
  link: Pick<NetworkLinkListRow, 'source_group_id' | 'target_group_id'>;
  membershipRule: NetworkLinkListRow['membership_rule'];
}) {
  return getMembershipRuleConfig(
    args.membershipRule,
    args.link.source_group_id === args.groupId ? 'forward' : 'backward'
  );
}

export function getLegacySiblingMembershipMode(
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
      return 'All members';
    case 'role_members':
      return 'Role members';
    case 'selected_source_groups':
      return 'Selected source groups';
    case 'none':
    default:
      return 'None';
  }
}

export function getCanonicalRelationshipTypeForGroup(
  link: Pick<NetworkLinkListRow, 'structural_relation' | 'source_group_id' | 'target_group_id'>,
  currentGroupId: string
): GroupRelationshipType | null {
  if (link.structural_relation === 'sibling') {
    return link.source_group_id === currentGroupId || link.target_group_id === currentGroupId
      ? 'sibling'
      : null;
  }

  if (link.source_group_id === currentGroupId) {
    return 'parent';
  }

  if (link.target_group_id === currentGroupId) {
    return 'child';
  }

  return null;
}

export function getRelativeRightDirectionForGroup(args: {
  currentGroupId: string;
  link: Pick<NetworkLinkListRow, 'source_group_id' | 'target_group_id'>;
  rightDirection: CanonicalNetworkLinkDirection;
}): GroupRelationshipDirection {
  const isSourcePerspective = args.link.source_group_id === args.currentGroupId;

  if (args.rightDirection === 'bidirectional') {
    return 'bidirectional';
  }

  if (isSourcePerspective) {
    return args.rightDirection === 'forward' ? 'outgoing' : 'incoming';
  }

  return args.rightDirection === 'forward' ? 'incoming' : 'outgoing';
}

export function explodeNetworkLinkToRelationships(
  link: NetworkLinkListRow
): NormalizedGroupRelationship[] {
  const membershipRules = normalizeMembershipRules(link.membership_rule);
  const rows: NormalizedGroupRelationship[] = [];

  for (const right of link.rights ?? []) {
    const baseRow = {
      network_link_id: link.id,
      network_link_right_id: right.id,
      structural_relation: link.structural_relation as 'parent_child' | 'sibling',
      with_right: right.right_key ?? null,
      status: right.status ?? null,
      initiator_group_id: right.initiator_group_id ?? null,
      created_at: right.created_at ?? link.created_at,
      right_direction: right.direction as CanonicalNetworkLinkDirection,
    };

    if (isDirectionActive(baseRow.right_direction, 'forward')) {
      rows.push({
        ...baseRow,
        id: `${right.id}:forward`,
        membership_mode: membershipRules.forward.membership_mode as CanonicalMembershipMode,
        group_id: link.source_group_id,
        related_group_id: link.target_group_id,
        relationship_type:
          link.structural_relation === 'sibling' ? 'sibling' : ('child' as GroupRelationshipType),
        group: link.source_group ?? null,
        related_group: link.target_group ?? null,
      });
    }

    if (isDirectionActive(baseRow.right_direction, 'backward')) {
      rows.push({
        ...baseRow,
        id: `${right.id}:backward`,
        membership_mode: membershipRules.backward.membership_mode as CanonicalMembershipMode,
        group_id: link.target_group_id,
        related_group_id: link.source_group_id,
        relationship_type:
          link.structural_relation === 'sibling' ? 'sibling' : ('parent' as GroupRelationshipType),
        group: link.target_group ?? null,
        related_group: link.source_group ?? null,
      });
    }
  }

  if (rows.length === 0 && hasActiveMembershipRules(membershipRules)) {
    rows.push({
      id: `${link.id}:structural:forward`,
      network_link_id: link.id,
      network_link_right_id: `${link.id}:structural`,
      structural_relation: link.structural_relation as 'parent_child' | 'sibling',
      with_right: null,
      status: link.status ?? null,
      initiator_group_id: null,
      created_at: link.created_at,
      membership_mode: membershipRules.forward.membership_mode as CanonicalMembershipMode,
      right_direction: 'forward',
      group_id: link.source_group_id,
      related_group_id: link.target_group_id,
      relationship_type:
        link.structural_relation === 'sibling' ? 'sibling' : ('child' as GroupRelationshipType),
      group: link.source_group ?? null,
      related_group: link.target_group ?? null,
    });
    rows.push({
      id: `${link.id}:structural:backward`,
      network_link_id: link.id,
      network_link_right_id: `${link.id}:structural`,
      structural_relation: link.structural_relation as 'parent_child' | 'sibling',
      with_right: null,
      status: link.status ?? null,
      initiator_group_id: null,
      created_at: link.created_at,
      membership_mode: membershipRules.backward.membership_mode as CanonicalMembershipMode,
      right_direction: 'backward',
      group_id: link.target_group_id,
      related_group_id: link.source_group_id,
      relationship_type:
        link.structural_relation === 'sibling' ? 'sibling' : ('parent' as GroupRelationshipType),
      group: link.target_group ?? null,
      related_group: link.source_group ?? null,
    });
  }

  return rows;
}

export function explodeNetworkLinksToRelationships(links: readonly NetworkLinkListRow[]) {
  return links.flatMap(link => explodeNetworkLinkToRelationships(link));
}

export function explodeNetworkLinkChangeRequestToRelationships(
  request: NetworkLinkChangeRequestListRow
): NormalizedGroupRelationship[] {
  const membershipRules = normalizeMembershipRules(
    request.desired_membership_rules ?? {
      membership_mode: request.desired_membership_mode,
      role_id: request.desired_role_id ?? null,
      source_group_ids: request.desired_source_group_ids ?? null,
    }
  );
  const rows: NormalizedGroupRelationship[] = [];

  for (const right of request.desired_rights ?? []) {
    const baseRow = {
      network_link_id: request.proposed_network_link_id,
      network_link_right_id: right.id,
      network_link_request_id: request.id,
      structural_relation: request.structural_relation as 'parent_child' | 'sibling',
      with_right: right.right_key ?? null,
      status: request.status ?? 'requested',
      initiator_group_id: request.initiator_group_id ?? null,
      created_at: request.created_at ?? Date.now(),
      right_direction: right.direction as CanonicalNetworkLinkDirection,
    };

    if (isDirectionActive(baseRow.right_direction, 'forward')) {
      rows.push({
        ...baseRow,
        id: `${request.id}:${right.id}:forward`,
        membership_mode: membershipRules.forward.membership_mode as CanonicalMembershipMode,
        group_id: request.source_group_id,
        related_group_id: request.target_group_id,
        relationship_type:
          request.structural_relation === 'sibling'
            ? 'sibling'
            : ('child' as GroupRelationshipType),
        group: request.source_group ?? null,
        related_group: request.target_group ?? null,
      });
    }

    if (isDirectionActive(baseRow.right_direction, 'backward')) {
      rows.push({
        ...baseRow,
        id: `${request.id}:${right.id}:backward`,
        membership_mode: membershipRules.backward.membership_mode as CanonicalMembershipMode,
        group_id: request.target_group_id,
        related_group_id: request.source_group_id,
        relationship_type:
          request.structural_relation === 'sibling'
            ? 'sibling'
            : ('parent' as GroupRelationshipType),
        group: request.target_group ?? null,
        related_group: request.source_group ?? null,
      });
    }
  }

  if (rows.length === 0 && hasActiveMembershipRules(membershipRules)) {
    rows.push({
      id: `${request.id}:structural:forward`,
      network_link_id: request.proposed_network_link_id,
      network_link_right_id: `${request.proposed_network_link_id}:structural`,
      network_link_request_id: request.id,
      structural_relation: request.structural_relation as 'parent_child' | 'sibling',
      with_right: null,
      status: request.status ?? 'requested',
      initiator_group_id: request.initiator_group_id ?? null,
      created_at: request.created_at ?? Date.now(),
      membership_mode: membershipRules.forward.membership_mode as CanonicalMembershipMode,
      right_direction: 'forward',
      group_id: request.source_group_id,
      related_group_id: request.target_group_id,
      relationship_type:
        request.structural_relation === 'sibling' ? 'sibling' : ('child' as GroupRelationshipType),
      group: request.source_group ?? null,
      related_group: request.target_group ?? null,
    });
    rows.push({
      id: `${request.id}:structural:backward`,
      network_link_id: request.proposed_network_link_id,
      network_link_right_id: `${request.proposed_network_link_id}:structural`,
      network_link_request_id: request.id,
      structural_relation: request.structural_relation as 'parent_child' | 'sibling',
      with_right: null,
      status: request.status ?? 'requested',
      initiator_group_id: request.initiator_group_id ?? null,
      created_at: request.created_at ?? Date.now(),
      membership_mode: membershipRules.backward.membership_mode as CanonicalMembershipMode,
      right_direction: 'backward',
      group_id: request.target_group_id,
      related_group_id: request.source_group_id,
      relationship_type:
        request.structural_relation === 'sibling' ? 'sibling' : ('parent' as GroupRelationshipType),
      group: request.target_group ?? null,
      related_group: request.source_group ?? null,
    });
  }

  return rows;
}

export function explodeNetworkLinkChangeRequestsToRelationships(
  requests: readonly NetworkLinkChangeRequestListRow[]
) {
  return requests.flatMap(request => explodeNetworkLinkChangeRequestToRelationships(request));
}

export function buildDerivedGroupNetworkMetaMap(
  links: readonly NetworkLinkListRow[],
  explicitGroupIds?: readonly string[]
) {
  const groupIds = new Set<string>(explicitGroupIds ?? []);

  for (const link of links) {
    groupIds.add(link.source_group_id);
    groupIds.add(link.target_group_id);
  }

  const result = new Map<string, DerivedGroupNetworkMeta>();

  for (const groupId of groupIds) {
    const meta = getDefaultDerivedGroupNetworkMeta();
    const activeLinks = links.filter(link => {
      if (link.source_group_id !== groupId && link.target_group_id !== groupId) {
        return false;
      }

      const activeRights = (link.rights ?? []).filter(right =>
        isAcceptedNetworkStatus(right.status)
      );
      const hasActiveMembership = hasActiveMembershipRules(link.membership_rule);
      return (
        isAcceptedNetworkStatus(link.status) && (activeRights.length > 0 || hasActiveMembership)
      );
    });

    const siblingLinks = [...activeLinks]
      .filter(link => link.structural_relation === 'sibling')
      .sort(
        (left, right) =>
          (right.updated_at ?? right.created_at ?? 0) - (left.updated_at ?? left.created_at ?? 0)
      );
    const primarySiblingLink = siblingLinks[0] ?? null;

    if (primarySiblingLink) {
      const incomingRule = getIncomingMembershipRuleForGroup({
        groupId,
        link: primarySiblingLink,
        membershipRule: primarySiblingLink.membership_rule,
      });
      const outgoingRule = getOutgoingMembershipRuleForGroup({
        groupId,
        link: primarySiblingLink,
        membershipRule: primarySiblingLink.membership_rule,
      });

      meta.group_type = 'sibling';
      meta.primary_sibling_link_id = primarySiblingLink.id;
      meta.connected_group_id =
        primarySiblingLink.source_group_id === groupId
          ? primarySiblingLink.target_group_id
          : primarySiblingLink.source_group_id;
      meta.primary_sibling_membership_mode = incomingRule.membership_mode;
      meta.sibling_membership_mode = getLegacySiblingMembershipMode(incomingRule.membership_mode);
      meta.sibling_role_id = incomingRule.role_id ?? null;
      meta.parliament_source_group_ids = [...new Set(incomingRule.source_group_ids ?? [])];
      meta.primary_incoming_sibling_membership_mode = incomingRule.membership_mode;
      meta.primary_outgoing_sibling_membership_mode = outgoingRule.membership_mode;
      meta.incoming_sibling_role_id = incomingRule.role_id ?? null;
      meta.outgoing_sibling_role_id = outgoingRule.role_id ?? null;
      meta.incoming_parliament_source_group_ids = [...new Set(incomingRule.source_group_ids ?? [])];
      meta.outgoing_parliament_source_group_ids = [...new Set(outgoingRule.source_group_ids ?? [])];
      result.set(groupId, meta);
      continue;
    }

    const hasOutgoingHierarchy = activeLinks.some(link => {
      if (link.structural_relation !== 'parent_child') {
        return false;
      }

      const relationshipRows = explodeNetworkLinkToRelationships(link).filter(
        row => row.group_id === groupId
      );

      return relationshipRows.some(
        relationshipRow =>
          relationshipRow.relationship_type === 'child' &&
          isAcceptedNetworkStatus(relationshipRow.status)
      );
    });

    if (hasOutgoingHierarchy) {
      meta.group_type = 'hierarchical';
    }

    result.set(groupId, meta);
  }

  return result;
}

export function getPrimaryLinkForPair(args: {
  currentGroupId: string;
  otherGroupId: string;
  links: readonly NetworkLinkListRow[];
  relationshipType?: GroupRelationshipType | null;
}) {
  const matchingLinks = args.links.filter(link => {
    const touchesPair =
      (link.source_group_id === args.currentGroupId &&
        link.target_group_id === args.otherGroupId) ||
      (link.source_group_id === args.otherGroupId && link.target_group_id === args.currentGroupId);

    if (!touchesPair) {
      return false;
    }

    if (!args.relationshipType) {
      return true;
    }

    return (
      getCanonicalRelationshipTypeForGroup(link, args.currentGroupId) === args.relationshipType
    );
  });

  return (
    [...matchingLinks].sort((left, right) => {
      if (left.updated_at !== right.updated_at) {
        return (right.updated_at ?? 0) - (left.updated_at ?? 0);
      }

      return right.id.localeCompare(left.id);
    })[0] ?? null
  );
}

export function buildRightDirectionsForLink(args: {
  currentGroupId: string;
  link: Pick<NetworkLinkListRow, 'source_group_id' | 'target_group_id' | 'rights'>;
}) {
  const directions: Record<string, GroupRelationshipDirection> = {
    informationRight: 'none',
    amendmentRight: 'none',
    rightToSpeak: 'none',
    activeVotingRight: 'none',
    passiveVotingRight: 'none',
  };

  for (const right of args.link.rights ?? []) {
    directions[right.right_key] = getRelativeRightDirectionForGroup({
      currentGroupId: args.currentGroupId,
      link: args.link,
      rightDirection: right.direction as CanonicalNetworkLinkDirection,
    });
  }

  return directions;
}

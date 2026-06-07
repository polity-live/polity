import { getHierarchyRelationshipPair } from '@/features/network/logic/groupRelationshipOrientation';
import {
  getMembershipRuleConfig,
  hasActiveMembershipRules,
  normalizeMembershipRules,
} from './membershipRules';

export type NetworkLinkStatusLike = string | null | undefined;

export interface NetworkLinkRowLike {
  id: string;
  source_group_id: string;
  target_group_id: string;
  structural_relation: 'parent_child' | 'sibling' | string;
  status?: NetworkLinkStatusLike;
  created_at?: number | null;
  updated_at?: number | null;
}

export interface NetworkLinkRightRowLike {
  id: string;
  network_link_id: string;
  right_key: string;
  direction: 'forward' | 'backward' | 'bidirectional' | string;
  status?: NetworkLinkStatusLike;
  initiator_group_id?: string | null;
  created_at?: number | null;
}

export interface NetworkLinkMembershipRuleRowLike {
  id: string;
  network_link_id: string;
  membership_direction?: 'forward' | 'backward' | string | null;
  membership_mode?:
    | 'none'
    | 'all_members'
    | 'role_members'
    | 'selected_source_groups'
    | string
    | null;
  role_id?: string | null;
  source_group_ids?: string[] | null;
}

export interface DerivedNetworkRelationshipRow {
  id: string;
  network_link_id: string;
  network_link_right_id: string;
  group_id: string;
  related_group_id: string;
  relationship_type: 'parent' | 'child' | 'sibling';
  with_right: string | null;
  status: string | null;
  initiator_group_id: string | null;
  created_at: number;
  structural_relation: 'parent_child' | 'sibling';
  membership_mode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  membership_direction?: 'forward' | 'backward' | null;
  membership_role_id?: string | null;
  membership_source_group_ids?: string[] | null;
  relationship_direction?: 'forward' | 'backward';
  right_direction: 'forward' | 'backward' | 'bidirectional';
}

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

export function getDefaultDerivedGroupNetworkMeta(): DerivedGroupNetworkMeta {
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

function isActiveStatus(status: NetworkLinkStatusLike) {
  return status == null || status === 'active' || status === 'accepted';
}

function isAllowedDirection(
  direction: string
): direction is 'forward' | 'backward' | 'bidirectional' {
  return direction === 'forward' || direction === 'backward' || direction === 'bidirectional';
}

function toLegacySiblingMembershipMode(
  membershipMode: NetworkLinkMembershipRuleRowLike['membership_mode']
): 'open' | 'elected' | 'parliament' | null {
  switch (membershipMode) {
    case 'role_members':
      return 'elected';
    case 'selected_source_groups':
      return 'parliament';
    case 'all_members':
    case 'none':
      return 'open';
    default:
      return null;
  }
}

function getIncomingMembershipRuleForGroup(args: {
  groupId: string;
  link: Pick<NetworkLinkRowLike, 'source_group_id' | 'target_group_id'>;
  membershipRule: NetworkLinkMembershipRuleRowLike | null | undefined;
}) {
  return getMembershipRuleConfig(
    args.membershipRule,
    args.link.source_group_id === args.groupId ? 'backward' : 'forward'
  );
}

function getOutgoingMembershipRuleForGroup(args: {
  groupId: string;
  link: Pick<NetworkLinkRowLike, 'source_group_id' | 'target_group_id'>;
  membershipRule: NetworkLinkMembershipRuleRowLike | null | undefined;
}) {
  return getMembershipRuleConfig(
    args.membershipRule,
    args.link.source_group_id === args.groupId ? 'forward' : 'backward'
  );
}

function getRelationshipType(args: {
  structuralRelation: string;
  sourceDirection: 'forward' | 'backward';
}): 'parent' | 'child' | 'sibling' {
  if (args.structuralRelation === 'sibling') {
    return 'sibling';
  }

  return args.sourceDirection === 'forward' ? 'child' : 'parent';
}

export function explodeNetworkLinksToRelationships(args: {
  links: readonly NetworkLinkRowLike[];
  rights: readonly NetworkLinkRightRowLike[];
  rules: readonly NetworkLinkMembershipRuleRowLike[];
  includeInactive?: boolean;
}) {
  const includeInactive = args.includeInactive ?? true;
  const rightsByLinkId = new Map<string, NetworkLinkRightRowLike[]>();
  const rulesByLinkId = new Map<string, NetworkLinkMembershipRuleRowLike>();

  for (const right of args.rights) {
    const rightList = rightsByLinkId.get(right.network_link_id) ?? [];
    rightList.push(right);
    rightsByLinkId.set(right.network_link_id, rightList);
  }

  for (const rule of args.rules) {
    rulesByLinkId.set(rule.network_link_id, rule);
  }

  const rows: DerivedNetworkRelationshipRow[] = [];

  for (const link of args.links) {
    const rule = rulesByLinkId.get(link.id);
    const normalizedMembershipRule = normalizeMembershipRules(rule);
    const linkRows: DerivedNetworkRelationshipRow[] = [];

    for (const right of rightsByLinkId.get(link.id) ?? []) {
      if (!isAllowedDirection(right.direction)) {
        continue;
      }

      if (!includeInactive && !(isActiveStatus(link.status) && isActiveStatus(right.status))) {
        continue;
      }

      const createdAt = right.created_at ?? link.created_at ?? Date.now();

      if (right.direction === 'forward' || right.direction === 'bidirectional') {
        linkRows.push({
          id: `${right.id}:forward`,
          network_link_id: link.id,
          network_link_right_id: right.id,
          group_id: link.source_group_id,
          related_group_id: link.target_group_id,
          relationship_type: getRelationshipType({
            structuralRelation: link.structural_relation,
            sourceDirection: 'forward',
          }),
          with_right: right.right_key ?? null,
          status: (right.status ?? link.status ?? null) as string | null,
          initiator_group_id: right.initiator_group_id ?? null,
          created_at: createdAt,
          structural_relation: link.structural_relation === 'sibling' ? 'sibling' : 'parent_child',
          membership_mode: normalizedMembershipRule.membership_mode,
          membership_direction: normalizedMembershipRule.membership_direction,
          membership_role_id: normalizedMembershipRule.role_id ?? null,
          membership_source_group_ids: normalizedMembershipRule.source_group_ids ?? null,
          relationship_direction: 'forward',
          right_direction: right.direction,
        });
      }

      if (right.direction === 'backward' || right.direction === 'bidirectional') {
        linkRows.push({
          id: `${right.id}:backward`,
          network_link_id: link.id,
          network_link_right_id: right.id,
          group_id: link.target_group_id,
          related_group_id: link.source_group_id,
          relationship_type: getRelationshipType({
            structuralRelation: link.structural_relation,
            sourceDirection: 'backward',
          }),
          with_right: right.right_key ?? null,
          status: (right.status ?? link.status ?? null) as string | null,
          initiator_group_id: right.initiator_group_id ?? null,
          created_at: createdAt,
          structural_relation: link.structural_relation === 'sibling' ? 'sibling' : 'parent_child',
          membership_mode: normalizedMembershipRule.membership_mode,
          membership_direction: normalizedMembershipRule.membership_direction,
          membership_role_id: normalizedMembershipRule.role_id ?? null,
          membership_source_group_ids: normalizedMembershipRule.source_group_ids ?? null,
          relationship_direction: 'backward',
          right_direction: right.direction,
        });
      }
    }

    if (linkRows.length === 0 && hasActiveMembershipRules(rule)) {
      const createdAt = link.created_at ?? Date.now();

      linkRows.push({
        id: `${link.id}:structural:forward`,
        network_link_id: link.id,
        network_link_right_id: `${link.id}:structural`,
        group_id: link.source_group_id,
        related_group_id: link.target_group_id,
        relationship_type: getRelationshipType({
          structuralRelation: link.structural_relation,
          sourceDirection: 'forward',
        }),
        with_right: null,
        status: (link.status ?? null) as string | null,
        initiator_group_id: null,
        created_at: createdAt,
        structural_relation: link.structural_relation === 'sibling' ? 'sibling' : 'parent_child',
        membership_mode: normalizedMembershipRule.membership_mode,
        membership_direction: normalizedMembershipRule.membership_direction,
        membership_role_id: normalizedMembershipRule.role_id ?? null,
        membership_source_group_ids: normalizedMembershipRule.source_group_ids ?? null,
        relationship_direction: 'forward',
        right_direction: 'forward',
      });

      linkRows.push({
        id: `${link.id}:structural:backward`,
        network_link_id: link.id,
        network_link_right_id: `${link.id}:structural`,
        group_id: link.target_group_id,
        related_group_id: link.source_group_id,
        relationship_type: getRelationshipType({
          structuralRelation: link.structural_relation,
          sourceDirection: 'backward',
        }),
        with_right: null,
        status: (link.status ?? null) as string | null,
        initiator_group_id: null,
        created_at: createdAt,
        structural_relation: link.structural_relation === 'sibling' ? 'sibling' : 'parent_child',
        membership_mode: normalizedMembershipRule.membership_mode,
        membership_direction: normalizedMembershipRule.membership_direction,
        membership_role_id: normalizedMembershipRule.role_id ?? null,
        membership_source_group_ids: normalizedMembershipRule.source_group_ids ?? null,
        relationship_direction: 'backward',
        right_direction: 'backward',
      });
    }

    rows.push(...linkRows);
  }

  return rows;
}

export function buildDerivedGroupNetworkMetaMap(args: {
  groupIds: readonly string[];
  links: readonly NetworkLinkRowLike[];
  rights: readonly NetworkLinkRightRowLike[];
  rules: readonly NetworkLinkMembershipRuleRowLike[];
}) {
  const rightsByLinkId = new Map<string, NetworkLinkRightRowLike[]>();
  const rulesByLinkId = new Map<string, NetworkLinkMembershipRuleRowLike>();

  for (const right of args.rights) {
    const rightList = rightsByLinkId.get(right.network_link_id) ?? [];
    rightList.push(right);
    rightsByLinkId.set(right.network_link_id, rightList);
  }

  for (const rule of args.rules) {
    rulesByLinkId.set(rule.network_link_id, rule);
  }

  const result = new Map<string, DerivedGroupNetworkMeta>();

  for (const groupId of args.groupIds) {
    const meta = getDefaultDerivedGroupNetworkMeta();
    const activeLinks = args.links.filter(link => {
      if (link.source_group_id !== groupId && link.target_group_id !== groupId) {
        return false;
      }

      const linkRights = rightsByLinkId.get(link.id) ?? [];
      const hasActiveRight = linkRights.some(right => isActiveStatus(right.status));
      return (
        isActiveStatus(link.status) &&
        (hasActiveRight || hasActiveMembershipRules(rulesByLinkId.get(link.id)))
      );
    });

    const siblingLinks = activeLinks
      .filter(link => link.structural_relation === 'sibling')
      .sort(
        (left, right) =>
          (right.updated_at ?? right.created_at ?? 0) - (left.updated_at ?? left.created_at ?? 0)
      );
    const primarySiblingLink = siblingLinks[0] ?? null;
    const primaryRule = primarySiblingLink
      ? (rulesByLinkId.get(primarySiblingLink.id) ?? null)
      : null;

    if (primarySiblingLink) {
      const incomingRule = getIncomingMembershipRuleForGroup({
        groupId,
        link: primarySiblingLink,
        membershipRule: primaryRule,
      });
      const outgoingRule = getOutgoingMembershipRuleForGroup({
        groupId,
        link: primarySiblingLink,
        membershipRule: primaryRule,
      });

      meta.group_type = 'sibling';
      meta.primary_sibling_link_id = primarySiblingLink.id;
      meta.connected_group_id =
        primarySiblingLink.source_group_id === groupId
          ? primarySiblingLink.target_group_id
          : primarySiblingLink.source_group_id;
      meta.primary_sibling_membership_mode = incomingRule.membership_mode;
      meta.sibling_membership_mode = toLegacySiblingMembershipMode(incomingRule.membership_mode);
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
      if (link.structural_relation !== 'parent_child' || link.source_group_id !== groupId) {
        return false;
      }

      const rule = rulesByLinkId.get(link.id);

      const relationshipRows = explodeNetworkLinksToRelationships({
        links: [link],
        rights: rightsByLinkId.get(link.id) ?? [],
        rules: rule == null ? [] : [rule],
        includeInactive: false,
      });

      return relationshipRows.some(row => {
        const pair = getHierarchyRelationshipPair(row);
        return pair?.parentGroupId === groupId;
      });
    });

    if (hasOutgoingHierarchy) {
      meta.group_type = 'hierarchical';
    }

    result.set(groupId, meta);
  }

  return result;
}

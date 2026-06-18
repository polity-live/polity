export type NetworkTab = 'current-network' | 'manage-network' | 'manage-workflows';
export type GroupRelationshipType = 'parent' | 'child' | 'sibling';
export type GroupRelationshipFilter = 'all' | GroupRelationshipType;
export type GroupRelationshipDirection =
  | 'none'
  | 'current_grants_right_to_partner'
  | 'partner_grants_right_to_current'
  | 'mutual';
export type GroupConnectionComposerTab = 'advanced' | 'preset';
export type GroupConnectionPreset = 'parent' | 'child' | 'elected' | 'role_members_to_partner';
export type CanonicalMembershipMode =
  | 'none'
  | 'all_members'
  | 'role_members'
  | 'selected_source_groups';
export type RelativeMembershipDirection =
  | 'current_members_to_partner'
  | 'partner_members_to_current';

export interface GroupConnectionComposerMembershipRuleValue {
  membershipMode: CanonicalMembershipMode;
  roleId: string;
  sourceGroupIds: string[];
}

export interface NetworkGroupDerivedMetaFields {
  group_type?: 'base' | 'hierarchical' | 'sibling' | string | null;
  connected_group_id?: string | null;
  sibling_membership_mode?: 'open' | 'elected' | 'parliament' | string | null;
  primary_sibling_membership_mode?: CanonicalMembershipMode | string | null;
  sibling_role_id?: string | null;
  parliament_source_group_ids?: readonly string[] | null;
  primary_incoming_sibling_membership_mode?: CanonicalMembershipMode | string | null;
  primary_outgoing_sibling_membership_mode?: CanonicalMembershipMode | string | null;
  incoming_sibling_role_id?: string | null;
  outgoing_sibling_role_id?: string | null;
  incoming_parliament_source_group_ids?: readonly string[] | null;
  outgoing_parliament_source_group_ids?: readonly string[] | null;
  primary_sibling_connection_id?: string | null;
}

export interface GroupConnectionComposerValue {
  selectedGroupId: string;
  relationshipType: GroupRelationshipType;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: GroupConnectionComposerMembershipRuleValue;
  rightDirections: Record<
    | 'informationRight'
    | 'amendmentRight'
    | 'rightToSpeak'
    | 'activeVotingRight'
    | 'passiveVotingRight',
    GroupRelationshipDirection
  >;
  preset: GroupConnectionPreset;
}

export interface NetworkGroupEntity extends NetworkGroupDerivedMetaFields {
  id: string;
  name?: string | null;
  description?: unknown;
  created_at?: string | number | Date | null;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
  [key: string]: unknown;
}

export interface NormalizedGroupRelationship {
  id: string;
  connection_id: string;
  grant_id: string | null;
  connection_request_id?: string | null;
  membership_request_id?: string | null;
  request_item_kind: 'structure' | 'right' | 'membership';
  group_id: string;
  related_group_id: string;
  relationship_type: GroupRelationshipType | null;
  connection_type: 'hierarchy' | 'peer';
  parent_group_id: string | null;
  child_group_id: string | null;
  with_right: string | null;
  status: string | null;
  initiator_group_id: string | null;
  created_at: number;
  member_source_group_id: string | null;
  member_target_group_id: string | null;
  membership_mode: CanonicalMembershipMode;
  required_source_role_id: string | null;
  required_source_role?: { id: string; name?: string | null } | null;
  eligible_origin_group_ids: string[];
  group: NetworkGroupEntity | null;
  related_group: NetworkGroupEntity | null;
}

export interface GroupedRelationshipSummary {
  group: NetworkGroupEntity;
  rights: string[];
  type: GroupRelationshipType;
  membershipMode?: CanonicalMembershipMode | null;
  requiredSourceRoleId?: string | null;
  requiredSourceRoleName?: string | null;
}

export interface GroupedRelationshipRequest {
  group: NetworkGroupEntity;
  requestId: string | null;
  allRels: NormalizedGroupRelationship[];
  rightRels: NormalizedGroupRelationship[];
  membershipRels: NormalizedGroupRelationship[];
  structureRel: NormalizedGroupRelationship | null;
  rels: NormalizedGroupRelationship[];
  type: GroupRelationshipType;
  membershipMode?: CanonicalMembershipMode | null;
}

export function normalizeGroupRelationship(
  rel: NormalizedGroupRelationship
): NormalizedGroupRelationship {
  return rel;
}

export interface EnrichedPathSegment {
  groupId: string | null;
  groupName: string;
  eventId: string | null;
  eventTitle: string;
  eventStartDate: number | null;
  agendaItemId: string | null;
  amendmentVoteId: string | null;
  forwardingStatus: string | null;
  order: number | null;
}

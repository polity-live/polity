import type { NetworkLinkListRow } from '@/zero/network/queries';

export type NetworkTab = 'current-network' | 'manage-network';
export type GroupRelationshipType = 'parent' | 'child' | 'sibling';
export type GroupRelationshipFilter = 'all' | GroupRelationshipType;
export type GroupRelationshipDirection = 'none' | 'outgoing' | 'incoming' | 'bidirectional';
export type NetworkLinkComposerTab = 'advanced' | 'preset';
export type NetworkLinkPreset = 'parent' | 'child' | 'parliament' | 'elected';
export type CanonicalMembershipMode =
  | 'none'
  | 'all_members'
  | 'role_members'
  | 'selected_source_groups';
export type CanonicalNetworkLinkDirection = 'forward' | 'backward' | 'bidirectional';
export type CanonicalNetworkMembershipDirection = 'forward' | 'backward';
export type RelativeMembershipDirection = 'incoming' | 'outgoing';

export interface NetworkLinkComposerMembershipRuleValue {
  membershipMode: CanonicalMembershipMode;
  roleId: string;
  sourceGroupIds: string[];
}

export interface NetworkGroupDerivedMetaFields {
  group_type?: 'base' | 'hierarchical' | 'sibling' | string | null;
  connected_group_id?: string | null;
  sibling_membership_mode?: 'open' | 'elected' | 'parliament' | string | null;
  primary_sibling_membership_mode?: CanonicalMembershipMode | null;
  sibling_role_id?: string | null;
  parliament_source_group_ids?: string[] | null;
  primary_incoming_sibling_membership_mode?: CanonicalMembershipMode | null;
  primary_outgoing_sibling_membership_mode?: CanonicalMembershipMode | null;
  incoming_sibling_role_id?: string | null;
  outgoing_sibling_role_id?: string | null;
  incoming_parliament_source_group_ids?: string[] | null;
  outgoing_parliament_source_group_ids?: string[] | null;
  primary_sibling_link_id?: string | null;
}

export interface NetworkLinkComposerValue {
  selectedGroupId: string;
  relationshipType: GroupRelationshipType;
  membershipDirection: RelativeMembershipDirection | null;
  membershipRule: NetworkLinkComposerMembershipRuleValue;
  rightDirections: Record<
    | 'informationRight'
    | 'amendmentRight'
    | 'rightToSpeak'
    | 'activeVotingRight'
    | 'passiveVotingRight',
    GroupRelationshipDirection
  >;
  preset: NetworkLinkPreset;
}

export type NetworkGroupEntity = NonNullable<NetworkLinkListRow['source_group']> &
  NetworkGroupDerivedMetaFields;

export interface NormalizedGroupRelationship {
  id: string;
  network_link_id: string;
  network_link_right_id: string;
  network_link_request_id?: string | null;
  group_id: string;
  related_group_id: string;
  relationship_type: GroupRelationshipType | null;
  structural_relation: 'parent_child' | 'sibling';
  with_right: string | null;
  status: string | null;
  initiator_group_id: string | null;
  created_at: number;
  membership_mode: CanonicalMembershipMode;
  membership_direction?: CanonicalNetworkMembershipDirection | null;
  membership_role_id?: string | null;
  membership_source_group_ids?: string[] | null;
  relationship_direction?: 'forward' | 'backward';
  group: NetworkGroupEntity | null;
  related_group: NetworkGroupEntity | null;
  right_direction: CanonicalNetworkLinkDirection;
}

export interface GroupedRelationshipSummary {
  group: NetworkGroupEntity;
  rights: string[];
  type: GroupRelationshipType;
  membershipMode?: CanonicalMembershipMode | null;
}

export interface GroupedRelationshipRequest {
  group: NetworkGroupEntity;
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

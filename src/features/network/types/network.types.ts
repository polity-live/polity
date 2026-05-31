import type { GroupNetworkRelationshipRow } from '@/zero/groups/queries';

export type NetworkTab = 'current-network' | 'manage-network';
export type GroupRelationshipType = 'parent' | 'child' | 'sibling';
export type GroupRelationshipFilter = 'all' | GroupRelationshipType;
export type GroupRelationshipDirection = 'none' | 'outgoing' | 'incoming' | 'bidirectional';

export type NormalizedGroupRelationship = GroupNetworkRelationshipRow;

export type NetworkGroupEntity = NonNullable<GroupNetworkRelationshipRow['group']>;

export interface GroupedRelationshipSummary {
  group: NetworkGroupEntity;
  rights: string[];
  type: GroupRelationshipType;
}

export interface GroupedRelationshipRequest {
  group: NetworkGroupEntity;
  rels: NormalizedGroupRelationship[];
  type: GroupRelationshipType;
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

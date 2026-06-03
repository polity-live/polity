import type {
  CanonicalMembershipMode,
  GroupedRelationshipSummary,
  NetworkGroupEntity,
} from '../types/network.types';

interface RelationshipSummarySourceItem {
  group: NetworkGroupEntity;
  rights: string[];
  membershipMode?: CanonicalMembershipMode | null;
}

interface ActiveRelationshipSummarySource {
  parents: readonly RelationshipSummarySourceItem[];
  children: readonly RelationshipSummarySourceItem[];
  siblings: readonly RelationshipSummarySourceItem[];
}

export function buildActiveRelationshipSummaries(
  networkData: ActiveRelationshipSummarySource
): GroupedRelationshipSummary[] {
  return [
    ...networkData.parents.map(item => ({
      group: item.group,
      rights: item.rights,
      type: 'child' as const,
      membershipMode: null,
    })),
    ...networkData.children.map(item => ({
      group: item.group,
      rights: item.rights,
      type: 'parent' as const,
      membershipMode: null,
    })),
    ...networkData.siblings.map(item => ({
      group: item.group,
      rights: item.rights,
      type: 'sibling' as const,
      membershipMode: item.membershipMode ?? null,
    })),
  ];
}

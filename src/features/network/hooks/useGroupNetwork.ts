import { useCallback, useMemo, useState } from 'react';
import { useGroupState } from '@/zero/groups/useGroupState';
import { useGroupConnectionState } from '@/zero/network';
import { RIGHT_TYPES } from '@/features/shared/ui/status';
import {
  type CanonicalMembershipMode,
  type GroupedRelationshipSummary,
  type NormalizedGroupRelationship,
  type NetworkGroupEntity,
} from '../types/network.types';
import { getRelationshipTypeForGroup } from '../logic/groupRelationshipOrientation';
import {
  buildDirectRelationships,
  buildIndirectRelationships,
  isActiveGroupRelationshipStatus,
  isRequestGroupRelationshipStatus,
} from '../logic/networkRelationshipHelpers';
import {
  deriveNormalizedGroupConnectionRequestRows,
  deriveNormalizedGroupRelationships,
} from '../logic/groupConnectionDerived';

interface ParentNetworkItem {
  group: NetworkGroupEntity;
  rights: string[];
  level?: number;
  childId?: string;
  membershipMode?: CanonicalMembershipMode | null;
}

interface ChildNetworkItem {
  group: NetworkGroupEntity;
  rights: string[];
  level?: number;
  parentId?: string;
  membershipMode?: CanonicalMembershipMode | null;
}

interface SiblingNetworkItem extends GroupedRelationshipSummary {
  level?: number;
}

function getRelationshipMemoKey(relationship: NormalizedGroupRelationship) {
  return [
    relationship.id,
    relationship.group_id,
    relationship.related_group_id,
    relationship.initiator_group_id ?? '',
    relationship.relationship_type ?? '',
    relationship.status ?? '',
    relationship.with_right ?? '',
    relationship.membership_mode ?? '',
    relationship.connection_request_id ?? '',
    relationship.group?.id ?? '',
    relationship.group?.name ?? '',
    relationship.related_group?.id ?? '',
    relationship.related_group?.name ?? '',
  ].join('::');
}

export function useGroupNetwork(groupId: string) {
  const { group, isLoading: isGroupLoading } = useGroupState({ groupId });
  const {
    groupConnections,
    groupConnectionsLoading,
    groupConnectionRequests,
    groupConnectionRequestsLoading,
    allConnections,
    allConnectionsLoading,
  } = useGroupConnectionState({ groupId });
  const [showIndirect, setShowIndirect] = useState(false);
  const [selectedRights, setSelectedRights] = useState<Set<string>>(new Set(RIGHT_TYPES));

  const activeRelationshipsSource = allConnections.length > 0 ? allConnections : groupConnections;

  const relationships = useMemo<NormalizedGroupRelationship[]>(
    () => deriveNormalizedGroupRelationships(activeRelationshipsSource),
    [activeRelationshipsSource]
  );
  const requestRelationships = useMemo<NormalizedGroupRelationship[]>(
    () => deriveNormalizedGroupConnectionRequestRows(groupConnectionRequests),
    [groupConnectionRequests]
  );

  // Categorize relationships
  const { activeRelationships, incomingRequests, outgoingRequests } = useMemo(() => {
    const active: NormalizedGroupRelationship[] = [];
    const incoming: NormalizedGroupRelationship[] = [];
    const outgoing: NormalizedGroupRelationship[] = [];

    relationships.forEach(rel => {
      if (isActiveGroupRelationshipStatus(rel.status)) {
        active.push(rel);
      }
    });

    requestRelationships.forEach(rel => {
      if (!isRequestGroupRelationshipStatus(rel.status)) {
        return;
      }

      const involvesCurrentGroup = rel.group_id === groupId || rel.related_group_id === groupId;
      if (!involvesCurrentGroup) {
        return;
      }

      if (rel.initiator_group_id === groupId) {
        outgoing.push(rel);
      } else {
        incoming.push(rel);
      }
    });

    return { activeRelationships: active, incomingRequests: incoming, outgoingRequests: outgoing };
  }, [relationships, requestRelationships, groupId]);

  // Memoize active relationships to prevent infinite loops in graph calculation
  const stableRelationships = useMemo(() => {
    return activeRelationships;
  }, [activeRelationships.length, activeRelationships.map(getRelationshipMemoKey).join('|')]);

  const stableRequestRelationships = useMemo(() => {
    return requestRelationships;
  }, [requestRelationships.length, requestRelationships.map(getRelationshipMemoKey).join('|')]);

  const allRelationships = useMemo(
    () => [...stableRelationships, ...stableRequestRelationships],
    [stableRelationships, stableRequestRelationships]
  );

  // Build direct relationships
  const getDirectRelationships = useCallback(
    (
      targetGroupId: string
    ): {
      parents: ParentNetworkItem[];
      children: ChildNetworkItem[];
      siblings: SiblingNetworkItem[];
    } => {
      const directHierarchy = buildDirectRelationships(
        stableRelationships,
        targetGroupId,
        undefined,
        groupId
      );
      const parents = directHierarchy.parents.map(
        entry =>
          ({
            group: entry.group,
            rights: entry.rights,
            type: 'parent',
            membershipMode: null,
          }) satisfies GroupedRelationshipSummary
      );
      const children = directHierarchy.children.map(
        entry =>
          ({
            group: entry.group,
            rights: entry.rights,
            type: 'child',
            membershipMode: null,
          }) satisfies GroupedRelationshipSummary
      );
      const siblingsMap = new Map<string, GroupedRelationshipSummary>();

      stableRelationships.forEach(rel => {
        const relationshipType = getRelationshipTypeForGroup(rel, targetGroupId);
        if (relationshipType !== 'sibling') {
          return;
        }

        const siblingEntity = rel.group?.id === targetGroupId ? rel.related_group : rel.group;
        if (!siblingEntity) {
          return;
        }

        const existingEntry = siblingsMap.get(siblingEntity.id);
        if (!existingEntry) {
          siblingsMap.set(siblingEntity.id, {
            group: siblingEntity,
            rights: rel.with_right ? [rel.with_right] : [],
            type: 'sibling',
            membershipMode: rel.membership_mode ?? null,
          });
          return;
        }

        if (rel.with_right && !existingEntry.rights.includes(rel.with_right)) {
          existingEntry.rights.push(rel.with_right);
        }
        if (
          (!existingEntry.membershipMode && rel.membership_mode) ||
          (existingEntry.membershipMode === 'none' && rel.membership_mode !== 'none')
        ) {
          existingEntry.membershipMode = rel.membership_mode;
        }
      });

      return { parents, children, siblings: Array.from(siblingsMap.values()) };
    },
    [groupId, stableRelationships]
  );

  // Build indirect (recursive) relationships
  const getIndirectRelationships = useCallback(
    (
      targetGroupId: string
    ): {
      parents: ParentNetworkItem[];
      children: ChildNetworkItem[];
      siblings: SiblingNetworkItem[];
    } => {
      const indirectHierarchy = buildIndirectRelationships(
        stableRelationships,
        targetGroupId,
        undefined,
        groupId
      );
      return {
        parents: indirectHierarchy.parents.map(
          entry =>
            ({
              group: entry.group,
              rights: entry.rights,
              level: entry.level ?? 1,
              childId: entry.childId,
            }) satisfies {
              group: NetworkGroupEntity;
              rights: string[];
              level: number;
              childId?: string;
            }
        ),
        children: indirectHierarchy.children.map(
          entry =>
            ({
              group: entry.group,
              rights: entry.rights,
              level: entry.level ?? 1,
              parentId: entry.parentId,
            }) satisfies {
              group: NetworkGroupEntity;
              rights: string[];
              level: number;
              parentId?: string;
            }
        ),
        siblings: getDirectRelationships(targetGroupId).siblings,
      };
    },
    [getDirectRelationships, groupId, stableRelationships]
  );

  const toggleRight = useCallback((right: string) => {
    setSelectedRights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(right)) {
        newSet.delete(right);
      } else {
        newSet.add(right);
      }
      return newSet;
    });
  }, []);

  const networkData = useMemo(() => {
    if (!groupId) return { parents: [], children: [], siblings: [] };

    const { parents, children, siblings } = showIndirect
      ? getIndirectRelationships(groupId)
      : getDirectRelationships(groupId);

    // Filter by selected rights
    const filterByRights = <T extends { rights: string[] }>(items: T[]) => {
      return items
        .map(item => ({
          ...item,
          rights: item.rights.filter(r => selectedRights.has(r)),
        }))
        .filter(item => item.rights.length > 0);
    };

    return {
      parents: filterByRights(parents),
      children: filterByRights(children),
      siblings: filterByRights(siblings),
    };
  }, [groupId, showIndirect, getDirectRelationships, getIndirectRelationships, selectedRights]);

  return {
    group,
    groupConnections,
    groupConnectionRequests,
    isLoading:
      isGroupLoading ||
      groupConnectionsLoading ||
      groupConnectionRequestsLoading ||
      allConnectionsLoading,
    networkData,
    showIndirect,
    setShowIndirect,
    selectedRights,
    toggleRight,
    stableRelationships,
    allRelationships,
    activeRelationships,
    incomingRequests,
    outgoingRequests,
  };
}

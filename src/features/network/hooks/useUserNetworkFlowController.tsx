'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import { NETWORK_FILTER_ACTIVE_CLASS_NAMES } from '@/features/network/ui/NetworkControlPanel';
import { useNetworkFlowControls } from '@/features/network/hooks/useNetworkFlowControls';
import { usePersistedNetworkLayout } from '@/features/network/hooks/usePersistedNetworkLayout';
import { useEditableNetworkLayout } from '@/features/network/hooks/useEditableNetworkLayout';
import {
  buildDirectRelationships,
  buildIndirectRelationships,
  isAcceptedSiblingRelationship,
  type RelationshipTraversalMode,
  type RelationshipEntry,
} from '@/features/network/logic/networkRelationshipHelpers';
import {
  filterEdgesByRelationshipStatus,
  filterEdgesByConnectionDirections,
  filterEdgesByRights,
  filterNodesByEdges,
} from '@/features/network/logic/networkFilterHelpers';
import {
  getGroupNodeDisplayLabel,
  getGroupNodeStyle,
  getGroupNodeVisualTokens,
  getEntityNetworkNodeStyle,
  getGroupNodeVisualVariant,
} from '@/features/network/ui/networkVisualHelpers';
import { useUserState } from '@/zero/users/useUserState';
import { useGroupConnectionState } from '@/zero/network';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import {
  addUniqueValue,
  buildHierarchyRightEdgeDirections,
  buildNetworkRelationshipDialogData,
  buildNetworkRelationshipEdge,
  buildSingleDirectionRightEdgeDirections,
  createNetworkRelationshipEdgeData,
  getCivicNetworkEdgeColor,
  getCivicNetworkEdgeStyle,
  getCivicNetworkLabelStyle,
  mergeNetworkEdgeRelationshipDirection,
  mergeNetworkRightRelationshipKind,
} from '../logic/networkEdgeHelpers';
import {
  type EditableRightsLabelEdgeData,
  type NetworkEdgeRelationshipDirection,
} from '../types/networkEdge.types';
import type { CanonicalMembershipMode, NetworkGroupEntity } from '../types/network.types';
import { deriveNormalizedGroupRelationships } from '../logic/groupConnectionDerived';

interface NetworkNode extends Node {
  data: {
    label: string;
    description?: string;
    level: number;
    type: 'user' | 'group';
    groupData?: NetworkGroupEntity;
  };
}

export interface UserNetworkFlowProps {
  userId: string;
  onGroupClick?: (groupId: string, groupData: NetworkGroupEntity) => void;
  filterRight?: string; // Optional filter by specific right type
  title?: string;
  description?: string;
  showGroupDialogOnClick?: boolean;
  layoutScopeKey?: string;
}

function toDisplayText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function useUserNetworkFlowController({
  userId,
  onGroupClick,
  filterRight,
  title,
  description,
  showGroupDialogOnClick = true,
  layoutScopeKey,
}: UserNetworkFlowProps) {
  const { t } = useTranslation();
  const {
    savedLayout,
    hasSavedLayout,
    isLoading: isLayoutLoading,
    persistLayout,
    resetLayout,
  } = usePersistedNetworkLayout({
    scopeKey: layoutScopeKey ?? `user:${userId}`,
  });
  const controls = useNetworkFlowControls();
  const {
    relationshipDepthFilter,
    setRelationshipDepthFilter,
    selectedNodes,
    isInteractive,
    relationshipStatusFilter,
    setRelationshipStatusFilter,
    connectionDirectionFilter,
    setConnectionDirectionFilter,
    selectedRights,
    selectedConnectionDirections,
    panelCollapsed,
    setPanelCollapsed,
    legendCollapsed,
    setLegendCollapsed,
    dialogOpen,
    setDialogOpen,
    selectedEntity,
    setSelectedEntity,
    toggleRight,
    handleInteractiveChange,
  } = controls;
  const [nodes, setNodes] = useNodesState<NetworkNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<EditableRightsLabelEdgeData>>([]);
  const {
    currentLayout,
    hasLayoutChanges,
    nodePositionsRef,
    edgeBendPointsRef,
    isInteractiveRef,
    handleNodesChange,
    handleEdgeBendPointsChange,
    syncGeneratedLayoutState,
    clearPersistedLayoutState,
  } = useEditableNetworkLayout({
    nodes,
    edges,
    setNodes,
    setEdges,
    savedLayout,
    isInteractive,
  });

  const { userWithGroupMemberships } = useUserState({ userId, includeGroupMemberships: true });

  const { allConnections } = useGroupConnectionState();
  const allRelationships = useMemo(
    () => deriveNormalizedGroupRelationships(allConnections),
    [allConnections]
  );

  const user = userWithGroupMemberships?.[0];
  const memberships = user?.group_memberships || [];
  const relationships = allRelationships;
  const userProfile = useMemo(() => {
    if (!user) {
      return null;
    }

    return {
      id: userId,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      bio: user.bio ?? '',
    };
  }, [user?.bio, user?.first_name, user?.last_name, userId]);

  // Get all groups the user is a member of - use stable dependencies
  const userGroups = useMemo(() => {
    if (!memberships.length) return [] as NetworkGroupEntity[];
    return memberships
      .filter(
        m => m.group && (m.status === 'active' || m.status === 'member' || m.status === 'admin')
      )
      .map(m => m.group)
      .filter((g): g is NonNullable<typeof g> => g != null);
  }, [memberships.length, memberships.map(m => `${m.id}-${m.status}`).join(',')]);
  // Memoize relationships to prevent infinite loops - use stable dependencies
  const stableRelationships = useMemo(() => {
    if (!relationships.length) return [];
    return relationships;
  }, [relationships.length, relationships.map(r => r.id).join(',')]);
  const relationshipTraversalMode: RelationshipTraversalMode = filterRight ? 'right' : 'structure';
  const userGroupIds = useMemo(() => new Set(userGroups.map(group => group.id)), [userGroups]);

  const allLabel = t('common.labels.all');

  const depthFilters = useMemo(
    () => [
      {
        id: 'all',
        label: allLabel,
        active: relationshipDepthFilter === 'all',
        onToggle: () => setRelationshipDepthFilter('all'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.neutral,
      },
      {
        id: 'direct',
        label: t('common.network.direct'),
        active: relationshipDepthFilter === 'direct',
        onToggle: () => setRelationshipDepthFilter('direct'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.neutral,
      },
    ],
    [allLabel, relationshipDepthFilter, setRelationshipDepthFilter, t]
  );

  const relationshipStatusFilters = useMemo(
    () => [
      {
        id: 'active',
        label: t('common.network.active'),
        active: relationshipStatusFilter === 'active',
        onToggle: () => setRelationshipStatusFilter('active'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.green,
      },
      {
        id: 'incoming',
        label: t('common.network.incomingRequest'),
        active: relationshipStatusFilter === 'incoming',
        onToggle: () => setRelationshipStatusFilter('incoming'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.blue,
      },
      {
        id: 'outgoing',
        label: t('common.network.outgoingRequest'),
        active: relationshipStatusFilter === 'outgoing',
        onToggle: () => setRelationshipStatusFilter('outgoing'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.orange,
      },
    ],
    [relationshipStatusFilter, setRelationshipStatusFilter, t]
  );

  const connectionDirectionFilters = useMemo(
    () => [
      {
        id: 'all',
        label: allLabel,
        active: connectionDirectionFilter === 'all',
        onToggle: () => setConnectionDirectionFilter('all'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.purple,
      },
      {
        id: 'incoming',
        label: t('common.network.incomingConnections'),
        active: connectionDirectionFilter === 'incoming',
        onToggle: () => setConnectionDirectionFilter('incoming'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.blue,
      },
      {
        id: 'outgoing',
        label: t('common.network.outgoingConnections'),
        active: connectionDirectionFilter === 'outgoing',
        onToggle: () => setConnectionDirectionFilter('outgoing'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.orange,
      },
    ],
    [allLabel, connectionDirectionFilter, setConnectionDirectionFilter, t]
  );

  // Generate flow chart
  const generateFlowChart = useCallback(() => {
    if (!userProfile) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes: NetworkNode[] = [];
    const allEdgesMap = new Map<string, Edge>(); // Use Map to prevent ALL duplicate edges
    const nodePositions = new Map<string, { x: number; y: number }>();
    const addNode = (node: NetworkNode) => {
      newNodes.push(node);
      nodePositions.set(node.id, node.position);
    };

    // Build a name lookup for resolving edge source/target names
    const groupNameMap = new Map<string, string>();
    groupNameMap.set(userId, userProfile.name);
    userGroups.forEach(g => groupNameMap.set(g.id, g.name ?? ''));
    stableRelationships.forEach(r => {
      if (r.group_id && r.group && !groupNameMap.has(r.group_id))
        groupNameMap.set(r.group_id, r.group.name ?? r.group_id);
      if (r.related_group_id && r.related_group && !groupNameMap.has(r.related_group_id))
        groupNameMap.set(r.related_group_id, r.related_group.name ?? r.related_group_id);
    });

    // Add center node (user)
    addNode({
      id: userId,
      type: 'default',
      position: nodePositionsRef.current[userId] ?? { x: 400, y: 300 },
      data: {
        label: userProfile.name,
        description: userProfile.bio,
        level: 0,
        type: 'user',
      },
      style: {
        ...getEntityNetworkNodeStyle('user', {
          width: 180,
          height: 180,
          borderRadius: '999px',
          padding: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }),
      },
    });

    // Add user's groups as first level
    const groupsPerRow = Math.ceil(Math.sqrt(userGroups.length));
    userGroups.forEach((group, index: number) => {
      const row = Math.floor(index / groupsPerRow);
      const col = index % groupsPerRow;
      const totalInRow = Math.min(groupsPerRow, userGroups.length - row * groupsPerRow);
      const xOffset = (col - (totalInRow - 1) / 2) * 250;
      const yOffset = 200 + row * 180;

      addNode({
        id: group.id,
        type: 'default',
        position: nodePositionsRef.current[group.id] ?? { x: 400 + xOffset, y: 300 + yOffset },
        data: {
          label: getGroupNodeDisplayLabel(group.name, 'current'),
          description: toDisplayText(group.description) ?? '',
          level: 1,
          type: 'group',
          groupData: group,
        },
        style: getGroupNodeStyle('current', {
          width: 180,
          fontSize: '12px',
          cursor: onGroupClick ? 'pointer' : 'default',
        }),
      });

      // Add edge from user to group - check for duplicates
      const edgeId = `edge-user-${userId}-to-group-${group.id}`;
      if (!allEdgesMap.has(edgeId)) {
        allEdgesMap.set(edgeId, {
          id: edgeId,
          source: userId,
          target: group.id,
          type: 'smoothstep',
          animated: true,
          label: translateText('generated.inline.0200_member_6853c98a'),
          style: getCivicNetworkEdgeStyle({ tone: 'user' }),
          ...getCivicNetworkLabelStyle({ tone: 'user' }),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: getCivicNetworkEdgeColor('user'),
          },
          data: createNetworkRelationshipEdgeData({
            rights: [],
            relationshipKinds: ['active'],
            relationshipType: 'membership',
            userConnectionDirections: ['incoming', 'outgoing'],
            sourceName: groupNameMap.get(userId) ?? null,
            targetName: groupNameMap.get(group.id) ?? null,
          }),
        });
      }
    });

    // Add parent and child groups for each user group
    const allRelatedGroups = new Map<
      string,
      RelationshipEntry & { isParent: boolean; connectedTo: string }
    >();
    const showAllDepth = relationshipDepthFilter === 'all';
    const showIndirectOnly = relationshipDepthFilter === 'indirect';

    userGroups.forEach(group => {
      const relationshipTree =
        relationshipDepthFilter === 'direct'
          ? buildDirectRelationships(
              stableRelationships,
              group.id,
              filterRight,
              group.id,
              relationshipTraversalMode
            )
          : buildIndirectRelationships(
              stableRelationships,
              group.id,
              filterRight,
              group.id,
              relationshipTraversalMode
            );
      const parents = showIndirectOnly
        ? relationshipTree.parents.filter(parent => (parent.level ?? 1) > 1)
        : relationshipTree.parents;
      const children = showIndirectOnly
        ? relationshipTree.children.filter(child => (child.level ?? 1) > 1)
        : relationshipTree.children;

      // Process parent groups
      parents.forEach(parent => {
        if (
          !allRelatedGroups.has(parent.group.id) &&
          !userGroups.some(g => g.id === parent.group.id)
        ) {
          allRelatedGroups.set(parent.group.id, {
            group: parent.group,
            rights: parent.rights,
            relationshipKinds: parent.relationshipKinds,
            rightRelationshipKinds: parent.rightRelationshipKinds,
            sourceRelationshipType: parent.sourceRelationshipType ?? null,
            membershipMode: parent.membershipMode ?? null,
            memberSourceGroupId: parent.memberSourceGroupId ?? null,
            memberTargetGroupId: parent.memberTargetGroupId ?? null,
            level: parent.level,
            childId: parent.childId,
            isParent: true,
            connectedTo: group.id,
          });
        }

        const rightMode = relationshipTraversalMode === 'right' && Boolean(filterRight);
        const hierarchyChildGroupId = showAllDepth && parent.childId ? parent.childId : group.id;
        const edgeSourceGroupId = rightMode ? hierarchyChildGroupId : parent.group.id;
        const edgeTargetGroupId = rightMode ? parent.group.id : hierarchyChildGroupId;
        const edgeId = rightMode
          ? `edge-${edgeSourceGroupId}-to-parent-${parent.group.id}`
          : `edge-parent-${parent.group.id}-to-${edgeTargetGroupId}`;

        // Only add edge if it doesn't already exist
        if (!allEdgesMap.has(edgeId)) {
          const rightEdgeDirections =
            rightMode && filterRight
              ? buildSingleDirectionRightEdgeDirections([filterRight], 'forward')
              : buildHierarchyRightEdgeDirections(
                  stableRelationships,
                  parent.group.id,
                  hierarchyChildGroupId
                );
          allEdgesMap.set(edgeId, {
            ...buildNetworkRelationshipEdge({
              edgeId,
              sourceId: edgeSourceGroupId,
              targetId: edgeTargetGroupId,
              sourceGroupId: edgeSourceGroupId,
              targetGroupId: edgeTargetGroupId,
              structuralType:
                relationshipTraversalMode === 'right'
                  ? (parent.sourceRelationshipType ?? 'parent')
                  : 'parent',
              rights: parent.rights,
              relationshipKinds: parent.relationshipKinds,
              rightRelationshipKinds: parent.rightRelationshipKinds,
              membershipMode: parent.membershipMode ?? null,
              memberSourceGroupId: parent.memberSourceGroupId ?? null,
              memberTargetGroupId: parent.memberTargetGroupId ?? null,
              rightEdgeDirections,
              relationshipDepth: (parent.level ?? 1) === 1 ? 'direct' : 'indirect',
              fallbackStrokeColor: getGroupNodeVisualTokens('parent').borderColor,
              strokeDasharray: '5 5',
              sourceName: groupNameMap.get(edgeSourceGroupId) ?? null,
              targetName: groupNameMap.get(edgeTargetGroupId) ?? null,
              currentGroupId: rightMode ? edgeSourceGroupId : hierarchyChildGroupId,
              previewCurrentGroupId: rightMode ? edgeSourceGroupId : hierarchyChildGroupId,
              bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
              edgeEditingEnabled: isInteractiveRef.current,
              onBendPointsChange: handleEdgeBendPointsChange,
            }),
          });
        }
      });

      // Process child groups
      children.forEach(child => {
        if (
          !allRelatedGroups.has(child.group.id) &&
          !userGroups.some(g => g.id === child.group.id)
        ) {
          allRelatedGroups.set(child.group.id, {
            group: child.group,
            rights: child.rights,
            relationshipKinds: child.relationshipKinds,
            rightRelationshipKinds: child.rightRelationshipKinds,
            sourceRelationshipType: child.sourceRelationshipType ?? null,
            membershipMode: child.membershipMode ?? null,
            memberSourceGroupId: child.memberSourceGroupId ?? null,
            memberTargetGroupId: child.memberTargetGroupId ?? null,
            level: child.level,
            parentId: child.parentId,
            isParent: false,
            connectedTo: group.id,
          });
        }

        const edgeSource = showAllDepth && child.parentId ? child.parentId : group.id;
        const edgeId = `edge-${edgeSource}-to-child-${child.group.id}`;

        // Only add edge if it doesn't already exist
        if (!allEdgesMap.has(edgeId)) {
          const rightEdgeDirections =
            relationshipTraversalMode === 'right' && filterRight
              ? buildSingleDirectionRightEdgeDirections([filterRight], 'forward')
              : buildHierarchyRightEdgeDirections(stableRelationships, edgeSource, child.group.id);
          allEdgesMap.set(edgeId, {
            ...buildNetworkRelationshipEdge({
              edgeId,
              sourceId: edgeSource,
              targetId: child.group.id,
              sourceGroupId: edgeSource,
              targetGroupId: child.group.id,
              structuralType:
                relationshipTraversalMode === 'right'
                  ? (child.sourceRelationshipType ?? 'parent')
                  : 'parent',
              rights: child.rights,
              relationshipKinds: child.relationshipKinds,
              rightRelationshipKinds: child.rightRelationshipKinds,
              membershipMode: child.membershipMode ?? null,
              memberSourceGroupId: child.memberSourceGroupId ?? null,
              memberTargetGroupId: child.memberTargetGroupId ?? null,
              rightEdgeDirections,
              relationshipDepth: (child.level ?? 1) === 1 ? 'direct' : 'indirect',
              fallbackStrokeColor: getGroupNodeVisualTokens('child').borderColor,
              strokeDasharray: '5 5',
              sourceName: groupNameMap.get(edgeSource) ?? null,
              targetName: groupNameMap.get(child.group.id) ?? null,
              currentGroupId: edgeSource,
              previewCurrentGroupId: edgeSource,
              bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
              edgeEditingEnabled: isInteractiveRef.current,
              onBendPointsChange: handleEdgeBendPointsChange,
            }),
          });
        }
      });
    });

    // Position related groups
    const relatedGroupsArray = Array.from(allRelatedGroups.values());
    const parentGroups = relatedGroupsArray.filter(g => g.isParent);
    const childGroups = relatedGroupsArray.filter(g => !g.isParent);

    // Position parent groups above user groups
    parentGroups.forEach((parent, index: number) => {
      const level = parent.level || 1;
      const yOffset = -150 * level - 50;
      const xOffset = (index - parentGroups.length / 2) * 220;

      addNode({
        id: parent.group.id,
        type: 'default',
        position: nodePositionsRef.current[parent.group.id] ?? {
          x: 400 + xOffset,
          y: 300 + yOffset,
        },
        data: {
          label: getGroupNodeDisplayLabel(parent.group.name, 'parent'),
          description: toDisplayText(parent.group.description) ?? '',
          level,
          type: 'group',
          groupData: parent.group,
        },
        style: getGroupNodeStyle('parent', {
          width: 180,
          fontSize: '12px',
          cursor: onGroupClick ? 'pointer' : 'default',
        }),
      });
    });

    // Position child groups below user groups
    childGroups.forEach((child, index: number) => {
      const level = child.level || 1;
      const baseYOffset = 200 + Math.ceil(userGroups.length / groupsPerRow) * 180;
      const yOffset = baseYOffset + 100 * level;
      const xOffset = (index - childGroups.length / 2) * 220;

      addNode({
        id: child.group.id,
        type: 'default',
        position: nodePositionsRef.current[child.group.id] ?? {
          x: 400 + xOffset,
          y: 300 + yOffset,
        },
        data: {
          label: getGroupNodeDisplayLabel(child.group.name, 'child'),
          description: toDisplayText(child.group.description) ?? '',
          level,
          type: 'group',
          groupData: child.group,
        },
        style: getGroupNodeStyle('child', {
          width: 180,
          fontSize: '12px',
          cursor: onGroupClick ? 'pointer' : 'default',
        }),
      });
    });

    const renderedGroupIds = new Set(
      newNodes.filter(node => node.data.type === 'group').map(node => node.id)
    );
    const siblingGroupsByAnchor = new Map<string, NetworkGroupEntity[]>();
    const registerSiblingGroup = (anchorId: string, siblingGroup: NetworkGroupEntity) => {
      if (renderedGroupIds.has(siblingGroup.id)) {
        return;
      }

      const siblingGroups = siblingGroupsByAnchor.get(anchorId) ?? [];
      if (!siblingGroupsByAnchor.has(anchorId)) {
        siblingGroupsByAnchor.set(anchorId, siblingGroups);
      }

      if (!siblingGroups.some(group => group.id === siblingGroup.id)) {
        siblingGroups.push(siblingGroup);
      }
    };
    const siblingEdgeEntries = new Map<
      string,
      {
        sourceId: string;
        targetId: string;
        rights: string[];
        relationshipKinds: ('active' | 'incoming' | 'outgoing')[];
        rightRelationshipKinds: Record<string, 'active' | 'incoming' | 'outgoing'>;
        rightEdgeDirections: Record<string, NetworkEdgeRelationshipDirection>;
        membershipMode?: CanonicalMembershipMode | null;
        memberSourceGroupId?: string | null;
        memberTargetGroupId?: string | null;
        currentGroupId: string;
        sourceGroupType?: string | null;
        targetGroupType?: string | null;
      }
    >();

    if (relationshipTraversalMode !== 'right') {
      stableRelationships.forEach(relationship => {
        if (!isAcceptedSiblingRelationship(relationship)) {
          return;
        }

        if (filterRight && (relationship.with_right ?? '') !== filterRight) {
          return;
        }

        if (!relationship.group || !relationship.related_group) {
          return;
        }

        const sourceId = relationship.group.id;
        const targetId = relationship.related_group.id;
        const sourceRendered = renderedGroupIds.has(sourceId);
        const targetRendered = renderedGroupIds.has(targetId);

        if (!sourceRendered && !targetRendered) {
          return;
        }

        groupNameMap.set(sourceId, relationship.group.name ?? sourceId);
        groupNameMap.set(targetId, relationship.related_group.name ?? targetId);

        if (!sourceRendered) {
          registerSiblingGroup(targetId, relationship.group);
        }

        if (!targetRendered) {
          registerSiblingGroup(sourceId, relationship.related_group);
        }

        const [edgeSourceId, edgeTargetId] =
          userGroupIds.has(sourceId) && !userGroupIds.has(targetId)
            ? [sourceId, targetId]
            : userGroupIds.has(targetId) && !userGroupIds.has(sourceId)
              ? [targetId, sourceId]
              : sourceId.localeCompare(targetId) <= 0
                ? [sourceId, targetId]
                : [targetId, sourceId];
        const edgeKey = `${edgeSourceId}<->${edgeTargetId}`;
        const relationshipContextGroupId = userGroupIds.has(edgeSourceId)
          ? edgeSourceId
          : userGroupIds.has(edgeTargetId)
            ? edgeTargetId
            : edgeSourceId;
        let siblingEdgeEntry = siblingEdgeEntries.get(edgeKey);
        if (!siblingEdgeEntry) {
          siblingEdgeEntry = {
            sourceId: edgeSourceId,
            targetId: edgeTargetId,
            rights: [],
            relationshipKinds: [],
            rightRelationshipKinds: {},
            rightEdgeDirections: {},
            membershipMode: relationship.membership_mode ?? null,
            memberSourceGroupId: relationship.member_source_group_id ?? null,
            memberTargetGroupId: relationship.member_target_group_id ?? null,
            currentGroupId: relationshipContextGroupId,
            sourceGroupType: relationship.group.group_type ?? null,
            targetGroupType: relationship.related_group.group_type ?? null,
          };
          siblingEdgeEntries.set(edgeKey, siblingEdgeEntry);
        }

        const right = relationship.with_right ?? '';
        if (right && !siblingEdgeEntry.rights.includes(right)) {
          siblingEdgeEntry.rights.push(right);
        }

        const relationshipKind =
          relationship.status === 'active'
            ? 'active'
            : relationship.group_id === relationshipContextGroupId ||
                relationship.related_group_id === relationshipContextGroupId
              ? relationship.initiator_group_id === relationshipContextGroupId
                ? 'outgoing'
                : 'incoming'
              : null;

        if (relationshipKind) {
          addUniqueValue(siblingEdgeEntry.relationshipKinds, relationshipKind);
        }

        if (right) {
          siblingEdgeEntry.rightRelationshipKinds[right] = mergeNetworkRightRelationshipKind(
            siblingEdgeEntry.rightRelationshipKinds[right],
            relationshipKind
          ) as 'active' | 'incoming' | 'outgoing';
        }

        const rightDirection =
          relationship.group_id === edgeSourceId && relationship.related_group_id === edgeTargetId
            ? 'forward'
            : relationship.group_id === edgeTargetId &&
                relationship.related_group_id === edgeSourceId
              ? 'backward'
              : null;

        if (right && rightDirection) {
          siblingEdgeEntry.rightEdgeDirections[right] = mergeNetworkEdgeRelationshipDirection(
            siblingEdgeEntry.rightEdgeDirections[right],
            rightDirection
          );
        }

        if (
          siblingEdgeEntry.membershipMode === 'none' &&
          relationship.membership_mode &&
          relationship.membership_mode !== 'none'
        ) {
          siblingEdgeEntry.membershipMode = relationship.membership_mode;
          siblingEdgeEntry.memberSourceGroupId = relationship.member_source_group_id ?? null;
          siblingEdgeEntry.memberTargetGroupId = relationship.member_target_group_id ?? null;
        }
      });
    }

    if (!showIndirectOnly) {
      siblingGroupsByAnchor.forEach((siblingGroups, anchorId) => {
        const anchorPosition = nodePositions.get(anchorId);
        if (!anchorPosition) {
          return;
        }

        siblingGroups.forEach((siblingGroup, index) => {
          if (renderedGroupIds.has(siblingGroup.id)) {
            return;
          }

          const siblingVisualVariant = getGroupNodeVisualVariant({
            role: 'sibling',
            siblingMembershipMode: siblingGroup.sibling_membership_mode,
          });

          const tier = Math.floor(index / 2);
          const direction = index % 2 === 0 ? 1 : -1;
          const verticalOffset = (tier % 2 === 0 ? -1 : 1) * (45 + Math.floor(tier / 2) * 70);

          addNode({
            id: siblingGroup.id,
            type: 'default',
            position: {
              ...(nodePositionsRef.current[siblingGroup.id] ?? {
                x: anchorPosition.x + direction * (220 + tier * 40),
                y: anchorPosition.y + verticalOffset,
              }),
            },
            data: {
              label: getGroupNodeDisplayLabel(siblingGroup.name, siblingVisualVariant),
              description: toDisplayText(siblingGroup.description) ?? '',
              level: 1,
              type: 'group',
              groupData: siblingGroup,
            },
            style: getGroupNodeStyle(siblingVisualVariant, {
              width: 180,
              fontSize: '12px',
              cursor: onGroupClick ? 'pointer' : 'default',
            }),
          });
          renderedGroupIds.add(siblingGroup.id);
        });
      });

      siblingEdgeEntries.forEach(
        ({
          sourceId,
          targetId,
          rights,
          relationshipKinds,
          rightRelationshipKinds,
          rightEdgeDirections,
          membershipMode,
          memberSourceGroupId,
          memberTargetGroupId,
          currentGroupId,
          sourceGroupType,
          targetGroupType,
        }) => {
          if (!renderedGroupIds.has(sourceId) || !renderedGroupIds.has(targetId)) {
            return;
          }

          const edgeId = `edge-sibling-${sourceId}-to-${targetId}`;
          if (allEdgesMap.has(edgeId)) {
            return;
          }

          const isSiblingToSibling = sourceGroupType === 'sibling' && targetGroupType === 'sibling';
          allEdgesMap.set(edgeId, {
            ...buildNetworkRelationshipEdge({
              edgeId,
              sourceId,
              targetId,
              sourceGroupId: sourceId,
              targetGroupId: targetId,
              structuralType: 'sibling',
              rights,
              relationshipKinds,
              rightRelationshipKinds,
              membershipMode,
              memberSourceGroupId,
              memberTargetGroupId,
              rightEdgeDirections,
              relationshipDepth: 'direct',
              fallbackStrokeColor: getGroupNodeVisualTokens(
                isSiblingToSibling ? 'sibling-open' : 'sibling-parliament'
              ).borderColor,
              strokeDasharray: isSiblingToSibling ? undefined : '6 4',
              sourceName: groupNameMap.get(sourceId) ?? null,
              targetName: groupNameMap.get(targetId) ?? null,
              currentGroupId,
              previewCurrentGroupId: currentGroupId,
              bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
              edgeEditingEnabled: isInteractiveRef.current,
              onBendPointsChange: handleEdgeBendPointsChange,
            }),
          });
        }
      );
    }

    const nextEdges = Array.from(allEdgesMap.values());
    syncGeneratedLayoutState(newNodes, nextEdges);
    setNodes(newNodes);
    setEdges(nextEdges);
  }, [
    edgeBendPointsRef,
    filterRight,
    handleEdgeBendPointsChange,
    isInteractiveRef,
    nodePositionsRef,
    syncGeneratedLayoutState,
    userProfile,
    userId,
    userGroups,
    userGroupIds,
    relationshipDepthFilter,
    relationshipTraversalMode,
    stableRelationships,
    onGroupClick,
  ]);

  // Filter edges based on selected rights
  const rightsFilteredEdges = useMemo(() => {
    return filterEdgesByRights(edges, selectedRights);
  }, [edges, selectedRights]);

  const statusFilteredEdges = useMemo(() => {
    return filterEdgesByRelationshipStatus(rightsFilteredEdges, relationshipStatusFilter);
  }, [relationshipStatusFilter, rightsFilteredEdges]);

  const filteredEdges = useMemo(() => {
    return filterEdgesByConnectionDirections(statusFilteredEdges, selectedConnectionDirections);
  }, [selectedConnectionDirections, statusFilteredEdges]);

  // Filter nodes to only show those connected via visible edges
  const filteredNodes = useMemo(() => {
    return filterNodesByEdges(nodes, filteredEdges, [userId]);
  }, [nodes, filteredEdges, userId]);

  // Generate flow chart when data or showIndirect changes
  useEffect(() => {
    if (isLayoutLoading) {
      return;
    }

    generateFlowChart();
  }, [generateFlowChart, isLayoutLoading]);

  const handleSaveLayout = useCallback(() => {
    persistLayout(currentLayout);
  }, [currentLayout, persistLayout]);

  const handleResetLayout = useCallback(() => {
    clearPersistedLayoutState();
    resetLayout();
    generateFlowChart();
  }, [clearPersistedLayoutState, generateFlowChart, resetLayout]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!isInteractive) return;

      const nodeData = node.data as NetworkNode['data'];

      // Open dialog with entity data
      if (nodeData.type === 'group' && nodeData.groupData) {
        if (onGroupClick) {
          onGroupClick(node.id, nodeData.groupData as NetworkGroupEntity);
        }

        if (showGroupDialogOnClick) {
          setSelectedEntity({
            type: 'group',
            data: {
              ...nodeData.groupData,
              description: toDisplayText(nodeData.groupData.description) ?? null,
            },
          });
          setDialogOpen(true);
        }
      } else if (nodeData.type === 'user') {
        setSelectedEntity({
          type: 'user',
          data: { id: userId, name: userProfile?.name ?? 'User' },
        });
        setDialogOpen(true);
      }
    },
    [
      isInteractive,
      onGroupClick,
      setDialogOpen,
      setSelectedEntity,
      showGroupDialogOnClick,
      userId,
      userProfile,
    ]
  );

  // Handle edge click
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (!isInteractive) return;

      setSelectedEntity({
        type: 'relationship',
        data: buildNetworkRelationshipDialogData(edge, t),
      });
      setDialogOpen(true);
    },
    [isInteractive, t]
  );
  return {
    connectionDirectionFilters,
    depthFilters,
    description,
    dialogOpen,
    edges,
    filteredEdges,
    filteredNodes,
    filterRight,
    handleInteractiveChange,
    handleNodesChange,
    handleResetLayout,
    handleSaveLayout,
    hasLayoutChanges,
    hasSavedLayout,
    isInteractive,
    isLayoutLoading,
    legendCollapsed,
    nodes,
    onEdgeClick,
    onEdgesChange,
    onNodeClick,
    panelCollapsed,
    relationshipStatusFilters,
    selectedEntity,
    selectedNodes,
    selectedRights,
    setDialogOpen,
    setLegendCollapsed,
    setPanelCollapsed,
    t,
    title,
    toggleRight,
    userProfile,
  };
}

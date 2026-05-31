'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import {
  NetworkControlPanel,
  NETWORK_FILTER_ACTIVE_CLASS_NAMES,
} from '@/features/network/ui/NetworkControlPanel';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import { useNetworkFlowControls } from '@/features/network/hooks/useNetworkFlowControls';
import {
  buildDirectRelationships,
  buildIndirectRelationships,
  isAcceptedSiblingRelationship,
  type RelationshipEntry,
} from '@/features/network/logic/networkRelationshipHelpers';
import {
  filterEdgesByRelationshipStatus,
  filterEdgesByConnectionDirections,
  filterEdgesByRights,
  filterNodesByEdges,
} from '@/features/network/logic/networkFilterHelpers';
import {
  createGroupNodeLegendItem,
  getGroupNodeDisplayLabel,
  getGroupNodeStyle,
  getGroupNodeVisualVariant,
} from '@/features/network/ui/networkVisualHelpers';
import { useUserState } from '@/zero/users/useUserState';
import { useGroupState } from '@/zero/groups/useGroupState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  addUniqueValue,
  getAnchorUsageConnectionDirection,
  buildHierarchyRightEdgeDirections,
  buildNetworkRelationshipDialogData,
  buildRelationshipEdgeMarkers,
  createNetworkRelationshipEdgeData,
  getRelationshipStrokeColor,
  mergeNetworkConnectionDirection,
  mergeNetworkEdgeRelationshipDirection,
  mergeNetworkRightRelationshipKind,
} from '../logic/networkEdgeHelpers';
import {
  type NetworkConnectionDirection,
  type EditableRightsLabelEdgeData,
  type NetworkEdgeRelationshipDirection,
  type NetworkUserConnectionDirection,
} from '../types/networkEdge.types';
import { type NetworkGroupEntity } from '../types/network.types';

interface NetworkNode extends Node {
  data: {
    label: string;
    description?: string;
    level: number;
    type: 'user' | 'group';
    groupData?: NetworkGroupEntity;
  };
}

interface UserNetworkFlowProps {
  userId: string;
  onGroupClick?: (groupId: string, groupData: NetworkGroupEntity) => void;
  filterRight?: string; // Optional filter by specific right type
  title?: string;
  description?: string;
}

export function UserNetworkFlow({
  userId,
  onGroupClick,
  filterRight,
  title,
  description,
}: UserNetworkFlowProps) {
  const { t } = useTranslation();
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
  const [nodes, setNodes, onNodesChange] = useNodesState<NetworkNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<EditableRightsLabelEdgeData>>([]);

  const { userWithGroupMemberships } = useUserState({ userId, includeGroupMemberships: true });

  // Fetch all group relationships
  const { allRelationshipsWithGroups: allRelationships } = useGroupState({
    includeAllRelationshipsWithGroups: true,
  });

  const user = userWithGroupMemberships?.[0];
  const memberships = user?.group_memberships || [];
  const relationships = allRelationships || [];
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
  const userGroupIds = useMemo(() => new Set(userGroups.map(group => group.id)), [userGroups]);

  const allLabel = t('common.labels.all', 'All');

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
        label: t('common.network.incomingConnections', 'Eingehend'),
        active: connectionDirectionFilter === 'incoming',
        onToggle: () => setConnectionDirectionFilter('incoming'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.blue,
      },
      {
        id: 'outgoing',
        label: t('common.network.outgoingConnections', 'Ausgehend'),
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

    const buildEdgeData = (
      sourceId: string,
      targetId: string,
      rights: string[],
      relationshipKinds: ('active' | 'incoming' | 'outgoing')[],
      rightRelationshipKinds: Record<string, 'active' | 'incoming' | 'outgoing'>,
      relationshipType: 'parent' | 'child' | 'sibling' | 'membership',
      userConnectionDirections: NetworkUserConnectionDirection[],
      rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>,
      rightConnectionDirections?: Record<string, NetworkConnectionDirection>,
      relationshipDepth: 'direct' | 'indirect' = 'direct'
    ): EditableRightsLabelEdgeData =>
      createNetworkRelationshipEdgeData({
        rights,
        relationshipKinds,
        rightRelationshipKinds,
        relationshipType,
        rightEdgeDirections,
        rightConnectionDirections,
        userConnectionDirections,
        relationshipDepth,
        sourceName: groupNameMap.get(sourceId) ?? null,
        targetName: groupNameMap.get(targetId) ?? null,
      });

    // Add center node (user)
    addNode({
      id: userId,
      type: 'default',
      position: { x: 400, y: 300 },
      data: {
        label: userProfile.name,
        description: userProfile.bio,
        level: 0,
        type: 'user',
      },
      style: {
        background: '#e3f2fd',
        color: '#333',
        border: '3px solid #2196f3',
        borderRadius: '50%',
        padding: '20px',
        fontSize: '14px',
        fontWeight: 'bold',
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
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
        position: { x: 400 + xOffset, y: 300 + yOffset },
        data: {
          label: getGroupNodeDisplayLabel(group.name, 'current'),
          description: group.description ?? '',
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
          label: 'Member',
          style: { stroke: '#2196f3', strokeWidth: 2 },
          labelStyle: {
            fill: '#1976d2',
            fontWeight: 600,
            fontSize: '11px',
          },
          labelBgStyle: {
            fill: 'white',
            fillOpacity: 0.9,
          },
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#2196f3',
          },
          data: buildEdgeData(userId, group.id, [], ['active'], {}, 'membership', [
            'incoming',
            'outgoing',
          ]),
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
          ? buildDirectRelationships(stableRelationships, group.id, filterRight)
          : buildIndirectRelationships(stableRelationships, group.id, filterRight);
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
            level: parent.level,
            childId: parent.childId,
            isParent: true,
            connectedTo: group.id,
          });
        }

        const edgeTarget = showAllDepth && parent.childId ? parent.childId : group.id;
        const edgeId = `edge-parent-${parent.group.id}-to-${edgeTarget}`;

        // Only add edge if it doesn't already exist
        if (!allEdgesMap.has(edgeId)) {
          const rightEdgeDirections = buildHierarchyRightEdgeDirections(
            stableRelationships,
            parent.group.id,
            edgeTarget
          );
          const strokeColor = getRelationshipStrokeColor('#66bb6a', rightEdgeDirections);
          const edgeMarkers = buildRelationshipEdgeMarkers(strokeColor, rightEdgeDirections);
          allEdgesMap.set(edgeId, {
            id: edgeId,
            source: parent.group.id,
            target: edgeTarget,
            type: 'rightsLabel',
            animated: true,
            style: { stroke: strokeColor, strokeWidth: 2, strokeDasharray: '5 5' },
            ...edgeMarkers,
            data: buildEdgeData(
              parent.group.id,
              edgeTarget,
              parent.rights,
              parent.relationshipKinds,
              parent.rightRelationshipKinds,
              'parent',
              ['incoming'],
              rightEdgeDirections,
              Object.fromEntries(
                parent.rights.map(right => [
                  right,
                  getAnchorUsageConnectionDirection({
                    edgeDirection: rightEdgeDirections[right] ?? 'forward',
                    anchorSide: 'target',
                  }),
                ])
              ) as Record<string, NetworkConnectionDirection>,
              (parent.level ?? 1) === 1 ? 'direct' : 'indirect'
            ),
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
          const rightEdgeDirections = buildHierarchyRightEdgeDirections(
            stableRelationships,
            edgeSource,
            child.group.id
          );
          const strokeColor = getRelationshipStrokeColor('#ffb74d', rightEdgeDirections);
          const edgeMarkers = buildRelationshipEdgeMarkers(strokeColor, rightEdgeDirections);
          allEdgesMap.set(edgeId, {
            id: edgeId,
            source: edgeSource,
            target: child.group.id,
            type: 'rightsLabel',
            animated: true,
            style: { stroke: strokeColor, strokeWidth: 2, strokeDasharray: '5 5' },
            ...edgeMarkers,
            data: buildEdgeData(
              edgeSource,
              child.group.id,
              child.rights,
              child.relationshipKinds,
              child.rightRelationshipKinds,
              'parent',
              ['outgoing'],
              rightEdgeDirections,
              Object.fromEntries(
                child.rights.map(right => [
                  right,
                  getAnchorUsageConnectionDirection({
                    edgeDirection: rightEdgeDirections[right] ?? 'forward',
                    anchorSide: 'source',
                  }),
                ])
              ) as Record<string, NetworkConnectionDirection>,
              (child.level ?? 1) === 1 ? 'direct' : 'indirect'
            ),
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
        position: { x: 400 + xOffset, y: 300 + yOffset },
        data: {
          label: getGroupNodeDisplayLabel(parent.group.name, 'parent'),
          description: parent.group.description ?? '',
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
        position: { x: 400 + xOffset, y: 300 + yOffset },
        data: {
          label: getGroupNodeDisplayLabel(child.group.name, 'child'),
          description: child.group.description ?? '',
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
        rightConnectionDirections: Record<string, NetworkConnectionDirection>;
        userConnectionDirections: NetworkUserConnectionDirection[];
        sourceGroupType?: string | null;
        targetGroupType?: string | null;
      }
    >();

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
      let siblingEdgeEntry = siblingEdgeEntries.get(edgeKey);
      if (!siblingEdgeEntry) {
        siblingEdgeEntry = {
          sourceId: edgeSourceId,
          targetId: edgeTargetId,
          rights: [],
          relationshipKinds: [],
          rightRelationshipKinds: {},
          rightEdgeDirections: {},
          rightConnectionDirections: {},
          userConnectionDirections: [],
          sourceGroupType: relationship.group.group_type ?? null,
          targetGroupType: relationship.related_group.group_type ?? null,
        };
        siblingEdgeEntries.set(edgeKey, siblingEdgeEntry);
      }

      const right = relationship.with_right ?? '';
      if (right && !siblingEdgeEntry.rights.includes(right)) {
        siblingEdgeEntry.rights.push(right);
      }

      const relationshipContextGroupId = userGroupIds.has(edgeSourceId)
        ? edgeSourceId
        : userGroupIds.has(edgeTargetId)
          ? edgeTargetId
          : edgeSourceId;
      const relationshipKind =
        relationship.status == null ||
        relationship.status === 'active' ||
        relationship.status === 'accepted'
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
          : relationship.group_id === edgeTargetId && relationship.related_group_id === edgeSourceId
            ? 'backward'
            : null;

      if (right && rightDirection) {
        siblingEdgeEntry.rightEdgeDirections[right] = mergeNetworkEdgeRelationshipDirection(
          siblingEdgeEntry.rightEdgeDirections[right],
          rightDirection
        );
      }

      if (right) {
        const nextRightConnectionDirection =
          userGroupIds.has(relationship.group_id) && userGroupIds.has(relationship.related_group_id)
            ? 'bidirectional'
            : rightDirection && userGroupIds.has(edgeSourceId)
              ? getAnchorUsageConnectionDirection({
                  edgeDirection: rightDirection,
                  anchorSide: 'source',
                })
              : rightDirection && userGroupIds.has(edgeTargetId)
                ? getAnchorUsageConnectionDirection({
                    edgeDirection: rightDirection,
                    anchorSide: 'target',
                  })
                : undefined;

        if (nextRightConnectionDirection === 'bidirectional') {
          siblingEdgeEntry.rightConnectionDirections[right] = 'bidirectional';
        } else if (nextRightConnectionDirection) {
          siblingEdgeEntry.rightConnectionDirections[right] = mergeNetworkConnectionDirection(
            siblingEdgeEntry.rightConnectionDirections[right],
            nextRightConnectionDirection
          );
        }
      }

      if (userGroupIds.has(relationship.group_id)) {
        addUniqueValue(siblingEdgeEntry.userConnectionDirections, 'outgoing');
      }

      if (userGroupIds.has(relationship.related_group_id)) {
        addUniqueValue(siblingEdgeEntry.userConnectionDirections, 'incoming');
      }
    });

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
              x: anchorPosition.x + direction * (220 + tier * 40),
              y: anchorPosition.y + verticalOffset,
            },
            data: {
              label: getGroupNodeDisplayLabel(siblingGroup.name, siblingVisualVariant),
              description: siblingGroup.description ?? '',
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
          rightConnectionDirections,
          userConnectionDirections,
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
          const strokeColor = getRelationshipStrokeColor(
            isSiblingToSibling ? '#f59e0b' : '#a855f7',
            rightEdgeDirections
          );
          const edgeMarkers = buildRelationshipEdgeMarkers(strokeColor, rightEdgeDirections);

          allEdgesMap.set(edgeId, {
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: 'rightsLabel',
            animated: true,
            style: {
              stroke: strokeColor,
              strokeWidth: 2,
              strokeDasharray: isSiblingToSibling ? undefined : '6 4',
            },
            ...edgeMarkers,
            data: buildEdgeData(
              sourceId,
              targetId,
              rights,
              relationshipKinds,
              rightRelationshipKinds,
              'sibling',
              userConnectionDirections,
              rightEdgeDirections,
              rightConnectionDirections,
              'direct'
            ),
          });
        }
      );
    }

    setNodes(newNodes);
    setEdges(Array.from(allEdgesMap.values()));
  }, [
    userProfile,
    userId,
    userGroups,
    userGroupIds,
    relationshipDepthFilter,
    stableRelationships,
    filterRight,
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
    generateFlowChart();
  }, [generateFlowChart]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!isInteractive) return;

      const nodeData = node.data as NetworkNode['data'];

      // Open dialog with entity data
      if (nodeData.type === 'group' && nodeData.groupData) {
        setSelectedEntity({ type: 'group', data: nodeData.groupData });
        setDialogOpen(true);

        // Still call onGroupClick if provided
        if (onGroupClick) {
          onGroupClick(node.id, nodeData.groupData as NetworkGroupEntity);
        }
      } else if (nodeData.type === 'user') {
        setSelectedEntity({
          type: 'user',
          data: { id: userId, name: userProfile?.name ?? 'User' },
        });
        setDialogOpen(true);
      }
    },
    [isInteractive, onGroupClick, setDialogOpen, setSelectedEntity, userId, userProfile]
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

  if (!userProfile) {
    return (
      <div className="bg-background flex h-full min-h-0 w-full items-center justify-center rounded-lg border">
        <p className="text-muted-foreground">Loading user network...</p>
      </div>
    );
  }

  return (
    <NetworkFlowBase
      nodes={filteredNodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          boxShadow: selectedNodes.includes(node.id) ? '0 0 0 2px #ff0072' : undefined,
        },
      }))}
      edges={filteredEdges}
      nodesDraggable={isInteractive}
      nodesFocusable={isInteractive}
      nodesConnectable={isInteractive}
      edgesFocusable={isInteractive}
      onNodesChange={isInteractive ? onNodesChange : undefined}
      onEdgesChange={isInteractive ? onEdgesChange : undefined}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onInteractiveChange={handleInteractiveChange}
      containerClassName="h-full min-h-0"
      panel={
        <NetworkControlPanel
          title={title ?? t('common.network.userNetwork', 'User Network')}
          description={
            description ??
            t('common.network.userNetworkDescription', {
              userName: userProfile.name,
            })
          }
          panelCollapsed={panelCollapsed}
          onPanelCollapsedChange={setPanelCollapsed}
          legendCollapsed={legendCollapsed}
          onLegendCollapsedChange={setLegendCollapsed}
          legendTitle={t('common.network.legend')}
          legendItems={[
            {
              id: 'user',
              label: t('common.network.user', 'User'),
              swatchClassName: 'h-4 w-4 rounded-full border-2 border-[#2196f3] bg-[#e3f2fd]',
            },
            createGroupNodeLegendItem({
              id: 'current-group',
              label: t('common.network.currentGroup', 'Aktuelle Gruppe'),
              visualVariant: 'current',
            }),
            createGroupNodeLegendItem({
              id: 'parent-group',
              label: t('common.network.parentGroup', 'Übergeordnete Gruppe'),
              visualVariant: 'parent',
            }),
            createGroupNodeLegendItem({
              id: 'child-group',
              label: t('common.network.childGroup', 'Untergeordnete Gruppe'),
              visualVariant: 'child',
            }),
            createGroupNodeLegendItem({
              id: 'sibling-group-open',
              label: t('common.network.siblingGroupOpen', 'Geschwistergruppe offen'),
              visualVariant: 'sibling-open',
            }),
            createGroupNodeLegendItem({
              id: 'sibling-group-elected',
              label: t('common.network.siblingGroupElected', 'Geschwistergruppe gewählt'),
              visualVariant: 'sibling-elected',
            }),
            createGroupNodeLegendItem({
              id: 'sibling-group-parliament',
              label: t('common.network.siblingGroupParliament', 'Geschwistergruppe Parlament'),
              visualVariant: 'sibling-parliament',
            }),
          ]}
          depthFilters={depthFilters}
          isInteractive={isInteractive}
          onInteractiveChange={handleInteractiveChange}
          directLabel={t('common.network.direct')}
          indirectLabel={t('common.network.indirect')}
          lockLabel={t('common.network.lockEditor')}
          unlockLabel={t('common.network.unlockEditor')}
          showRightsFilter={!filterRight}
          selectedRights={selectedRights}
          onToggleRight={toggleRight}
          connectionDirectionFilters={connectionDirectionFilters}
          relationshipStatusFilters={relationshipStatusFilters}
          showConnectionDirectionLegend
          connectionDirectionLegendTitle={t(
            'common.network.connectionDirections',
            'Verbindungsrichtungen'
          )}
          bidirectionalConnectionLabel={t('common.network.bidirectional', 'Beidseitig')}
          incomingConnectionLabel={t('common.network.incomingConnections', 'Eingehend')}
          outgoingConnectionLabel={t('common.network.outgoingConnections', 'Ausgehend')}
          filterRight={filterRight}
          filteredByPrefix={t('common.network.filteredBy')}
          showRightsLegend
        />
      }
    >
      <NetworkEntityDialog open={dialogOpen} onOpenChange={setDialogOpen} entity={selectedEntity} />
    </NetworkFlowBase>
  );
}

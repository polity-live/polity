'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import {
  getGroupNodeDisplayLabel,
  getGroupNodeStyle,
  getGroupNodeVisualTokens,
  getGroupNodeVisualVariant,
  getNetworkSelectionStyle,
} from '@/features/network/ui/networkVisualHelpers';
import { NETWORK_FILTER_ACTIVE_CLASS_NAMES } from '@/features/network/ui/NetworkControlPanel';
import { useNetworkFlowControls } from '@/features/network/hooks/useNetworkFlowControls';
import { usePersistedNetworkLayout } from '@/features/network/hooks/usePersistedNetworkLayout';
import { useEditableNetworkLayout } from '@/features/network/hooks/useEditableNetworkLayout';
import { resolveInitialNetworkNodeOverlaps } from '@/features/network/logic/networkLayoutHelpers';
import { useGroupNetwork } from '@/features/network/hooks/useGroupNetwork';
import {
  addUniqueValue,
  buildHierarchyRightEdgeDirections,
  buildNetworkRelationshipDialogData,
  buildNetworkRelationshipEdge,
  buildSingleDirectionRightEdgeDirections,
  mergeNetworkEdgeRelationshipDirection,
  mergeNetworkRightRelationshipKind,
} from '@/features/network/logic/networkEdgeHelpers';
import {
  buildDirectRelationships,
  buildIndirectRelationships,
  buildMixedRelationshipGraph,
  getAcceptedSiblingGroups,
  getGroupRelationshipKind,
  isActiveGroupRelationshipStatus,
  isAcceptedSiblingRelationship,
  type RelationshipEntry,
  type NetworkRelationshipKind,
  type RelationshipTraversalMode,
  type SiblingAttachmentEntry,
} from '@/features/network/logic/networkRelationshipHelpers';
import {
  filterEdgesByRelationshipStatus,
  filterEdgesByConnectionDirections,
  filterEdgesByRights,
  filterNodesByEdges,
} from '@/features/network/logic/networkFilterHelpers';
import {
  getDefaultWorkflowId,
  sortWorkflowsByName,
  toWorkflowVisualizationWorkflow,
} from '@/features/network/logic/workflowVisualizationHelpers';
import { useWorkflowState } from '@/zero/network/useWorkflowState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type {
  EditableRightsLabelEdgeData,
  NetworkEdgeRelationshipDirection,
} from '@/features/network/types/networkEdge.types';
import type {
  CanonicalMembershipMode,
  GroupRelationshipType,
  NetworkGroupEntity,
} from '@/features/network/types/network.types';

interface GroupNode extends Node {
  data: {
    label: string;
    description?: string;
    level: number;
    role?: 'parent' | 'child' | 'center' | 'sibling';
    groupType?: 'base' | 'hierarchical' | 'sibling';
    groupEntity?: NetworkGroupEntity;
  };
}

export interface GroupNetworkFlowProps {
  groupId: string;
  onGroupClick?: (groupId: string, groupData: NetworkGroupEntity) => void;
  filterRight?: string;
  title?: string;
  description?: string;
  showGroupDialogOnClick?: boolean;
  showWorkflowView?: boolean;
  layoutScopeKey?: string;
  highlightGroupIds?: string[];
  highlightEdgePairs?: {
    sourceGroupId: string;
    targetGroupId: string;
  }[];
}

type RelationshipDirectionKey = string;

const NETWORK_CENTER = { x: 400, y: 300 };
const NODE_WIDTH = 180;
const HORIZONTAL_SPACING = 210;
const VERTICAL_SPACING = 180;
const SIBLING_RADIUS = 250;

function shouldReplaceMembershipMode(
  existingMode: CanonicalMembershipMode | null | undefined,
  nextMode: CanonicalMembershipMode | null | undefined
) {
  if (!nextMode) {
    return false;
  }

  if (!existingMode) {
    return true;
  }

  return existingMode === 'none' && nextMode !== 'none';
}

function sortGroupsByCreatedAt<
  TGroup extends {
    created_at?: string | number | Date | null;
    name?: string | null;
  },
>(groups: readonly TGroup[]) {
  return [...groups].sort((left, right) => {
    const leftValue = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightValue = right.created_at ? new Date(right.created_at).getTime() : 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }

    return (left.name ?? '').localeCompare(right.name ?? '');
  });
}

function getSiblingNodeOffset(index: number, total: number) {
  if (index === 0) {
    return { x: SIBLING_RADIUS, y: 0 };
  }

  if (index === 1) {
    return { x: -SIBLING_RADIUS, y: 0 };
  }

  const remaining = total - 2;
  const angle = -Math.PI / 2 + ((index - 2 + 0.5) * 2 * Math.PI) / Math.max(remaining, 1);

  return {
    x: Math.cos(angle) * SIBLING_RADIUS,
    y: Math.sin(angle) * SIBLING_RADIUS,
  };
}

function getDescriptionText(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function mergeRelationshipEntryMaps(
  entries: RelationshipEntry[],
  target: Map<string, RelationshipEntry>
) {
  entries.forEach(entry => {
    const existing = target.get(entry.group.id);

    if (!existing) {
      target.set(entry.group.id, {
        group: entry.group,
        rights: [...entry.rights],
        relationshipKinds: [...entry.relationshipKinds],
        rightRelationshipKinds: { ...entry.rightRelationshipKinds },
        sourceRelationshipType: entry.sourceRelationshipType ?? null,
        membershipMode: entry.membershipMode ?? null,
        memberSourceGroupId: entry.memberSourceGroupId ?? null,
        memberTargetGroupId: entry.memberTargetGroupId ?? null,
        requiredSourceRoleId: entry.requiredSourceRoleId ?? null,
        requiredSourceRoleName: entry.requiredSourceRoleName ?? null,
        membershipDirection: entry.membershipDirection ?? null,
        level: entry.level,
        childId: entry.childId,
        parentId: entry.parentId,
      });
      return;
    }

    entry.rights.forEach(right => addUniqueValue(existing.rights, right));
    entry.relationshipKinds.forEach(kind => addUniqueValue(existing.relationshipKinds, kind));
    existing.sourceRelationshipType =
      existing.sourceRelationshipType ?? entry.sourceRelationshipType ?? null;

    Object.entries(entry.rightRelationshipKinds).forEach(([right, kind]) => {
      existing.rightRelationshipKinds[right] = mergeNetworkRightRelationshipKind(
        existing.rightRelationshipKinds[right],
        kind
      ) as NetworkRelationshipKind;
    });

    if (shouldReplaceMembershipMode(existing.membershipMode, entry.membershipMode)) {
      existing.membershipMode = entry.membershipMode;
      existing.memberSourceGroupId = entry.memberSourceGroupId ?? null;
      existing.memberTargetGroupId = entry.memberTargetGroupId ?? null;
      existing.requiredSourceRoleId = entry.requiredSourceRoleId ?? null;
      existing.requiredSourceRoleName = entry.requiredSourceRoleName ?? null;
      if (entry.membershipDirection) {
        existing.membershipDirection = entry.membershipDirection;
      }
    }

    const existingLevel = existing.level ?? Number.POSITIVE_INFINITY;
    const nextLevel = entry.level ?? Number.POSITIVE_INFINITY;

    if (nextLevel < existingLevel) {
      existing.level = entry.level;
      existing.childId = entry.childId;
      existing.parentId = entry.parentId;
    } else {
      if (!existing.childId && entry.childId) {
        existing.childId = entry.childId;
      }

      if (!existing.parentId && entry.parentId) {
        existing.parentId = entry.parentId;
      }
    }
  });
}

export function useGroupNetworkFlowController({
  groupId,
  onGroupClick,
  filterRight,
  title,
  description,
  showGroupDialogOnClick = true,
  showWorkflowView = true,
  layoutScopeKey,
  highlightGroupIds = [],
  highlightEdgePairs = [],
}: GroupNetworkFlowProps) {
  const { t } = useTranslation();
  const {
    savedLayout,
    hasSavedLayout,
    isLoading: isLayoutLoading,
    persistLayout,
    resetLayout,
  } = usePersistedNetworkLayout({
    scopeKey: layoutScopeKey ?? `group:${groupId}`,
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
  const [nodes, setNodes] = useNodesState<GroupNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<EditableRightsLabelEdgeData>>([]);
  const {
    currentLayout,
    hasLayoutChanges,
    nodePositionsRef,
    edgeBendPointsRef,
    fixedNodeIdsRef,
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

  // View mode: 'hierarchy' | 'workflow'
  const [viewMode, setViewMode] = useState<'hierarchy' | 'workflow'>('hierarchy');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');

  // Fetch workflows for this group
  const { groupWorkflows } = useWorkflowState({ groupId });
  const sortedGroupWorkflows = useMemo(() => sortWorkflowsByName(groupWorkflows), [groupWorkflows]);

  useEffect(() => {
    const defaultWorkflowId = getDefaultWorkflowId(sortedGroupWorkflows, selectedWorkflowId);
    if (defaultWorkflowId !== selectedWorkflowId) {
      setSelectedWorkflowId(defaultWorkflowId);
    }
  }, [selectedWorkflowId, sortedGroupWorkflows]);

  const selectedWorkflow = useMemo(
    () => sortedGroupWorkflows.find(w => w.id === selectedWorkflowId),
    [selectedWorkflowId, sortedGroupWorkflows]
  );
  const selectedWorkflowVisualization = useMemo(
    () => (selectedWorkflow ? toWorkflowVisualizationWorkflow(selectedWorkflow) : null),
    [selectedWorkflow]
  );

  const { group, allRelationships } = useGroupNetwork(groupId);
  const graphRootGroup = group;
  const graphRootGroupId = graphRootGroup?.id ?? groupId;
  const highlightedGroupIds = useMemo(() => new Set(highlightGroupIds), [highlightGroupIds]);
  const highlightedEdgeKeys = useMemo(
    () =>
      new Set(
        highlightEdgePairs.map(edgePair => `${edgePair.sourceGroupId}->${edgePair.targetGroupId}`)
      ),
    [highlightEdgePairs]
  );

  const stableRelationships = useMemo(() => {
    return allRelationships
      .filter(rel => getGroupRelationshipKind(rel, graphRootGroupId) !== null)
      .filter(rel => !filterRight || (rel.with_right ?? '') === filterRight);
  }, [allRelationships, filterRight, graphRootGroupId]);
  const relationshipTraversalMode: RelationshipTraversalMode = filterRight ? 'right' : 'structure';

  const visibleSiblingRelationships = useMemo(() => {
    if (relationshipTraversalMode === 'right') {
      return [];
    }

    const siblingRelationships = stableRelationships.filter(
      rel => rel.relationship_type === 'sibling'
    );

    if (relationshipStatusFilter === 'active') {
      return siblingRelationships.filter(isAcceptedSiblingRelationship);
    }

    return siblingRelationships.filter(
      rel => getGroupRelationshipKind(rel, graphRootGroupId) === relationshipStatusFilter
    );
  }, [graphRootGroupId, relationshipStatusFilter, relationshipTraversalMode, stableRelationships]);

  const siblingGroups = useMemo(() => {
    if (!graphRootGroup) {
      return [];
    }

    if (relationshipStatusFilter === 'active') {
      return sortGroupsByCreatedAt(
        getAcceptedSiblingGroups(visibleSiblingRelationships, graphRootGroup.id)
      ).filter(siblingGroup => siblingGroup.id !== graphRootGroup.id);
    }

    const requestSiblingGroups = new Map<string, NetworkGroupEntity>();

    visibleSiblingRelationships.forEach(relationship => {
      const partnerGroup =
        relationship.group?.id === graphRootGroupId
          ? relationship.related_group
          : relationship.related_group?.id === graphRootGroupId
            ? relationship.group
            : null;

      if (!partnerGroup || partnerGroup.id === graphRootGroupId) {
        return;
      }

      if (!requestSiblingGroups.has(partnerGroup.id)) {
        requestSiblingGroups.set(partnerGroup.id, partnerGroup);
      }
    });

    return sortGroupsByCreatedAt(Array.from(requestSiblingGroups.values()));
  }, [graphRootGroup, graphRootGroupId, relationshipStatusFilter, visibleSiblingRelationships]);

  const traversalRelationships = useMemo(() => {
    const topologyRelationships =
      relationshipTraversalMode === 'right'
        ? stableRelationships.filter(rel => Boolean(rel.grant_id && rel.with_right))
        : stableRelationships.filter(rel => rel.relationship_type !== 'sibling');

    if (relationshipStatusFilter === 'active') {
      return topologyRelationships.filter(rel => isActiveGroupRelationshipStatus(rel.status));
    }

    return topologyRelationships.filter(
      rel => getGroupRelationshipKind(rel, graphRootGroupId) === relationshipStatusFilter
    );
  }, [graphRootGroupId, relationshipStatusFilter, relationshipTraversalMode, stableRelationships]);

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
    if (!group || !graphRootGroup) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const showAllDepth = relationshipDepthFilter === 'all';
    const showIndirectOnly = relationshipDepthFilter === 'indirect';
    const parentEntriesMap = new Map<string, RelationshipEntry>();
    const childEntriesMap = new Map<string, RelationshipEntry>();
    const mixedRelationshipGraph =
      relationshipStatusFilter === 'active' && relationshipDepthFilter === 'all'
        ? buildMixedRelationshipGraph(
            stableRelationships,
            graphRootGroupId,
            filterRight,
            graphRootGroupId,
            relationshipTraversalMode
          )
        : null;

    if (mixedRelationshipGraph) {
      mergeRelationshipEntryMaps(mixedRelationshipGraph.parents, parentEntriesMap);
      mergeRelationshipEntryMaps(mixedRelationshipGraph.children, childEntriesMap);
    } else {
      const baseRelationshipTree =
        relationshipDepthFilter === 'direct'
          ? buildDirectRelationships(
              traversalRelationships,
              graphRootGroupId,
              filterRight,
              graphRootGroupId,
              relationshipTraversalMode
            )
          : buildIndirectRelationships(
              traversalRelationships,
              graphRootGroupId,
              filterRight,
              graphRootGroupId,
              relationshipTraversalMode
            );

      mergeRelationshipEntryMaps(baseRelationshipTree.parents, parentEntriesMap);
      mergeRelationshipEntryMaps(baseRelationshipTree.children, childEntriesMap);
    }

    const relationshipTree = {
      parents: Array.from(parentEntriesMap.values()),
      children: Array.from(childEntriesMap.values()),
    };
    const parents = showIndirectOnly
      ? relationshipTree.parents.filter(parent => (parent.level ?? 1) > 1)
      : relationshipTree.parents;
    const children = showIndirectOnly
      ? relationshipTree.children.filter(child => (child.level ?? 1) > 1)
      : relationshipTree.children;

    const newNodes: GroupNode[] = [];
    const newEdges: Edge[] = [];
    const rootSiblingGroups = siblingGroups;
    const rootSiblingGroupIds = new Set(rootSiblingGroups.map(siblingGroup => siblingGroup.id));
    const anchoredSiblingAttachments =
      mixedRelationshipGraph?.siblingAttachments.filter(
        attachment =>
          attachment.anchorId !== graphRootGroupId && !rootSiblingGroupIds.has(attachment.group.id)
      ) ?? [];
    const renderedNodeIdsByGroupId = new Map<string, string>();
    const renderedNodePositionsById = new Map<string, { x: number; y: number }>();
    const siblingAnchorByGroupId = new Map<string, string>();

    // Build a name lookup for resolving edge source/target names
    const groupNameMap = new Map<string, string>();
    groupNameMap.set(graphRootGroupId, graphRootGroup.name ?? '');
    parents.forEach(p => groupNameMap.set(`parent-${p.group.id}`, p.group.name ?? ''));
    parents.forEach(p => groupNameMap.set(p.group.id, p.group.name ?? ''));
    children.forEach(c => groupNameMap.set(`child-${c.group.id}`, c.group.name ?? ''));
    children.forEach(c => groupNameMap.set(c.group.id, c.group.name ?? ''));
    rootSiblingGroups.forEach(siblingGroup =>
      groupNameMap.set(siblingGroup.id, siblingGroup.name ?? '')
    );
    anchoredSiblingAttachments.forEach(attachment => {
      groupNameMap.set(attachment.group.id, attachment.group.name ?? '');
    });

    const registerRenderedNode = (
      groupId: string,
      nodeId: string,
      position: { x: number; y: number }
    ) => {
      renderedNodeIdsByGroupId.set(groupId, nodeId);
      renderedNodePositionsById.set(nodeId, position);
    };

    const resolveRenderedNodeId = (groupId: string) =>
      renderedNodeIdsByGroupId.get(groupId) ?? null;

    // Add center node (current graph root)
    const rootPosition = nodePositionsRef.current[graphRootGroupId] ?? NETWORK_CENTER;
    newNodes.push({
      id: graphRootGroupId,
      type: 'default',
      position: rootPosition,
      data: {
        label: getGroupNodeDisplayLabel(graphRootGroup.name, 'current'),
        description: getDescriptionText(graphRootGroup.description) ?? '',
        level: 0,
        role: 'center',
        groupEntity: {
          ...graphRootGroup,
        },
        groupType:
          (graphRootGroup as { group_type?: string }).group_type === 'hierarchical'
            ? 'hierarchical'
            : (graphRootGroup as { group_type?: string }).group_type === 'sibling'
              ? 'sibling'
              : 'base',
      },
      style: getGroupNodeStyle('current', {
        width: 180,
        fontSize: '14px',
        fontWeight: '700',
        padding: '10px 12px',
      }),
    });
    registerRenderedNode(graphRootGroupId, graphRootGroupId, rootPosition);

    const siblingNodePositions = rootSiblingGroups.map((siblingGroup, index) => {
      const offset = getSiblingNodeOffset(index, rootSiblingGroups.length);
      const nodeId = siblingGroup.id;
      const position = nodePositionsRef.current[nodeId] ?? {
        x: NETWORK_CENTER.x + offset.x,
        y: NETWORK_CENTER.y + offset.y,
      };
      const isCurrentSibling = groupId === siblingGroup.id;
      const siblingVisualVariant = isCurrentSibling
        ? 'current'
        : getGroupNodeVisualVariant({
            role: 'sibling',
            siblingMembershipMode: siblingGroup.sibling_membership_mode,
          });

      newNodes.push({
        id: nodeId,
        type: 'default',
        position,
        data: {
          label: getGroupNodeDisplayLabel(siblingGroup.name, siblingVisualVariant),
          description: getDescriptionText(siblingGroup.description),
          level: 1,
          role: 'sibling',
          groupType:
            siblingGroup.group_type === 'hierarchical'
              ? 'hierarchical'
              : siblingGroup.group_type === 'sibling'
                ? 'sibling'
                : 'base',
          groupEntity: {
            ...siblingGroup,
          },
        },
        style: getGroupNodeStyle(siblingVisualVariant, {
          width: NODE_WIDTH,
          fontSize: '12px',
          fontWeight: isCurrentSibling ? '700' : '600',
        }),
      });
      registerRenderedNode(siblingGroup.id, nodeId, position);
      siblingAnchorByGroupId.set(siblingGroup.id, graphRootGroupId);

      return position;
    });

    const topAnchorY =
      siblingNodePositions.length > 0
        ? Math.min(...siblingNodePositions.map(position => position.y))
        : NETWORK_CENTER.y;
    const bottomAnchorY =
      siblingNodePositions.length > 0
        ? Math.max(...siblingNodePositions.map(position => position.y))
        : NETWORK_CENTER.y;

    const pushRelationshipEdge = ({
      edgeId,
      sourceId,
      targetId,
      sourceGroupId,
      targetGroupId,
      rights,
      structuralType,
      relationshipKinds,
      rightRelationshipKinds,
      membershipMode,
      memberSourceGroupId,
      memberTargetGroupId,
      requiredSourceRoleId,
      requiredSourceRoleName,
      rightEdgeDirections,
      relationshipDepth,
      strokeColor,
      strokeDasharray,
    }: {
      edgeId: RelationshipDirectionKey;
      sourceId: string;
      targetId: string;
      sourceGroupId: string;
      targetGroupId: string;
      rights: string[];
      structuralType: GroupRelationshipType;
      relationshipKinds: NetworkRelationshipKind[];
      rightRelationshipKinds: Record<string, NetworkRelationshipKind>;
      membershipMode: CanonicalMembershipMode | null | undefined;
      memberSourceGroupId?: string | null;
      memberTargetGroupId?: string | null;
      requiredSourceRoleId?: string | null;
      requiredSourceRoleName?: string | null;
      rightEdgeDirections: Record<string, NetworkEdgeRelationshipDirection> | undefined;
      relationshipDepth: 'direct' | 'indirect';
      strokeColor: string;
      strokeDasharray?: string;
    }) => {
      newEdges.push(
        buildNetworkRelationshipEdge({
          edgeId,
          sourceId,
          targetId,
          sourceGroupId,
          targetGroupId,
          structuralType,
          rights,
          relationshipKinds,
          rightRelationshipKinds,
          membershipMode,
          memberSourceGroupId,
          memberTargetGroupId,
          membershipRequiredSourceRoleId: requiredSourceRoleId,
          membershipRequiredSourceRoleName: requiredSourceRoleName,
          rightEdgeDirections,
          relationshipDepth,
          fallbackStrokeColor: strokeColor,
          strokeDasharray,
          sourceName: groupNameMap.get(sourceGroupId) ?? null,
          targetName: groupNameMap.get(targetGroupId) ?? null,
          graphRootGroupId,
          bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
          edgeEditingEnabled: isInteractiveRef.current,
          onBendPointsChange: handleEdgeBendPointsChange,
        })
      );
    };

    const siblingRelationshipEntries = new Map<
      RelationshipDirectionKey,
      {
        sourceId: string;
        targetId: string;
        sourceGroupId: string;
        targetGroupId: string;
        rights: string[];
        relationshipKinds: NetworkRelationshipKind[];
        rightRelationshipKinds: Record<string, NetworkRelationshipKind>;
        membershipMode?: CanonicalMembershipMode | null;
        memberSourceGroupId?: string | null;
        memberTargetGroupId?: string | null;
        requiredSourceRoleId?: string | null;
        requiredSourceRoleName?: string | null;
        rightEdgeDirections: Record<string, NetworkEdgeRelationshipDirection>;
      }
    >();

    // Add parent nodes
    parents.forEach((parent, index: number) => {
      const level = parent.level || 1;
      const y = topAnchorY - VERTICAL_SPACING * level;
      const x = NETWORK_CENTER.x + (index - (parents.length - 1) / 2) * HORIZONTAL_SPACING;

      // Use a unique ID for the parent node instance in the graph
      const parentNodeId = `parent-${parent.group.id}`;

      const isHierarchical = parent.group.group_type === 'hierarchical';

      newNodes.push({
        id: parentNodeId,
        type: 'default',
        position: nodePositionsRef.current[parentNodeId] ?? { x, y },
        data: {
          label: getGroupNodeDisplayLabel(parent.group.name, 'parent'),
          description: getDescriptionText(parent.group.description),
          level,
          role: 'parent',
          groupType: isHierarchical ? 'hierarchical' : 'base',
          groupEntity: {
            ...parent.group,
          },
        },
        style: getGroupNodeStyle('parent', {
          width: 180,
          fontSize: '12px',
          fontWeight: isHierarchical ? '700' : '600',
        }),
      });
      registerRenderedNode(parent.group.id, parentNodeId, { x, y });
    });

    // Add child nodes
    children.forEach((child, index: number) => {
      const level = child.level || 1;
      const y = bottomAnchorY + VERTICAL_SPACING * level;
      const x = NETWORK_CENTER.x + (index - (children.length - 1) / 2) * HORIZONTAL_SPACING;

      const childNodeId = `child-${child.group.id}`;
      const isHierarchicalChild = child.group.group_type === 'hierarchical';

      newNodes.push({
        id: childNodeId,
        type: 'default',
        position: nodePositionsRef.current[childNodeId] ?? { x, y },
        data: {
          label: getGroupNodeDisplayLabel(child.group.name, 'child'),
          description: getDescriptionText(child.group.description),
          level,
          role: 'child',
          groupType: isHierarchicalChild ? 'hierarchical' : 'base',
          groupEntity: {
            ...child.group,
          },
        },
        style: getGroupNodeStyle('child', {
          width: 180,
          fontSize: '12px',
          fontWeight: isHierarchicalChild ? '700' : '600',
        }),
      });
      registerRenderedNode(child.group.id, childNodeId, { x, y });
    });

    if (!showIndirectOnly) {
      const siblingAttachmentsByAnchor = new Map<string, SiblingAttachmentEntry[]>();

      anchoredSiblingAttachments.forEach(attachment => {
        if (renderedNodeIdsByGroupId.has(attachment.group.id)) {
          return;
        }

        const siblingEntries = siblingAttachmentsByAnchor.get(attachment.anchorId) ?? [];
        siblingEntries.push(attachment);
        if (!siblingAttachmentsByAnchor.has(attachment.anchorId)) {
          siblingAttachmentsByAnchor.set(attachment.anchorId, siblingEntries);
        }
      });

      siblingAttachmentsByAnchor.forEach((attachments, anchorGroupId) => {
        const anchorNodeId = resolveRenderedNodeId(anchorGroupId);
        if (!anchorNodeId) {
          return;
        }

        // resolveRenderedNodeId only returns nodes registered in both render maps.
        const anchorPosition = renderedNodePositionsById.get(anchorNodeId) as {
          x: number;
          y: number;
        };

        attachments.forEach((attachment, index) => {
          if (renderedNodeIdsByGroupId.has(attachment.group.id)) {
            return;
          }

          const siblingVisualVariant = getGroupNodeVisualVariant({
            role: 'sibling',
            siblingMembershipMode: attachment.group.sibling_membership_mode,
          });
          const tier = Math.floor(index / 2);
          const direction = index % 2 === 0 ? 1 : -1;
          const verticalOffset = (tier % 2 === 0 ? -1 : 1) * (45 + Math.floor(tier / 2) * 70);
          const nodeId = attachment.group.id;
          const position = nodePositionsRef.current[nodeId] ?? {
            x: anchorPosition.x + direction * (220 + tier * 40),
            y: anchorPosition.y + verticalOffset,
          };

          newNodes.push({
            id: nodeId,
            type: 'default',
            position,
            data: {
              label: getGroupNodeDisplayLabel(attachment.group.name, siblingVisualVariant),
              description: getDescriptionText(attachment.group.description),
              level: attachment.level ?? 1,
              role: 'sibling',
              groupType:
                attachment.group.group_type === 'hierarchical'
                  ? 'hierarchical'
                  : attachment.group.group_type === 'sibling'
                    ? 'sibling'
                    : 'base',
              groupEntity: {
                ...attachment.group,
              },
            },
            style: getGroupNodeStyle(siblingVisualVariant, {
              width: NODE_WIDTH,
              fontSize: '12px',
              fontWeight: '600',
            }),
          });

          registerRenderedNode(attachment.group.id, nodeId, position);
          siblingAnchorByGroupId.set(attachment.group.id, anchorGroupId);
        });
      });

      const renderedGroupIds = new Set(renderedNodeIdsByGroupId.keys());

      visibleSiblingRelationships.forEach(rel => {
        const sourceGroupId = rel.group_id;
        const targetGroupId = rel.related_group_id;

        if (!renderedGroupIds.has(sourceGroupId) || !renderedGroupIds.has(targetGroupId)) {
          return;
        }

        const sourceAnchorsTarget = siblingAnchorByGroupId.get(targetGroupId) === sourceGroupId;
        const targetAnchorsSource = siblingAnchorByGroupId.get(sourceGroupId) === targetGroupId;
        const [edgeSourceGroupId, edgeTargetGroupId] = sourceAnchorsTarget
          ? [sourceGroupId, targetGroupId]
          : targetAnchorsSource
            ? [targetGroupId, sourceGroupId]
            : sourceGroupId === graphRootGroupId
              ? [sourceGroupId, targetGroupId]
              : targetGroupId === graphRootGroupId
                ? [targetGroupId, sourceGroupId]
                : sourceGroupId.localeCompare(targetGroupId) <= 0
                  ? [sourceGroupId, targetGroupId]
                  : [targetGroupId, sourceGroupId];
        // Sibling relationships are assembled only from groups registered above.
        const edgeSourceId = resolveRenderedNodeId(edgeSourceGroupId) as string;
        const edgeTargetId = resolveRenderedNodeId(edgeTargetGroupId) as string;

        const edgeKey = `${edgeSourceId}<->${edgeTargetId}`;
        const relationshipKind = getGroupRelationshipKind(rel, graphRootGroupId);
        const right = rel.with_right ?? '';

        let entry = siblingRelationshipEntries.get(edgeKey);
        if (!entry) {
          entry = {
            sourceId: edgeSourceId,
            targetId: edgeTargetId,
            sourceGroupId: edgeSourceGroupId,
            targetGroupId: edgeTargetGroupId,
            rights: [],
            relationshipKinds: [],
            rightRelationshipKinds: {},
            membershipMode: null,
            memberSourceGroupId: null,
            memberTargetGroupId: null,
            requiredSourceRoleId: null,
            requiredSourceRoleName: null,
            rightEdgeDirections: {},
          };
          siblingRelationshipEntries.set(edgeKey, entry);
        }

        if (right && !entry.rights.includes(right)) {
          entry.rights.push(right);
        }

        if (relationshipKind && !entry.relationshipKinds.includes(relationshipKind)) {
          addUniqueValue(entry.relationshipKinds, relationshipKind);
        }

        if (right && relationshipKind) {
          entry.rightRelationshipKinds[right] = mergeNetworkRightRelationshipKind(
            entry.rightRelationshipKinds[right],
            relationshipKind
          ) as NetworkRelationshipKind;
        }

        if (shouldReplaceMembershipMode(entry.membershipMode, rel.membership_mode)) {
          entry.membershipMode = rel.membership_mode;
          entry.memberSourceGroupId = rel.member_source_group_id ?? null;
          entry.memberTargetGroupId = rel.member_target_group_id ?? null;
          entry.requiredSourceRoleId = rel.required_source_role_id ?? null;
          entry.requiredSourceRoleName = rel.required_source_role?.name ?? null;
        }

        const rightDirection =
          rel.group_id === edgeSourceGroupId && rel.related_group_id === edgeTargetGroupId
            ? 'forward'
            : 'backward';

        if (right && rightDirection) {
          entry.rightEdgeDirections[right] = mergeNetworkEdgeRelationshipDirection(
            entry.rightEdgeDirections[right],
            rightDirection
          );
        }
      });
    }

    parents.forEach(parent => {
      // Every parent entry was rendered and registered above.
      const parentNodeId = resolveRenderedNodeId(parent.group.id);
      if (!parentNodeId) return;

      const rightMode = relationshipTraversalMode === 'right' && Boolean(filterRight);
      const hierarchyChildGroupId =
        showAllDepth && parent.childId && parent.childId !== graphRootGroupId
          ? parent.childId
          : graphRootGroupId;
      const hierarchyChildNodeId = resolveRenderedNodeId(hierarchyChildGroupId) ?? graphRootGroupId;
      const edgeSourceGroupId = rightMode ? hierarchyChildGroupId : parent.group.id;
      const edgeTargetGroupId = rightMode ? parent.group.id : hierarchyChildGroupId;
      const edgeSourceId = rightMode ? hierarchyChildNodeId : parentNodeId;
      const edgeTargetId = rightMode ? parentNodeId : hierarchyChildNodeId;
      const rightEdgeDirections =
        rightMode && filterRight
          ? buildSingleDirectionRightEdgeDirections([filterRight], 'forward')
          : buildHierarchyRightEdgeDirections(
              stableRelationships,
              parent.group.id,
              hierarchyChildGroupId
            );

      pushRelationshipEdge({
        edgeId: rightMode
          ? `edge-${edgeSourceId}-to-parent-${parent.group.id}`
          : `edge-parent-${parent.group.id}-to-${edgeTargetId}`,
        sourceId: edgeSourceId,
        targetId: edgeTargetId,
        sourceGroupId: edgeSourceGroupId,
        targetGroupId: edgeTargetGroupId,
        rights: parent.rights,
        structuralType:
          relationshipTraversalMode === 'right'
            ? (parent.sourceRelationshipType ?? 'parent')
            : 'parent',
        relationshipKinds: parent.relationshipKinds,
        rightRelationshipKinds: parent.rightRelationshipKinds,
        membershipMode: parent.membershipMode,
        memberSourceGroupId: parent.memberSourceGroupId,
        memberTargetGroupId: parent.memberTargetGroupId,
        requiredSourceRoleId: parent.requiredSourceRoleId,
        requiredSourceRoleName: parent.requiredSourceRoleName,
        rightEdgeDirections,
        relationshipDepth: (parent.level ?? 1) === 1 ? 'direct' : 'indirect',
        strokeColor: getGroupNodeVisualTokens('parent').borderColor,
        strokeDasharray: '5 5',
      });
    });

    children.forEach(child => {
      // Every child entry was rendered and registered above.
      const childNodeId = resolveRenderedNodeId(child.group.id);
      if (!childNodeId) return;

      const edgeSourceGroupId =
        showAllDepth && child.parentId && child.parentId !== graphRootGroupId
          ? child.parentId
          : graphRootGroupId;
      const edgeSourceId = resolveRenderedNodeId(edgeSourceGroupId) ?? graphRootGroupId;
      const rightEdgeDirections =
        relationshipTraversalMode === 'right' && filterRight
          ? buildSingleDirectionRightEdgeDirections([filterRight], 'forward')
          : buildHierarchyRightEdgeDirections(
              stableRelationships,
              edgeSourceGroupId,
              child.group.id
            );

      pushRelationshipEdge({
        edgeId: `edge-${edgeSourceId}-to-child-${child.group.id}`,
        sourceId: edgeSourceId,
        targetId: childNodeId,
        sourceGroupId: edgeSourceGroupId,
        targetGroupId: child.group.id,
        rights: child.rights,
        structuralType:
          relationshipTraversalMode === 'right'
            ? (child.sourceRelationshipType ?? 'parent')
            : 'parent',
        relationshipKinds: child.relationshipKinds,
        rightRelationshipKinds: child.rightRelationshipKinds,
        membershipMode: child.membershipMode,
        memberSourceGroupId: child.memberSourceGroupId,
        memberTargetGroupId: child.memberTargetGroupId,
        requiredSourceRoleId: child.requiredSourceRoleId,
        requiredSourceRoleName: child.requiredSourceRoleName,
        rightEdgeDirections,
        relationshipDepth: (child.level ?? 1) === 1 ? 'direct' : 'indirect',
        strokeColor: getGroupNodeVisualTokens('child').borderColor,
        strokeDasharray: '5 5',
      });
    });

    siblingRelationshipEntries.forEach(entry => {
      const isHorizontalSiblingLink =
        entry.sourceGroupId !== graphRootGroupId &&
        entry.targetGroupId !== graphRootGroupId &&
        siblingAnchorByGroupId.get(entry.sourceGroupId) !== entry.targetGroupId &&
        siblingAnchorByGroupId.get(entry.targetGroupId) !== entry.sourceGroupId;

      pushRelationshipEdge({
        edgeId: `edge-sibling-${entry.sourceId}-to-${entry.targetId}`,
        sourceId: entry.sourceId,
        targetId: entry.targetId,
        sourceGroupId: entry.sourceGroupId,
        targetGroupId: entry.targetGroupId,
        rights: entry.rights,
        structuralType: 'sibling',
        relationshipKinds: entry.relationshipKinds,
        rightRelationshipKinds: entry.rightRelationshipKinds,
        membershipMode: entry.membershipMode,
        memberSourceGroupId: entry.memberSourceGroupId,
        memberTargetGroupId: entry.memberTargetGroupId,
        requiredSourceRoleId: entry.requiredSourceRoleId,
        requiredSourceRoleName: entry.requiredSourceRoleName,
        rightEdgeDirections: entry.rightEdgeDirections,
        relationshipDepth: 'direct',
        strokeColor: getGroupNodeVisualTokens(
          isHorizontalSiblingLink ? 'sibling-open' : 'sibling-parliament'
        ).borderColor,
        strokeDasharray: isHorizontalSiblingLink ? undefined : '6 4',
      });
    });

    const nextNodes = resolveInitialNetworkNodeOverlaps(newNodes, {
      fixedNodeIds: fixedNodeIdsRef.current,
    });
    syncGeneratedLayoutState(nextNodes, newEdges);
    setNodes(nextNodes);
    setEdges(newEdges);
  }, [
    filterRight,
    fixedNodeIdsRef,
    graphRootGroup,
    graphRootGroupId,
    group,
    groupId,
    handleEdgeBendPointsChange,
    relationshipDepthFilter,
    relationshipStatusFilter,
    relationshipTraversalMode,
    setEdges,
    siblingGroups,
    stableRelationships,
    syncGeneratedLayoutState,
    traversalRelationships,
    visibleSiblingRelationships,
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
    const alwaysVisibleNodeIds =
      relationshipStatusFilter === 'active'
        ? Array.from(new Set([groupId, graphRootGroupId]))
        : [graphRootGroupId];

    return filterNodesByEdges(nodes, filteredEdges, alwaysVisibleNodeIds);
  }, [filteredEdges, graphRootGroupId, groupId, nodes, relationshipStatusFilter]);

  const renderedEdges = useMemo(
    () =>
      filteredEdges.map(edge => {
        const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;
        const sourceGroupId =
          typeof edgeData?.sourceGroupId === 'string'
            ? edgeData.sourceGroupId
            : edge.source.replace(/^(parent-|child-)/, '');
        const targetGroupId =
          typeof edgeData?.targetGroupId === 'string'
            ? edgeData.targetGroupId
            : edge.target.replace(/^(parent-|child-)/, '');
        const isHighlighted = highlightedEdgeKeys.has(`${sourceGroupId}->${targetGroupId}`);

        if (!isHighlighted) {
          return edge;
        }

        return {
          ...edge,
          animated: true,
          style: {
            ...edge.style,
            stroke: getGroupNodeVisualTokens('parent').borderColor,
            strokeWidth: 4,
          },
        };
      }),
    [filteredEdges, highlightedEdgeKeys]
  );

  const renderedNodes = useMemo(
    () =>
      filteredNodes.map(node => {
        const rawId = node.id.replace(/^(parent-|child-)/, '');
        const isSelected = selectedNodes.includes(node.id);
        const isHighlighted = highlightedGroupIds.has(rawId);

        return {
          ...node,
          style: {
            ...node.style,
            borderColor: isHighlighted
              ? getGroupNodeVisualTokens('parent').borderColor
              : node.style?.borderColor,
            boxShadow: isSelected
              ? getNetworkSelectionStyle(true).boxShadow
              : isHighlighted
                ? `0 0 0 2px color-mix(in oklab, ${getGroupNodeVisualTokens('parent').borderColor} 36%, transparent), var(--shadow-panel)`
                : node.style?.boxShadow,
          },
        };
      }),
    [filteredNodes, highlightedGroupIds, selectedNodes]
  );

  // Generate flow chart when group or showIndirect changes
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

      const nodeData = node.data as GroupNode['data'];
      const nodeGroupData = nodeData.groupEntity;

      const rawId = node.id.replace(/^(parent-|child-)/, '');
      const groupData = nodeGroupData
        ? nodeGroupData
        : node.id === graphRootGroupId || rawId === graphRootGroupId
          ? graphRootGroup
          : node.id === groupId || rawId === groupId
            ? group
            : null;

      if (groupData && onGroupClick) {
        onGroupClick(groupData.id, {
          ...groupData,
          id: groupData.id,
          name: groupData.name ?? null,
        });
      }

      if (groupData && showGroupDialogOnClick) {
        const dialogGroupData = {
          id: groupData.id,
          name: groupData.name ?? null,
          description: getDescriptionText(groupData.description) ?? null,
          member_count: groupData.member_count ?? null,
          event_count: groupData.event_count ?? null,
          amendment_count: groupData.amendment_count ?? null,
        };

        setSelectedEntity({
          type: 'group',
          data: dialogGroupData,
        });
        setDialogOpen(true);
      }
    },
    [
      graphRootGroup,
      graphRootGroupId,
      group,
      groupId,
      isInteractive,
      onGroupClick,
      showGroupDialogOnClick,
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
    filterRight,
    group,
    groupWorkflows,
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
    renderedEdges,
    renderedNodes,
    selectedEntity,
    selectedRights,
    selectedWorkflowId,
    selectedWorkflowVisualization,
    setDialogOpen,
    setLegendCollapsed,
    setPanelCollapsed,
    setSelectedWorkflowId,
    setViewMode,
    showWorkflowView,
    sortedGroupWorkflows,
    t,
    title,
    toggleRight,
    viewMode,
  };
}

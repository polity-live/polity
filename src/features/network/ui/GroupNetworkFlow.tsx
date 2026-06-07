'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  type NodeChange,
} from '@xyflow/react';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import {
  createGroupNodeLegendItem,
  getGroupNodeDisplayLabel,
  getGroupNodeStyle,
  getGroupNodeVisualVariant,
} from '@/features/network/ui/networkVisualHelpers';
import {
  NetworkControlPanel,
  NETWORK_FILTER_ACTIVE_CLASS_NAMES,
} from '@/features/network/ui/NetworkControlPanel';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import { WorkflowFlowVisualization } from '@/features/network/ui/WorkflowFlowVisualization';
import { useNetworkFlowControls } from '@/features/network/hooks/useNetworkFlowControls';
import { useGroupNetworkLayout } from '@/features/network/hooks/useGroupNetworkLayout';
import { useGroupNetwork } from '@/features/network/hooks/useGroupNetwork';
import {
  addUniqueValue,
  buildCurrentPerspectiveRightDisplayDirections,
  buildHierarchyRightEdgeDirections,
  buildNetworkRelationshipDialogData,
  buildRelationshipEdgeMarkers,
  createNetworkRelationshipEdgeData,
  getAnimatedFlowDirection,
  getVisibleFlowDirection,
  getRelationshipStrokeColor,
  mergeNetworkEdgeRelationshipDirection,
  mergeNetworkRightRelationshipKind,
} from '@/features/network/logic/networkEdgeHelpers';
import {
  areGroupNetworkLayoutsEqual,
  normalizeGroupNetworkLayout,
} from '@/features/network/logic/networkLayoutHelpers';
import {
  buildDirectRelationships,
  buildIndirectRelationships,
  buildMixedRelationshipGraph,
  getAcceptedSiblingGroups,
  getGroupRelationshipKind,
  getRelativeMembershipDirectionForRelationship,
  isActiveGroupRelationshipStatus,
  isAcceptedSiblingRelationship,
  type RelationshipEntry,
  type NetworkRelationshipKind,
  type SiblingAttachmentEntry,
} from '@/features/network/logic/networkRelationshipHelpers';
import {
  filterEdgesByRelationshipStatus,
  filterEdgesByConnectionDirections,
  filterEdgesByRights,
  filterNodesByEdges,
} from '@/features/network/logic/networkFilterHelpers';
import { useWorkflowState } from '@/zero/network/useWorkflowState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import type {
  NetworkConnectionDirection,
  EditableRightsLabelEdgeData,
  NetworkEdgeBendPoint,
  NetworkEdgeRelationshipDirection,
  NetworkUserConnectionDirection,
} from '@/features/network/types/networkEdge.types';
import type {
  CanonicalMembershipMode,
  CanonicalNetworkMembershipDirection,
  GroupRelationshipType,
  NetworkGroupEntity,
} from '@/features/network/types/network.types';
import type { GroupNetworkLayout } from '@/zero/preferences';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';

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

interface GroupNetworkFlowProps {
  groupId: string;
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
  if (total <= 0) {
    return { x: 0, y: 0 };
  }

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
        membershipMode: entry.membershipMode ?? null,
        membershipCanonicalDirection: entry.membershipCanonicalDirection ?? null,
        membershipDirection: entry.membershipDirection ?? null,
        level: entry.level,
        childId: entry.childId,
        parentId: entry.parentId,
      });
      return;
    }

    entry.rights.forEach(right => addUniqueValue(existing.rights, right));
    entry.relationshipKinds.forEach(kind => addUniqueValue(existing.relationshipKinds, kind));

    Object.entries(entry.rightRelationshipKinds).forEach(([right, kind]) => {
      existing.rightRelationshipKinds[right] = mergeNetworkRightRelationshipKind(
        existing.rightRelationshipKinds[right],
        kind
      ) as NetworkRelationshipKind;
    });

    if (shouldReplaceMembershipMode(existing.membershipMode, entry.membershipMode)) {
      existing.membershipMode = entry.membershipMode;
      existing.membershipCanonicalDirection = entry.membershipCanonicalDirection ?? null;
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

function getUserConnectionDirections(
  rightConnectionDirections?: Record<string, NetworkConnectionDirection>
): NetworkUserConnectionDirection[] {
  const values = Object.values(rightConnectionDirections ?? {});
  const directions: NetworkUserConnectionDirection[] = [];

  if (values.some(value => value === 'incoming' || value === 'bidirectional')) {
    directions.push('incoming');
  }

  if (values.some(value => value === 'outgoing' || value === 'bidirectional')) {
    directions.push('outgoing');
  }

  return directions;
}

function getPreviewRelationshipType(args: {
  structuralType: GroupRelationshipType;
  currentGroupId: string;
  sourceGroupId: string;
}) {
  if (args.structuralType === 'sibling') {
    return 'sibling';
  }

  return args.currentGroupId === args.sourceGroupId ? 'parent' : 'child';
}

function resolvePreviewContext(args: {
  graphRootGroupId: string;
  structuralType: GroupRelationshipType;
  sourceGroupId: string;
  targetGroupId: string;
  sourceGroupName: string | null;
  targetGroupName: string | null;
  rightEdgeDirections?: Record<string, NetworkEdgeRelationshipDirection>;
  membershipCanonicalDirection?: CanonicalNetworkMembershipDirection | null;
}) {
  const touchesGraphRoot =
    args.graphRootGroupId === args.sourceGroupId || args.graphRootGroupId === args.targetGroupId;
  const visibleFlowDirection = getVisibleFlowDirection(args.rightEdgeDirections);

  let currentGroupId = args.sourceGroupId;

  if (touchesGraphRoot) {
    currentGroupId = args.graphRootGroupId;
  } else if (visibleFlowDirection === 'forward') {
    currentGroupId = args.sourceGroupId;
  } else if (visibleFlowDirection === 'backward') {
    currentGroupId = args.targetGroupId;
  } else if (args.membershipCanonicalDirection === 'forward') {
    currentGroupId = args.sourceGroupId;
  } else if (args.membershipCanonicalDirection === 'backward') {
    currentGroupId = args.targetGroupId;
  }

  const selectedGroupId =
    currentGroupId === args.sourceGroupId ? args.targetGroupId : args.sourceGroupId;

  return {
    relationshipType: getPreviewRelationshipType({
      structuralType: args.structuralType,
      currentGroupId,
      sourceGroupId: args.sourceGroupId,
    }),
    currentGroupId,
    currentGroupName:
      currentGroupId === args.sourceGroupId ? args.sourceGroupName : args.targetGroupName,
    selectedGroupId,
    selectedGroupName:
      selectedGroupId === args.sourceGroupId ? args.sourceGroupName : args.targetGroupName,
  } satisfies {
    relationshipType: GroupRelationshipType;
    currentGroupId: string;
    currentGroupName: string | null;
    selectedGroupId: string;
    selectedGroupName: string | null;
  };
}

function getPreviewMembershipDirection(args: {
  currentGroupId: string;
  sourceGroupId: string;
  targetGroupId: string;
  membershipCanonicalDirection?: CanonicalNetworkMembershipDirection | null;
}) {
  if (!args.membershipCanonicalDirection) {
    return null;
  }

  return getRelativeMembershipDirectionForRelationship({
    relationship: {
      group_id: args.sourceGroupId,
      related_group_id: args.targetGroupId,
      membership_direction: args.membershipCanonicalDirection,
      relationship_direction: 'forward',
    },
    currentGroupId: args.currentGroupId,
  });
}

export function GroupNetworkFlow({ groupId }: GroupNetworkFlowProps) {
  const { t } = useTranslation();
  const {
    savedLayout,
    hasSavedLayout,
    isLoading: isLayoutLoading,
    persistLayout,
    resetLayout,
  } = useGroupNetworkLayout(groupId);
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
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const edgeBendPointsRef = useRef<Record<string, NetworkEdgeBendPoint[]>>({});
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const isInteractiveRef = useRef(isInteractive);

  // View mode: 'hierarchy' | 'workflow'
  const [viewMode, setViewMode] = useState<'hierarchy' | 'workflow'>('hierarchy');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');

  // Fetch workflows for this group
  const { groupWorkflows } = useWorkflowState({ groupId });
  const selectedWorkflow = useMemo(
    () => groupWorkflows.find(w => w.id === selectedWorkflowId),
    [groupWorkflows, selectedWorkflowId]
  );

  const { group, allRelationships } = useGroupNetwork(groupId);
  const graphRootGroup = group;
  const graphRootGroupId = graphRootGroup?.id ?? groupId;

  const stableRelationships = useMemo(() => {
    return allRelationships.filter(rel => getGroupRelationshipKind(rel, graphRootGroupId) !== null);
  }, [allRelationships, graphRootGroupId]);

  const visibleSiblingRelationships = useMemo(() => {
    const siblingRelationships = stableRelationships.filter(
      rel => rel.relationship_type === 'sibling'
    );

    if (relationshipStatusFilter === 'active') {
      return siblingRelationships.filter(isAcceptedSiblingRelationship);
    }

    return siblingRelationships.filter(
      rel => getGroupRelationshipKind(rel, graphRootGroupId) === relationshipStatusFilter
    );
  }, [graphRootGroupId, relationshipStatusFilter, stableRelationships]);

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
    const hierarchyRelationships = stableRelationships.filter(
      rel => rel.relationship_type !== 'sibling'
    );

    if (relationshipStatusFilter === 'active') {
      return hierarchyRelationships.filter(rel => isActiveGroupRelationshipStatus(rel.status));
    }

    return hierarchyRelationships.filter(
      rel => getGroupRelationshipKind(rel, graphRootGroupId) === relationshipStatusFilter
    );
  }, [graphRootGroupId, relationshipStatusFilter, stableRelationships]);

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

  const currentLayout = useMemo<GroupNetworkLayout>(
    () =>
      normalizeGroupNetworkLayout({
        node_positions: Object.fromEntries(
          nodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])
        ),
        edge_bend_points: Object.fromEntries(
          edges
            .map(edge => {
              const bendPoints = Array.isArray(
                (edge.data as EditableRightsLabelEdgeData | undefined)?.bendPoints
              )
                ? ((edge.data as EditableRightsLabelEdgeData).bendPoints as NetworkEdgeBendPoint[])
                : [];

              return [
                edge.id,
                bendPoints.map(bendPoint => ({ x: bendPoint.x, y: bendPoint.y })),
              ] as const;
            })
            .filter(([, bendPoints]) => bendPoints.length > 0)
        ),
      }),
    [edges, nodes]
  );

  const hasLayoutChanges = useMemo(() => {
    return !areGroupNetworkLayoutsEqual(currentLayout, savedLayout);
  }, [currentLayout, savedLayout]);

  useEffect(() => {
    isInteractiveRef.current = isInteractive;
  }, [isInteractive]);

  useEffect(() => {
    nodePositionsRef.current = savedLayout?.node_positions ?? {};
    edgeBendPointsRef.current = savedLayout?.edge_bend_points ?? {};
  }, [savedLayout]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<GroupNode>[]) => {
      setNodes(currentNodes => {
        const nextNodes = applyNodeChanges(changes, currentNodes);
        nodePositionsRef.current = Object.fromEntries(
          nextNodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])
        );
        return nextNodes;
      });
    },
    [setNodes]
  );

  const handleEdgeBendPointsChange = useCallback(
    (edgeId: string, bendPoints: NetworkEdgeBendPoint[]) => {
      if (bendPoints.length === 0) {
        edgeBendPointsRef.current = Object.fromEntries(
          Object.entries(edgeBendPointsRef.current).filter(
            ([currentEdgeId]) => currentEdgeId !== edgeId
          )
        );
      } else {
        edgeBendPointsRef.current[edgeId] = bendPoints;
      }

      setEdges(currentEdges =>
        currentEdges.map(edge => {
          if (edge.id !== edgeId) {
            return edge;
          }

          return {
            ...edge,
            data: {
              ...(edge.data ?? {}),
              bendPoints,
            },
          };
        })
      );
    },
    [setEdges]
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
            undefined,
            graphRootGroupId
          )
        : null;

    if (mixedRelationshipGraph) {
      mergeRelationshipEntryMaps(mixedRelationshipGraph.parents, parentEntriesMap);
      mergeRelationshipEntryMaps(mixedRelationshipGraph.children, childEntriesMap);
    } else {
      const baseRelationshipTree =
        relationshipDepthFilter === 'direct'
          ? buildDirectRelationships(traversalRelationships, graphRootGroupId)
          : buildIndirectRelationships(traversalRelationships, graphRootGroupId);

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
      membershipCanonicalDirection,
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
      membershipCanonicalDirection?: CanonicalNetworkMembershipDirection | null;
      rightEdgeDirections: Record<string, NetworkEdgeRelationshipDirection> | undefined;
      relationshipDepth: 'direct' | 'indirect';
      strokeColor: string;
      strokeDasharray?: string;
    }) => {
      const resolvedStrokeColor = getRelationshipStrokeColor(strokeColor, rightEdgeDirections);
      const edgeMarkers = buildRelationshipEdgeMarkers(resolvedStrokeColor, rightEdgeDirections);
      const visibleFlowDirection = getVisibleFlowDirection(rightEdgeDirections);
      const animatedFlowDirection = getAnimatedFlowDirection(visibleFlowDirection);
      const pageRightConnectionDirections =
        buildCurrentPerspectiveRightDisplayDirections({
          currentNodeId: graphRootGroupId,
          sourceId: sourceGroupId,
          targetId: targetGroupId,
          rightEdgeDirections,
        }) ?? {};
      const userConnectionDirections = getUserConnectionDirections(pageRightConnectionDirections);
      const previewContext = resolvePreviewContext({
        graphRootGroupId,
        structuralType,
        sourceGroupId,
        targetGroupId,
        sourceGroupName: groupNameMap.get(sourceGroupId) ?? null,
        targetGroupName: groupNameMap.get(targetGroupId) ?? null,
        rightEdgeDirections,
        membershipCanonicalDirection,
      });
      const rightDisplayDirections = buildCurrentPerspectiveRightDisplayDirections({
        currentNodeId: previewContext.currentGroupId,
        sourceId: sourceGroupId,
        targetId: targetGroupId,
        rightEdgeDirections,
      });

      newEdges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: 'rightsLabel',
        animated: animatedFlowDirection !== null,
        style: {
          stroke: resolvedStrokeColor,
          strokeWidth: 2,
          strokeDasharray,
          animationDirection: animatedFlowDirection === 'backward' ? 'reverse' : undefined,
        },
        ...edgeMarkers,
        data: {
          ...createNetworkRelationshipEdgeData({
            rights,
            relationshipKinds,
            rightRelationshipKinds,
            relationshipType: previewContext.relationshipType,
            membershipMode,
            membershipDirection: getPreviewMembershipDirection({
              currentGroupId: previewContext.currentGroupId,
              sourceGroupId,
              targetGroupId,
              membershipCanonicalDirection,
            }),
            rightEdgeDirections,
            visibleFlowDirection,
            rightConnectionDirections: pageRightConnectionDirections,
            userConnectionDirections,
            relationshipDepth,
            sourceName: groupNameMap.get(sourceGroupId) ?? null,
            targetName: groupNameMap.get(targetGroupId) ?? null,
            currentGroupId: previewContext.currentGroupId,
            currentGroupName: previewContext.currentGroupName,
            selectedGroupId: previewContext.selectedGroupId,
            selectedGroupName: previewContext.selectedGroupName,
            rightDisplayDirections,
            anchorStrategy: 'inner-auto',
          }),
          bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
          edgeEditingEnabled: isInteractiveRef.current,
          onBendPointsChange: handleEdgeBendPointsChange,
        },
      } satisfies Edge);
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
        membershipCanonicalDirection?: CanonicalNetworkMembershipDirection | null;
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

        const anchorPosition = renderedNodePositionsById.get(anchorNodeId);
        if (!anchorPosition) {
          return;
        }

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

        const sourceNodeId = resolveRenderedNodeId(sourceGroupId);
        const targetNodeId = resolveRenderedNodeId(targetGroupId);
        if (!sourceNodeId || !targetNodeId) {
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
        const edgeSourceId = resolveRenderedNodeId(edgeSourceGroupId);
        const edgeTargetId = resolveRenderedNodeId(edgeTargetGroupId);

        if (!edgeSourceId || !edgeTargetId) {
          return;
        }

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
            membershipCanonicalDirection: null,
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
          entry.membershipCanonicalDirection = rel.membership_direction ?? null;
        }

        const rightDirection =
          rel.group_id === edgeSourceGroupId && rel.related_group_id === edgeTargetGroupId
            ? 'forward'
            : rel.group_id === edgeTargetGroupId && rel.related_group_id === edgeSourceGroupId
              ? 'backward'
              : null;

        if (right && rightDirection) {
          entry.rightEdgeDirections[right] = mergeNetworkEdgeRelationshipDirection(
            entry.rightEdgeDirections[right],
            rightDirection
          );
        }
      });
    }

    parents.forEach(parent => {
      const parentNodeId = resolveRenderedNodeId(parent.group.id);
      if (!parentNodeId) {
        return;
      }

      const edgeTargetGroupId =
        showAllDepth && parent.childId && parent.childId !== graphRootGroupId
          ? parent.childId
          : graphRootGroupId;
      const edgeTargetId = resolveRenderedNodeId(edgeTargetGroupId) ?? graphRootGroupId;
      const rightEdgeDirections = buildHierarchyRightEdgeDirections(
        stableRelationships,
        parent.group.id,
        edgeTargetGroupId
      );

      pushRelationshipEdge({
        edgeId: `edge-parent-${parent.group.id}-to-${edgeTargetId}`,
        sourceId: parentNodeId,
        targetId: edgeTargetId,
        sourceGroupId: parent.group.id,
        targetGroupId: edgeTargetGroupId,
        rights: parent.rights,
        structuralType: 'parent',
        relationshipKinds: parent.relationshipKinds,
        rightRelationshipKinds: parent.rightRelationshipKinds,
        membershipMode: parent.membershipMode,
        membershipCanonicalDirection: parent.membershipCanonicalDirection,
        rightEdgeDirections,
        relationshipDepth: (parent.level ?? 1) === 1 ? 'direct' : 'indirect',
        strokeColor: '#66bb6a',
        strokeDasharray: '5 5',
      });
    });

    children.forEach(child => {
      const childNodeId = resolveRenderedNodeId(child.group.id);
      if (!childNodeId) {
        return;
      }

      const edgeSourceGroupId =
        showAllDepth && child.parentId && child.parentId !== graphRootGroupId
          ? child.parentId
          : graphRootGroupId;
      const edgeSourceId = resolveRenderedNodeId(edgeSourceGroupId) ?? graphRootGroupId;
      const rightEdgeDirections = buildHierarchyRightEdgeDirections(
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
        structuralType: 'parent',
        relationshipKinds: child.relationshipKinds,
        rightRelationshipKinds: child.rightRelationshipKinds,
        membershipMode: child.membershipMode,
        membershipCanonicalDirection: child.membershipCanonicalDirection,
        rightEdgeDirections,
        relationshipDepth: (child.level ?? 1) === 1 ? 'direct' : 'indirect',
        strokeColor: '#ffb74d',
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
        membershipCanonicalDirection: entry.membershipCanonicalDirection,
        rightEdgeDirections: entry.rightEdgeDirections,
        relationshipDepth: 'direct',
        strokeColor: isHorizontalSiblingLink ? '#f59e0b' : '#a855f7',
        strokeDasharray: isHorizontalSiblingLink ? undefined : '6 4',
      });
    });

    nodePositionsRef.current = Object.fromEntries(
      newNodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])
    );
    edgeBendPointsRef.current = Object.fromEntries(
      newEdges
        .map(edge => {
          const bendPoints = Array.isArray(
            (edge.data as EditableRightsLabelEdgeData | undefined)?.bendPoints
          )
            ? ((edge.data as EditableRightsLabelEdgeData).bendPoints as NetworkEdgeBendPoint[])
            : [];

          return [edge.id, bendPoints] as const;
        })
        .filter(([, bendPoints]) => bendPoints.length > 0)
    );

    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    graphRootGroup,
    graphRootGroupId,
    group,
    groupId,
    handleEdgeBendPointsChange,
    relationshipDepthFilter,
    relationshipStatusFilter,
    setEdges,
    siblingGroups,
    stableRelationships,
    traversalRelationships,
    visibleSiblingRelationships,
  ]);

  useEffect(() => {
    setEdges(currentEdges =>
      currentEdges.map(edge => ({
        ...edge,
        data: {
          ...(edge.data ?? {}),
          edgeEditingEnabled: isInteractive,
          onBendPointsChange: handleEdgeBendPointsChange,
          bendPoints: Array.isArray(
            (edge.data as EditableRightsLabelEdgeData | undefined)?.bendPoints
          )
            ? (edge.data as EditableRightsLabelEdgeData).bendPoints
            : (edgeBendPointsRef.current[edge.id] ?? []),
        },
      }))
    );
  }, [handleEdgeBendPointsChange, isInteractive, setEdges]);

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
    nodePositionsRef.current = {};
    edgeBendPointsRef.current = {};
    resetLayout();
    generateFlowChart();
  }, [generateFlowChart, resetLayout]);

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

      if (groupData) {
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
    [graphRootGroup, graphRootGroupId, group, groupId, isInteractive]
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

  if (!group) {
    return (
      <div className="bg-background flex h-[32rem] min-h-[24rem] w-full items-center justify-center rounded-lg border">
        <p className="text-muted-foreground">{t('common.network.loadingGroupNetwork')}</p>
      </div>
    );
  }

  // View mode toggle + workflow visualization
  if (viewMode === 'workflow') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode('hierarchy')}>
            {t('common.network.hierarchyView', 'Hierarchy')}
          </Button>
          <Button variant="default" size="sm" onClick={() => setViewMode('workflow')}>
            {t('common.network.workflowView', 'Workflows')}
          </Button>
          <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue
                placeholder={t('features.network.workflows.selectWorkflow', 'Select a workflow...')}
              />
            </SelectTrigger>
            <SelectContent>
              {groupWorkflows.map(w => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name ?? 'Untitled'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {groupWorkflows.length === 0 ? (
          <div className="bg-background flex min-h-[24rem] flex-1 items-center justify-center rounded-lg border">
            <p className="text-muted-foreground text-sm">
              {t('features.network.workflows.empty', 'No workflows defined yet.')}
            </p>
          </div>
        ) : selectedWorkflow ? (
          <div className="min-h-[24rem] flex-1">
            <WorkflowFlowVisualization workflow={selectedWorkflow} />
          </div>
        ) : (
          <div className="bg-background flex min-h-[24rem] flex-1 items-center justify-center rounded-lg border">
            <p className="text-muted-foreground text-sm">
              {t('features.network.workflows.selectWorkflow', 'Select a workflow...')}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'hierarchy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('hierarchy')}
        >
          {t('common.network.hierarchyView', 'Hierarchy')}
        </Button>
        {groupWorkflows.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setViewMode('workflow')}>
            {t('common.network.workflowView', 'Workflows')}
          </Button>
        )}
      </div>
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
        onNodesChange={isInteractive ? handleNodesChange : undefined}
        onEdgesChange={isInteractive ? onEdgesChange : undefined}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onInteractiveChange={handleInteractiveChange}
        containerClassName="min-h-[24rem] flex-1"
        panel={
          <NetworkControlPanel
            title={t('common.network.groupNetwork')}
            description={t('common.network.groupNetworkDescription', { groupName: group.name })}
            panelCollapsed={panelCollapsed}
            onPanelCollapsedChange={setPanelCollapsed}
            legendCollapsed={legendCollapsed}
            onLegendCollapsedChange={setLegendCollapsed}
            legendTitle={t('common.network.legend')}
            legendItems={[
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
            controlsExtraContent={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveLayout}
                  disabled={isLayoutLoading || !hasLayoutChanges}
                >
                  {t('common.network.saveLayout')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetLayout}
                  disabled={isLayoutLoading || (!hasSavedLayout && !hasLayoutChanges)}
                >
                  {t('common.network.resetLayout')}
                </Button>
              </>
            }
            showRightsFilter
            selectedRights={selectedRights}
            onToggleRight={toggleRight}
            connectionDirectionFilters={connectionDirectionFilters}
            showRightsLegend
            showConnectionDirectionLegend
            connectionDirectionLegendTitle={t(
              'common.network.connectionDirections',
              'Verbindungsrichtungen'
            )}
            bidirectionalConnectionLabel={t('common.network.bidirectional', 'Beidseitig')}
            incomingConnectionLabel={t('common.network.incomingConnections', 'Eingehend')}
            outgoingConnectionLabel={t('common.network.outgoingConnections', 'Ausgehend')}
            relationshipStatusFilters={relationshipStatusFilters}
            relationshipStatusFiltersLabel={t('common.network.relationshipStatuses')}
            legendExtraContent={
              <>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <div className="space-y-2">
                  <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {t('common.network.requestBadgeLegend')}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-3 w-6 rounded-sm border border-gray-300 bg-gray-100"></div>
                    <span>{t('common.network.activeNoBadge')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-3 w-6 rounded-sm border border-gray-300 bg-gray-100">
                      <span className="border-background absolute -top-1.5 -right-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-blue-500 text-white shadow-sm">
                        <ArrowDownLeft className="h-2 w-2" />
                      </span>
                    </div>
                    <span>{t('common.network.incomingRequest')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-3 w-6 rounded-sm border border-gray-300 bg-gray-100">
                      <span className="border-background absolute -top-1.5 -right-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-amber-500 text-white shadow-sm">
                        <ArrowUpRight className="h-2 w-2" />
                      </span>
                    </div>
                    <span>{t('common.network.outgoingRequest')}</span>
                  </div>
                </div>
              </>
            }
          />
        }
      >
        <NetworkEntityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          entity={selectedEntity}
        />
      </NetworkFlowBase>
    </div>
  );
}

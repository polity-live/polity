'use client';

import React, { useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react';
import { useEventWithGroup } from '@/zero/events/useEventState';
import { useGroupConnectionState } from '@/zero/network';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import { type NetworkGroupEntity } from '../types/network.types';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import {
  NetworkControlPanel,
  NETWORK_FILTER_ACTIVE_CLASS_NAMES,
} from '@/features/network/ui/NetworkControlPanel';
import { useNetworkFlowControls } from '@/features/network/hooks/useNetworkFlowControls';
import { usePersistedNetworkLayout } from '@/features/network/hooks/usePersistedNetworkLayout';
import { useEditableNetworkLayout } from '@/features/network/hooks/useEditableNetworkLayout';
import {
  buildHierarchyRightEdgeDirections,
  buildNetworkRelationshipDialogData,
  buildNetworkRelationshipEdge,
} from '@/features/network/logic/networkEdgeHelpers';
import {
  buildDirectRelationships,
  buildIndirectRelationships,
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
} from '@/features/network/ui/networkVisualHelpers';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { usePermissions } from '@/zero/rbac';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import type { EditableRightsLabelEdgeData } from '../types/networkEdge.types';
import { deriveNormalizedGroupRelationships } from '../logic/groupConnectionDerived';

interface EventNode extends Node {
  data: {
    label: string;
    description?: string;
    level: number;
    type: 'event' | 'group';
    groupData?: NetworkGroupEntity;
  };
}

interface EventNetworkFlowProps {
  eventId: string;
}

function toDisplayText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function EventNetworkFlow({ eventId }: EventNetworkFlowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    savedLayout,
    hasSavedLayout,
    isLoading: isLayoutLoading,
    persistLayout,
    resetLayout,
  } = usePersistedNetworkLayout({
    scopeKey: `event:${eventId}`,
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
  const [nodes, setNodes] = useNodesState<EventNode>([]);
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

  // Fetch the specific event with its group
  const { event } = useEventWithGroup(eventId);
  const { can } = usePermissions({ eventId });
  const group = event?.group;
  const canManageEvent = can('manage', 'events');

  const { allConnections } = useGroupConnectionState();
  const relationships = useMemo(
    () => deriveNormalizedGroupRelationships(allConnections),
    [allConnections]
  );

  // Memoize relationships to prevent infinite loops
  const stableRelationships = useMemo(() => {
    return relationships;
  }, [
    relationships.length,
    relationships.map(r => `${r.id}-${r.group?.id}-${r.related_group?.id}`).join(','),
  ]);

  if (event && !group) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {translateText(
              'generated.inline.0765_this_event_is_not_associated_with_a_group_f78c85d7'
            )}
          </CardTitle>
          <CardDescription>
            {translateText(
              'generated.inline.0766_network_visualization_is_only_available_for_e_b07d6969'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {canManageEvent ? (
            <Button onClick={() => navigate({ to: `/event/${eventId}/settings` })}>
              {translateText('generated.inline.0767_zur_event_einstellungen_d28673fc')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate({ to: `/event/${eventId}` })}>
              {translateText('generated.inline.0768_zur_ck_zur_veranstaltung_163f275f')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Generate flow chart
  const generateFlowChart = useCallback(() => {
    if (!event || !group) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const relationshipTree =
      relationshipDepthFilter === 'direct'
        ? buildDirectRelationships(stableRelationships, group.id)
        : buildIndirectRelationships(stableRelationships, group.id);
    const showAllDepth = relationshipDepthFilter === 'all';
    const showIndirectOnly = relationshipDepthFilter === 'indirect';
    const parents = showIndirectOnly
      ? relationshipTree.parents.filter(parent => (parent.level ?? 1) > 1)
      : relationshipTree.parents;
    const children = showIndirectOnly
      ? relationshipTree.children.filter(child => (child.level ?? 1) > 1)
      : relationshipTree.children;

    const newNodes: EventNode[] = [];
    const newEdges: Edge[] = [];

    // Build a name lookup for resolving edge source/target names
    const groupNameMap = new Map<string, string>();
    groupNameMap.set(group.id, group.name ?? '');
    groupNameMap.set(eventId, event.title ?? '');
    parents.forEach(p => groupNameMap.set(p.group.id, p.group.name ?? ''));
    children.forEach(c => groupNameMap.set(c.group.id, c.group.name ?? ''));

    // Add center node (event)
    newNodes.push({
      id: eventId,
      type: 'default',
      position: nodePositionsRef.current[eventId] ?? { x: 400, y: 300 },
      data: {
        label: event.title ?? '',
        description: toDisplayText(event.description) ?? '',
        level: 0,
        type: 'event',
      },
      style: {
        background: '#e8f5e9',
        color: '#333',
        border: '3px solid #66bb6a',
        borderRadius: '8px',
        padding: '15px',
        fontSize: '14px',
        fontWeight: 'bold',
        width: 200,
        textAlign: 'center',
      },
    });

    // Add the event's group node
    newNodes.push({
      id: group.id,
      type: 'default',
      position: nodePositionsRef.current[group.id] ?? { x: 400, y: 450 },
      data: {
        label: getGroupNodeDisplayLabel(group.name, 'current'),
        description: toDisplayText(group.description) ?? '',
        level: 1,
        type: 'group',
        groupData: group,
      },
      style: getGroupNodeStyle('current', {
        width: 180,
        fontSize: '13px',
        fontWeight: '700',
      }),
    });

    // Add edge from event to its group
    newEdges.push({
      id: `${eventId}-${group.id}`,
      source: eventId,
      target: group.id,
      type: 'smoothstep',
      animated: false,
      label: translateText('generated.inline.0195_hosted_by_56531d01'),
      style: { stroke: '#66bb6a', strokeWidth: 2 },
      labelStyle: { fontSize: '10px', fontWeight: 'bold' },
      labelBgStyle: { fill: '#e8f5e9' },
    });

    // Add parent nodes
    parents.forEach(parent => {
      const edgeTarget = showAllDepth && parent.childId ? parent.childId : group.id;
      const rightEdgeDirections = buildHierarchyRightEdgeDirections(
        stableRelationships,
        parent.group.id,
        edgeTarget
      );

      const level = parent.level || 1;
      const yOffset = -150 * level;
      const totalAtLevel = parents.filter(p => (p.level || 1) === level).length;
      const indexAtLevel = parents
        .filter(p => (p.level || 1) === level)
        .findIndex(p => p.group.id === parent.group.id);
      const xOffset = (indexAtLevel - (totalAtLevel - 1) / 2) * 250;

      newNodes.push({
        id: parent.group.id,
        type: 'default',
        position: nodePositionsRef.current[parent.group.id] ?? {
          x: 400 + xOffset,
          y: 450 + yOffset,
        },
        data: {
          label: getGroupNodeDisplayLabel(parent.group.name, 'parent'),
          description: toDisplayText(parent.group.description),
          level: level + 1,
          type: 'group',
          groupData: parent.group,
        },
        style: getGroupNodeStyle('parent', {
          width: 160,
          fontSize: '12px',
        }),
      });

      const edgeId = `${parent.group.id}-${edgeTarget}`;
      newEdges.push(
        buildNetworkRelationshipEdge({
          edgeId,
          sourceId: parent.group.id,
          targetId: edgeTarget,
          sourceGroupId: parent.group.id,
          targetGroupId: edgeTarget,
          structuralType: 'parent',
          rights: parent.rights,
          relationshipKinds: parent.relationshipKinds,
          rightRelationshipKinds: parent.rightRelationshipKinds,
          membershipMode: parent.membershipMode ?? null,
          memberSourceGroupId: parent.memberSourceGroupId ?? null,
          memberTargetGroupId: parent.memberTargetGroupId ?? null,
          rightEdgeDirections,
          relationshipDepth: (parent.level ?? 1) === 1 ? 'direct' : 'indirect',
          fallbackStrokeColor: '#fbc02d',
          sourceName: groupNameMap.get(parent.group.id) ?? null,
          targetName: groupNameMap.get(edgeTarget) ?? null,
          currentGroupId: edgeTarget,
          previewCurrentGroupId: edgeTarget,
          bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
          edgeEditingEnabled: isInteractiveRef.current,
          onBendPointsChange: handleEdgeBendPointsChange,
        })
      );
    });

    // Add child nodes
    children.forEach(child => {
      const edgeSource = showAllDepth && child.parentId ? child.parentId : group.id;
      const rightEdgeDirections = buildHierarchyRightEdgeDirections(
        stableRelationships,
        edgeSource,
        child.group.id
      );

      const level = child.level || 1;
      const yOffset = 150 * level;
      const totalAtLevel = children.filter(c => (c.level || 1) === level).length;
      const indexAtLevel = children
        .filter(c => (c.level || 1) === level)
        .findIndex(c => c.group.id === child.group.id);
      const xOffset = (indexAtLevel - (totalAtLevel - 1) / 2) * 250;

      newNodes.push({
        id: child.group.id,
        type: 'default',
        position: nodePositionsRef.current[child.group.id] ?? {
          x: 400 + xOffset,
          y: 450 + yOffset,
        },
        data: {
          label: getGroupNodeDisplayLabel(child.group.name, 'child'),
          description: toDisplayText(child.group.description),
          level: level + 1,
          type: 'group',
          groupData: child.group,
        },
        style: getGroupNodeStyle('child', {
          width: 160,
          fontSize: '12px',
        }),
      });

      const edgeId = `${edgeSource}-${child.group.id}`;
      newEdges.push(
        buildNetworkRelationshipEdge({
          edgeId,
          sourceId: edgeSource,
          targetId: child.group.id,
          sourceGroupId: edgeSource,
          targetGroupId: child.group.id,
          structuralType: 'parent',
          rights: child.rights,
          relationshipKinds: child.relationshipKinds,
          rightRelationshipKinds: child.rightRelationshipKinds,
          membershipMode: child.membershipMode ?? null,
          memberSourceGroupId: child.memberSourceGroupId ?? null,
          memberTargetGroupId: child.memberTargetGroupId ?? null,
          rightEdgeDirections,
          relationshipDepth: (child.level ?? 1) === 1 ? 'direct' : 'indirect',
          fallbackStrokeColor: '#4caf50',
          sourceName: groupNameMap.get(edgeSource) ?? null,
          targetName: groupNameMap.get(child.group.id) ?? null,
          currentGroupId: edgeSource,
          previewCurrentGroupId: edgeSource,
          bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
          edgeEditingEnabled: isInteractiveRef.current,
          onBendPointsChange: handleEdgeBendPointsChange,
        })
      );
    });

    syncGeneratedLayoutState(newNodes, newEdges);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    edgeBendPointsRef,
    event,
    eventId,
    group,
    handleEdgeBendPointsChange,
    isInteractiveRef,
    nodePositionsRef,
    relationshipDepthFilter,
    stableRelationships,
    syncGeneratedLayoutState,
  ]);

  // Filter edges based on selected rights (always show event-to-group edge)
  const eventToGroupEdgeIds = useMemo(() => {
    return new Set(edges.filter(e => e.source === eventId).map(e => e.id));
  }, [edges, eventId]);

  const rightsFilteredEdges = useMemo(() => {
    return filterEdgesByRights(edges, selectedRights, eventToGroupEdgeIds);
  }, [edges, selectedRights, eventToGroupEdgeIds]);

  const statusFilteredEdges = useMemo(() => {
    return filterEdgesByRelationshipStatus(
      rightsFilteredEdges,
      relationshipStatusFilter,
      eventToGroupEdgeIds
    );
  }, [eventToGroupEdgeIds, relationshipStatusFilter, rightsFilteredEdges]);

  const filteredEdges = useMemo(() => {
    return filterEdgesByConnectionDirections(
      statusFilteredEdges,
      selectedConnectionDirections,
      eventToGroupEdgeIds
    );
  }, [eventToGroupEdgeIds, selectedConnectionDirections, statusFilteredEdges]);

  // Filter nodes to only show those connected via visible edges
  const alwaysIncludeIds = useMemo(() => {
    const ids = [eventId];
    if (group) ids.push(group.id);
    return ids;
  }, [eventId, group]);

  const filteredNodes = useMemo(() => {
    return filterNodesByEdges(nodes, filteredEdges, alwaysIncludeIds);
  }, [nodes, filteredEdges, alwaysIncludeIds]);

  // Generate flow chart when event or showIndirect changes
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

      const nodeData = node.data as EventNode['data'];

      if (nodeData.type === 'event') {
        setSelectedEntity({
          type: 'event',
          data: {
            id: eventId,
            title: event?.title ?? '',
            description: toDisplayText(event?.description) ?? '',
          },
        });
        setDialogOpen(true);
      } else if (nodeData.type === 'group' && nodeData.groupData) {
        setSelectedEntity({
          type: 'group',
          data: {
            ...nodeData.groupData,
            description: toDisplayText(nodeData.groupData.description) ?? null,
          },
        });
        setDialogOpen(true);
      }
    },
    [isInteractive, event]
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

  if (!event) {
    return (
      <div className="bg-background flex h-full min-h-0 items-center justify-center rounded-lg border">
        <p className="text-muted-foreground">
          {translateText('generated.inline.0474_event_not_found_231b810d')}
        </p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="bg-background flex h-full min-h-0 items-center justify-center rounded-lg border px-4">
        <div className="text-center">
          <p className="text-muted-foreground">
            {translateText(
              'generated.inline.0765_this_event_is_not_associated_with_a_group_f78c85d7'
            )}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {translateText(
              'generated.inline.0766_network_visualization_is_only_available_for_e_b07d6969'
            )}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {canManageEvent ? (
              <Button onClick={() => navigate({ to: `/event/${eventId}/settings` })}>
                {translateText('generated.inline.0767_zur_event_einstellungen_d28673fc')}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate({ to: `/event/${eventId}` })}>
                {translateText('generated.inline.0768_zur_ck_zur_veranstaltung_163f275f')}
              </Button>
            )}
          </div>
        </div>
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
      onNodesChange={isInteractive ? handleNodesChange : undefined}
      onEdgesChange={isInteractive ? onEdgesChange : undefined}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onInteractiveChange={handleInteractiveChange}
      containerClassName="h-full min-h-0"
      panel={
        <NetworkControlPanel
          title={t('common.network.eventNetwork')}
          description={t('common.network.eventNetworkDescription', {
            eventName: event.title ?? '',
            groupName: group.name ?? '',
          })}
          panelCollapsed={panelCollapsed}
          onPanelCollapsedChange={setPanelCollapsed}
          legendCollapsed={legendCollapsed}
          onLegendCollapsedChange={setLegendCollapsed}
          legendTitle={t('common.network.legend')}
          legendItems={[
            {
              id: 'event-center',
              label: t('common.network.eventCenter'),
              swatchClassName: 'h-4 w-4 rounded border-2 border-[#66bb6a] bg-[#e8f5e9]',
            },
            createGroupNodeLegendItem({
              id: 'current-group',
              label: t('common.network.currentGroup'),
              visualVariant: 'current',
            }),
            createGroupNodeLegendItem({
              id: 'parent-group',
              label: t('common.network.parentGroup'),
              visualVariant: 'parent',
            }),
            createGroupNodeLegendItem({
              id: 'child-group',
              label: t('common.network.childGroup'),
              visualVariant: 'child',
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
          relationshipStatusFilters={relationshipStatusFilters}
          showConnectionDirectionLegend
          connectionDirectionLegendTitle={t('common.network.connectionDirections')}
          bidirectionalConnectionLabel={t('common.network.bidirectional')}
          incomingConnectionLabel={t('common.network.incomingConnections')}
          outgoingConnectionLabel={t('common.network.outgoingConnections')}
          showRightsLegend
        />
      }
    >
      <NetworkEntityDialog open={dialogOpen} onOpenChange={setDialogOpen} entity={selectedEntity} />
    </NetworkFlowBase>
  );
}

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  applyNodeChanges,
  type NodeChange,
} from '@xyflow/react';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import { getGroupDisplayLabel } from '@/features/network/ui/networkVisualHelpers';
import { NetworkControlPanel } from '@/features/network/ui/NetworkControlPanel';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import { WorkflowFlowVisualization } from '@/features/network/ui/WorkflowFlowVisualization';
import { useNetworkFlowControls } from '@/features/network/hooks/useNetworkFlowControls';
import { useGroupNetworkLayout } from '@/features/network/hooks/useGroupNetworkLayout';
import { useGroupNetwork } from '@/features/network/hooks/useGroupNetwork';
import {
  buildDirectRelationships,
  buildIndirectRelationships,
  getGroupRelationshipKind,
  type NetworkRelationshipKind,
} from '@/features/network/logic/networkRelationshipHelpers';
import {
  filterEdgesByRights,
  filterNodesByEdges,
} from '@/features/network/logic/networkFilterHelpers';
import { useWorkflowState } from '@/zero/network/useWorkflowState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import type {
  EditableRightsLabelEdgeData,
  NetworkEdgeBendPoint,
} from '@/features/network/types/networkEdge.types';
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
    role?: 'parent' | 'child' | 'center';
    groupType?: 'base' | 'hierarchical';
  };
}

interface GroupNetworkFlowProps {
  groupId: string;
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
    showIndirect,
    setShowIndirect,
    selectedNodes,
    isInteractive,
    setIsInteractive,
    selectedRights,
    selectedRelationshipKinds,
    panelCollapsed,
    setPanelCollapsed,
    legendCollapsed,
    setLegendCollapsed,
    dialogOpen,
    setDialogOpen,
    selectedEntity,
    setSelectedEntity,
    toggleRight,
    toggleRelationshipKind,
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

  const stableRelationships = useMemo(() => {
    return allRelationships.filter(rel => {
      const relationshipKind = getGroupRelationshipKind(rel, groupId);
      return relationshipKind !== null && selectedRelationshipKinds.has(relationshipKind);
    });
  }, [allRelationships, groupId, selectedRelationshipKinds]);

  const relationshipStatusFilters = useMemo(
    () => [
      {
        id: 'active',
        label: t('common.network.active'),
        active: selectedRelationshipKinds.has('active'),
        onToggle: () => toggleRelationshipKind('active'),
        activeClassName:
          'border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 hover:text-emerald-900',
      },
      {
        id: 'incoming',
        label: t('common.network.incomingRequest'),
        active: selectedRelationshipKinds.has('incoming'),
        onToggle: () => toggleRelationshipKind('incoming'),
        activeClassName:
          'border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900',
      },
      {
        id: 'outgoing',
        label: t('common.network.outgoingRequest'),
        active: selectedRelationshipKinds.has('outgoing'),
        onToggle: () => toggleRelationshipKind('outgoing'),
        activeClassName:
          'border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 hover:text-amber-900',
      },
    ],
    [selectedRelationshipKinds, t, toggleRelationshipKind]
  );

  const currentLayout = useMemo<GroupNetworkLayout>(
    () => ({
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
    const defaultLayout = { node_positions: {}, edge_bend_points: {} };
    return JSON.stringify(currentLayout) !== JSON.stringify(savedLayout ?? defaultLayout);
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
    if (!group) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { parents, children } = showIndirect
      ? buildIndirectRelationships(stableRelationships, groupId)
      : buildDirectRelationships(stableRelationships, groupId);

    const newNodes: GroupNode[] = [];
    const newEdges: Edge[] = [];

    // Build a name lookup for resolving edge source/target names
    const groupNameMap = new Map<string, string>();
    groupNameMap.set(groupId, group.name ?? '');
    parents.forEach(p => groupNameMap.set(`parent-${p.group.id}`, p.group.name ?? ''));
    parents.forEach(p => groupNameMap.set(p.group.id, p.group.name ?? ''));
    children.forEach(c => groupNameMap.set(`child-${c.group.id}`, c.group.name ?? ''));
    children.forEach(c => groupNameMap.set(c.group.id, c.group.name ?? ''));

    // Add center node (selected group)
    newNodes.push({
      id: groupId,
      type: 'default',
      position: nodePositionsRef.current[groupId] ?? { x: 400, y: 300 },
      data: {
        label: getGroupDisplayLabel(group.name, (group as { group_type?: string }).group_type),
        description: group.description ?? '',
        level: 0,
        role: 'center',
        groupType:
          (group as { group_type?: string }).group_type === 'hierarchical'
            ? 'hierarchical'
            : 'base',
      },
      style: {
        background: '#bbdefb',
        color: '#333',
        border:
          (group as { group_type?: string }).group_type === 'hierarchical'
            ? '3px dashed #64b5f6'
            : '2px solid #90caf9',
        borderRadius: '5px',
        padding: '10px',
        fontSize: '14px',
        fontWeight: 'bold',
        width: 180,
        textAlign: 'center',
      },
    });

    // Add parent nodes
    parents.forEach((parent, index: number) => {
      const level = parent.level || 1;
      const yOffset = -150 * level;
      const xOffset = (index - parents.length / 2) * 200;

      // Use a unique ID for the parent node instance in the graph
      const parentNodeId = `parent-${parent.group.id}`;

      const isHierarchical = parent.group.group_type === 'hierarchical';

      newNodes.push({
        id: parentNodeId,
        type: 'default',
        position: nodePositionsRef.current[parentNodeId] ?? { x: 400 + xOffset, y: 300 + yOffset },
        data: {
          label: getGroupDisplayLabel(parent.group.name, parent.group.group_type),
          description: parent.group.description ?? undefined,
          level,
          role: 'parent',
          groupType: isHierarchical ? 'hierarchical' : 'base',
        },
        style: {
          background: '#c8e6c9',
          color: '#333',
          border: isHierarchical ? '3px dashed #81c784' : '2px solid #a5d6a7',
          borderRadius: '5px',
          padding: '10px',
          fontSize: '12px',
          fontWeight: '500',
          width: 180,
          textAlign: 'center',
        },
      });

      let edgeTarget = groupId;
      if (showIndirect && parent.childId && parent.childId !== groupId) {
        // If it's an indirect connection, the target is another parent node
        edgeTarget = `parent-${parent.childId}`;
      }

      const edgeId = `edge-parent-${parent.group.id}-to-${edgeTarget}`;

      newEdges.push({
        id: edgeId,
        source: parentNodeId,
        target: edgeTarget,
        type: 'rightsLabel',
        animated: true,
        style: { stroke: '#66bb6a', strokeWidth: 2, strokeDasharray: '5 5' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#66bb6a',
        },
        data: {
          rights: parent.rights,
          relationshipKinds: parent.relationshipKinds,
          rightRelationshipKinds: parent.rightRelationshipKinds,
          sourceName: groupNameMap.get(parentNodeId) ?? null,
          targetName: groupNameMap.get(edgeTarget) ?? null,
          bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
          edgeEditingEnabled: isInteractiveRef.current,
          onBendPointsChange: handleEdgeBendPointsChange,
        },
      } satisfies Edge<EditableRightsLabelEdgeData>);
    });

    // Add child nodes
    children.forEach((child, index: number) => {
      const level = child.level || 1;
      const yOffset = 150 * level;
      const xOffset = (index - children.length / 2) * 200;

      const childNodeId = `child-${child.group.id}`;
      const isHierarchicalChild = child.group.group_type === 'hierarchical';

      newNodes.push({
        id: childNodeId,
        type: 'default',
        position: nodePositionsRef.current[childNodeId] ?? { x: 400 + xOffset, y: 300 + yOffset },
        data: {
          label: getGroupDisplayLabel(child.group.name, child.group.group_type),
          description: child.group.description ?? undefined,
          level,
          role: 'child',
          groupType: isHierarchicalChild ? 'hierarchical' : 'base',
        },
        style: {
          background: '#ffe0b2',
          color: '#333',
          border: isHierarchicalChild ? '3px dashed #ffa726' : '2px solid #ffcc80',
          borderRadius: '5px',
          padding: '10px',
          fontSize: '12px',
          fontWeight: '500',
          width: 180,
          textAlign: 'center',
        },
      });

      let edgeSource = groupId;
      if (showIndirect && child.parentId && child.parentId !== groupId) {
        edgeSource = `child-${child.parentId}`;
      }

      const edgeId = `edge-${edgeSource}-to-child-${child.group.id}`;

      newEdges.push({
        id: edgeId,
        source: edgeSource,
        target: childNodeId,
        type: 'rightsLabel',
        animated: true,
        style: { stroke: '#ffb74d', strokeWidth: 2, strokeDasharray: '5 5' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#ffb74d',
        },
        data: {
          rights: child.rights,
          relationshipKinds: child.relationshipKinds,
          rightRelationshipKinds: child.rightRelationshipKinds,
          sourceName: groupNameMap.get(edgeSource) ?? null,
          targetName: groupNameMap.get(childNodeId) ?? null,
          bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
          edgeEditingEnabled: isInteractiveRef.current,
          onBendPointsChange: handleEdgeBendPointsChange,
        },
      } satisfies Edge<EditableRightsLabelEdgeData>);
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
  }, [group, groupId, handleEdgeBendPointsChange, setEdges, stableRelationships, showIndirect]);

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
  const filteredEdges = useMemo(() => {
    return filterEdgesByRights(edges, selectedRights);
  }, [edges, selectedRights]);

  // Filter nodes to only show those connected via visible edges
  const filteredNodes = useMemo(() => {
    return filterNodesByEdges(nodes, filteredEdges, [groupId]);
  }, [nodes, filteredEdges, groupId]);

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

      const rawId = node.id.replace(/^(parent-|child-)/, '');

      // Find the group data from relationships
      const nodeGroup = stableRelationships.find(
        rel => rel.group_id === rawId || rel.related_group_id === rawId
      );

      const groupData = nodeGroup
        ? { id: rawId, name: nodeData.label, description: nodeData.description ?? null }
        : node.id === groupId || rawId === groupId
          ? group
          : null;

      if (groupData) {
        setSelectedEntity({ type: 'group', data: groupData });
        setDialogOpen(true);
      }
    },
    [isInteractive, stableRelationships, groupId, group]
  );

  // Handle edge click
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (!isInteractive) return;

      setSelectedEntity({
        type: 'relationship',
        data: {
          source: edge.source,
          target: edge.target,
          sourceName: typeof edge.data?.sourceName === 'string' ? edge.data.sourceName : null,
          targetName: typeof edge.data?.targetName === 'string' ? edge.data.targetName : null,
          rights: Array.isArray(edge.data?.rights) ? (edge.data.rights as string[]) : [],
          relationshipKinds: Array.isArray(edge.data?.relationshipKinds)
            ? (edge.data.relationshipKinds as NetworkRelationshipKind[])
            : [],
          rightRelationshipKinds:
            edge.data?.rightRelationshipKinds &&
            typeof edge.data.rightRelationshipKinds === 'object'
              ? (edge.data.rightRelationshipKinds as Record<string, NetworkRelationshipKind>)
              : undefined,
          label: Array.isArray(edge.data?.relationshipKinds)
            ? (edge.data.relationshipKinds as NetworkRelationshipKind[])
                .filter(kind => kind === 'incoming' || kind === 'outgoing')
                .map(kind =>
                  kind === 'incoming'
                    ? t('common.network.incomingRequest')
                    : t('common.network.outgoingRequest')
                )
                .join(', ') || (typeof edge.label === 'string' ? edge.label : null)
            : typeof edge.label === 'string'
              ? edge.label
              : null,
        },
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
              {
                id: 'parent-groups',
                label: t('common.network.parentGroups'),
                swatchClassName: 'h-4 w-4 rounded border border-[#a5d6a7] bg-[#c8e6c9]',
              },
              {
                id: 'selected-group',
                label: t('common.network.selectedGroup'),
                swatchClassName: 'h-4 w-4 rounded border border-[#90caf9] bg-[#bbdefb]',
              },
              {
                id: 'child-groups',
                label: t('common.network.childGroups'),
                swatchClassName: 'h-4 w-4 rounded border border-[#ffcc80] bg-[#ffe0b2]',
              },
            ]}
            showGroupTypeLegend
            baseGroupLabel={t('common.network.baseGroup', '◉ Base group')}
            hierarchicalGroupLabel={t('common.network.hierarchicalGroup', '🏛 Hierarchical group')}
            showDisplayControls
            showIndirect={showIndirect}
            onShowIndirectChange={setShowIndirect}
            isInteractive={isInteractive}
            onInteractiveChange={setIsInteractive}
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
            showRightsLegend
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

'use client';
import { featureThemeValue } from '@/features/shared/theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import { sortWorkflowSteps } from '../logic/workflowHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
interface WorkflowNode extends Node {
  data: {
    label: string;
    stepIndex: number;
    role: 'first' | 'middle' | 'last';
  };
}
interface WorkflowFlowVisualizationStep {
  id: string;
  order_index: number;
  label: string | null;
  group_id: string;
  group: {
    id: string;
    name: string | null;
  } | null;
}
interface WorkflowFlowVisualizationStartGroup {
  id: string;
  name: string | null;
}
export interface WorkflowFlowVisualizationWorkflow {
  name: string | null;
  description?: string | null;
  startGroup?: WorkflowFlowVisualizationStartGroup | null;
  approvalState?: 'accepted' | 'pending';
  steps: readonly WorkflowFlowVisualizationStep[];
}
interface WorkflowFlowVisualizationProps {
  workflow: WorkflowFlowVisualizationWorkflow;
}
// Color palette matching the group network hierarchy style
const NODE_COLORS = {
  first: {
    bg: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColor'),
    border: featureThemeValue('amendmentAmendmentPathVisualizationThemeValueAlpha'),
    stroke: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
  }, // green – start
  middle: {
    bg: featureThemeValue('floweditorUseFlowEditorInfoColor'),
    border: featureThemeValue('amendmentAmendmentPathVisualizationInfoColor'),
    stroke: featureThemeValue('networkWorkflowFlowVisualizationInfoColor'),
  }, // blue – intermediate
  last: {
    bg: featureThemeValue('floweditorFlowEditorDefaultsWarningColor'),
    border: featureThemeValue('networkWorkflowFlowVisualizationWarningColor'),
    stroke: featureThemeValue('networkUseGroupNetworkFlowWarningColor'),
  }, // orange – end
} as const;

export function useWorkflowFlowVisualizationController({
  workflow,
}: WorkflowFlowVisualizationProps) {
  const { t } = useTranslation();

  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const [legendCollapsed, setLegendCollapsed] = useState(false);

  const [isInteractive, setIsInteractive] = useState(true);

  const sortedSteps = useMemo(() => sortWorkflowSteps(workflow.steps), [workflow.steps]);

  const isAcceptedByAllGroups = workflow.approvalState === 'accepted';

  const buildGraph = useCallback(() => {
    const sequence = [
      ...(workflow.startGroup
        ? [
            {
              id: `workflow-start-${workflow.startGroup.id}`,
              label: workflow.startGroup.name ?? workflow.startGroup.id,
            },
          ]
        : []),
      ...sortedSteps.map(step => ({
        id: step.id,
        label: step.group?.name ?? step.label ?? `Step ${step.order_index + 1}`,
      })),
    ];

    if (sequence.length === 0) return { nodes: [] as WorkflowNode[], edges: [] as Edge[] };

    const totalNodes = sequence.length;
    // Lay nodes out in a horizontal line, spaced 280px apart
    const newNodes: WorkflowNode[] = sequence.map((entry, index) => {
      const role: 'first' | 'middle' | 'last' =
        index === 0 ? 'first' : index === totalNodes - 1 ? 'last' : 'middle';
      const colors = NODE_COLORS[role];

      return {
        id: entry.id,
        type: 'default',
        position: { x: index * 280, y: 120 },
        data: {
          label: entry.label,
          stepIndex: index,
          role,
        },
        style: {
          background: colors.bg,
          color: featureThemeValue('amendmentAmendmentPathVisualizationNeutralColor'),
          border: `2px solid ${colors.border}`,
          borderRadius: '5px',
          padding: '10px',
          fontSize: '12px',
          fontWeight: '500',
          width: 180,
          textAlign: 'center' as const,
        },
      };
    });

    const newEdges: Edge[] = sequence.slice(0, -1).map((entry, index) => {
      const nextEntry = sequence[index + 1];
      const role: 'first' | 'middle' | 'last' =
        index === 0 ? 'first' : index === totalNodes - 2 ? 'last' : 'middle';
      const colors = NODE_COLORS[role];

      return {
        id: `edge-${entry.id}-${nextEntry.id}`,
        source: entry.id,
        target: nextEntry.id,
        type: 'rightsLabel',
        animated: true,
        style: { stroke: colors.stroke, strokeWidth: 2, strokeDasharray: '5 5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: colors.stroke },
        data: {
          rights: [`Step ${index + 1} → ${index + 2}`],
          sourceName: newNodes[index].data.label,
          targetName: newNodes[index + 1].data.label,
        },
      };
    });

    return { nodes: newNodes, edges: newEdges };
  }, [sortedSteps, workflow.startGroup]);

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph();
    setNodes(n);
    setEdges(e);
  }, [buildGraph, setNodes, setEdges]);

  const handleInteractiveChange = useCallback((interactive: boolean) => {
    setIsInteractive(interactive);
  }, []);

  return {
    workflow,
    t,
    panelCollapsed,
    setPanelCollapsed,
    legendCollapsed,
    setLegendCollapsed,
    isInteractive,
    setIsInteractive,
    sortedSteps,
    isAcceptedByAllGroups,
    buildGraph,
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    handleInteractiveChange,
  };
}

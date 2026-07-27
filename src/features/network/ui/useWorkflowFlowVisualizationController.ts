'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import { sortWorkflowSteps } from '../logic/workflowHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getCivicNetworkEdgeStyle } from '@/features/network/logic/networkEdgeHelpers';
import {
  getGroupNodeVisualTokens,
  getWorkflowStepNodeStyle,
  type WorkflowStepVisualRole,
} from '@/features/network/ui/networkVisualHelpers';
interface WorkflowNode extends Node {
  data: {
    label: string;
    stepIndex: number;
    role: WorkflowStepVisualRole;
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

function getWorkflowStepRole(index: number, totalNodes: number): WorkflowStepVisualRole {
  if (index === 0) {
    return 'start';
  }

  if (index === totalNodes - 1) {
    return 'end';
  }

  return 'intermediate';
}

function getWorkflowEdgeVisualTokens(index: number, totalNodes: number) {
  const role = getWorkflowStepRole(index, Math.max(totalNodes - 1, 1));
  if (role === 'start') {
    return getGroupNodeVisualTokens('current');
  }
  if (role === 'end') {
    return getGroupNodeVisualTokens('child');
  }
  return getGroupNodeVisualTokens('parent');
}

export function useWorkflowFlowVisualizationController({
  workflow,
}: WorkflowFlowVisualizationProps) {
  const { t } = useTranslation();

  const [panelCollapsed, setPanelCollapsed] = useState(true);

  const [legendCollapsed, setLegendCollapsed] = useState(true);

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
        label:
          step.group?.name ??
          step.label ??
          t('features.network.workflows.stepLabel', {
            number: step.order_index + 1,
          }),
      })),
    ];

    if (sequence.length === 0) return { nodes: [] as WorkflowNode[], edges: [] as Edge[] };

    const totalNodes = sequence.length;
    // Lay nodes out in a horizontal line, spaced 280px apart
    const newNodes: WorkflowNode[] = sequence.map((entry, index) => {
      const role = getWorkflowStepRole(index, totalNodes);

      return {
        id: entry.id,
        type: 'default',
        position: { x: index * 280, y: 120 },
        data: {
          label: entry.label,
          stepIndex: index,
          role,
        },
        style: getWorkflowStepNodeStyle(role),
      };
    });

    const newEdges: Edge[] = sequence.slice(0, -1).map((entry, index) => {
      const nextEntry = sequence[index + 1];
      const visual = getWorkflowEdgeVisualTokens(index, totalNodes);

      return {
        id: `edge-${entry.id}-${nextEntry.id}`,
        source: entry.id,
        target: nextEntry.id,
        type: 'rightsLabel',
        animated: true,
        style: getCivicNetworkEdgeStyle({
          color: visual.borderColor,
          strokeDasharray: '5 5',
        }),
        markerEnd: { type: MarkerType.ArrowClosed, color: visual.borderColor },
        data: {
          rights: [
            t('features.network.workflows.stepTransition', {
              from: index + 1,
              to: index + 2,
            }),
          ],
          sourceName: newNodes[index].data.label,
          targetName: newNodes[index + 1].data.label,
        },
      };
    });

    return { nodes: newNodes, edges: newEdges };
  }, [sortedSteps, workflow.startGroup, t]);

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

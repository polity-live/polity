'use client';
import { featureThemeClassName } from '@/features/shared/theme';
import { CivicNetworkFlow } from '@/features/network/ui/CivicNetworkFlow';
import { createWorkflowStepLegendItem } from '@/features/network/ui/networkVisualHelpers';
import { CheckCircle2, Clock3 } from 'lucide-react';
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
export interface WorkflowFlowVisualizationViewProps {
  workflow: any;
  t: any;
  panelCollapsed: any;
  setPanelCollapsed: any;
  legendCollapsed: any;
  setLegendCollapsed: any;
  isInteractive: any;
  setIsInteractive: any;
  sortedSteps: any;
  isAcceptedByAllGroups: any;
  buildGraph: any;
  nodes: any;
  setNodes: any;
  onNodesChange: any;
  edges: any;
  setEdges: any;
  onEdgesChange: any;
  handleInteractiveChange: any;
}

export function WorkflowFlowVisualizationView({
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
  nodes,
  onNodesChange,
  edges,
  onEdgesChange,
  handleInteractiveChange,
}: WorkflowFlowVisualizationViewProps) {
  if (sortedSteps.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t('features.network.workflows.noSteps')}</p>
    );
  }

  return (
    <CivicNetworkFlow
      nodes={nodes}
      edges={edges}
      nodesDraggable={isInteractive}
      nodesFocusable={isInteractive}
      nodesConnectable={false}
      edgesFocusable={isInteractive}
      onNodesChange={isInteractive ? onNodesChange : undefined}
      onEdgesChange={isInteractive ? onEdgesChange : undefined}
      onInteractiveChange={handleInteractiveChange}
      containerClassName="h-full min-h-0"
      panelConfig={{
        title: workflow.name ?? t('features.network.workflows.title'),
        description: workflow.description ?? undefined,
        panelCollapsed,
        onPanelCollapsedChange: setPanelCollapsed,
        legendCollapsed,
        onLegendCollapsedChange: setLegendCollapsed,
        legendTitle: t('common.network.legend'),
        showDisplayControls: false,
        showInteractiveToggle: true,
        isInteractive,
        onInteractiveChange: setIsInteractive,
        lockLabel: t('common.network.lockEditor'),
        unlockLabel: t('common.network.unlockEditor'),
      }}
      legendItems={[
        createWorkflowStepLegendItem({
          id: 'start-step',
          label: t('features.network.workflows.legendStart'),
          role: 'start',
        }),
        createWorkflowStepLegendItem({
          id: 'intermediate-step',
          label: t('features.network.workflows.legendIntermediate'),
          role: 'intermediate',
        }),
        createWorkflowStepLegendItem({
          id: 'end-step',
          label: t('features.network.workflows.legendEnd'),
          role: 'end',
        }),
        {
          id: 'workflow-approval-state',
          label: isAcceptedByAllGroups
            ? t('features.network.workflows.legendAccepted')
            : t('features.network.workflows.legendPending'),
          swatch: isAcceptedByAllGroups ? (
            <CheckCircle2
              className={featureThemeClassName('networkWorkflowFlowVisualizationSuccessIcon')}
            />
          ) : (
            <Clock3
              className={featureThemeClassName('networkWorkflowFlowVisualizationWarningIcon')}
            />
          ),
        },
      ]}
    />
  );
}

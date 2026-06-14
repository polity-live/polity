'use client';
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

import { useWorkflowFlowVisualizationController } from './useWorkflowFlowVisualizationController';
import { WorkflowFlowVisualizationView } from './WorkflowFlowVisualizationView';

export function WorkflowFlowVisualization({ workflow }: WorkflowFlowVisualizationProps) {
  const viewProps = useWorkflowFlowVisualizationController({ workflow });

  return <WorkflowFlowVisualizationView {...viewProps} />;
}

import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import type { WorkflowFlowVisualizationWorkflow } from '@/features/network/ui/WorkflowFlowVisualization';

export function sortWorkflowsByName(workflows: readonly WorkflowWithStepsRow[]) {
  return [...workflows].sort((left, right) =>
    (left.name ?? 'Untitled').localeCompare(right.name ?? 'Untitled')
  );
}

export function getDefaultWorkflowId(
  workflows: readonly WorkflowWithStepsRow[],
  selectedWorkflowId: string
) {
  if (workflows.length === 0) {
    return '';
  }

  const hasSelectedWorkflow = workflows.some(workflow => workflow.id === selectedWorkflowId);
  if (hasSelectedWorkflow) {
    return selectedWorkflowId;
  }

  return workflows[0]?.id ?? '';
}

export function toWorkflowVisualizationWorkflow(
  workflow: WorkflowWithStepsRow
): WorkflowFlowVisualizationWorkflow {
  return {
    name: workflow.name,
    description: workflow.description ?? null,
    startGroup: workflow.start_group_id
      ? {
          id: workflow.start_group?.id ?? workflow.start_group_id,
          name: workflow.start_group?.name ?? workflow.start_group_id ?? null,
        }
      : null,
    approvalState: workflow.status === 'active' ? 'accepted' : 'pending',
    steps: [...(workflow.steps ?? [])].map(step => ({
      id: step.id,
      order_index: step.order_index,
      label: step.label,
      group_id: step.group_id,
      group: step.group,
    })),
  };
}

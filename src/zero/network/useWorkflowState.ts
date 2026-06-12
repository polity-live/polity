import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';
import type { WorkflowApprovalByGroupRow, WorkflowWithStepsRow } from './queries';

interface WorkflowStateOptions {
  groupId?: string;
  workflowId?: string;
  approvalGroupId?: string;
}

/**
 * Reactive state hook for workflow data.
 * Returns query-derived state — no mutations.
 */
export function useWorkflowState(options: WorkflowStateOptions = {}) {
  const { groupId, workflowId, approvalGroupId } = options;

  const [groupWorkflowApprovals, groupWorkflowApprovalsResult] = useQuery(
    groupId ? queries.network.workflowApprovalsByGroup({ groupId }) : undefined
  );

  const [workflow, workflowResult] = useQuery(
    workflowId ? queries.network.workflowById({ id: workflowId }) : undefined
  );

  const [allWorkflows, allWorkflowsResult] = useQuery(queries.network.allWorkflows({}));

  const [workflowApprovals, workflowApprovalsResult] = useQuery(
    approvalGroupId
      ? queries.network.workflowApprovalsByGroup({ groupId: approvalGroupId })
      : undefined
  );

  const groupWorkflows = useMemo(() => {
    const workflowsById = new Map<string, WorkflowWithStepsRow>();

    for (const approval of (groupWorkflowApprovals ?? []) as WorkflowApprovalByGroupRow[]) {
      if (!approval.workflow) {
        continue;
      }

      workflowsById.set(approval.workflow.id, approval.workflow);
    }

    return [...workflowsById.values()].sort(
      (left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0)
    );
  }, [groupWorkflowApprovals]);

  return {
    groupWorkflows,
    groupWorkflowsLoading: groupWorkflowApprovalsResult.type === 'unknown',
    workflow,
    workflowLoading: workflowResult.type === 'unknown',
    allWorkflows: allWorkflows ?? [],
    allWorkflowsLoading: allWorkflowsResult.type === 'unknown',
    workflowApprovals: workflowApprovals ?? [],
    workflowApprovalsLoading: workflowApprovalsResult.type === 'unknown',
  };
}

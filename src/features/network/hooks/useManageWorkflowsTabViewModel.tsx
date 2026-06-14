import type { DraftWorkflowStep } from './useWorkflowEditor';
import type { NormalizedGroupRelationship, NetworkGroupEntity } from '../types/network.types';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';

interface AvailableGroup {
  id: string;
  name: string | null;
  description?: unknown;
  group_type?: NetworkGroupEntity['group_type'] | null;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface AvailableWorkflow {
  id: string;
  group_id: string;
  name: string | null;
}

export interface ManageWorkflowsTabProps {
  canManageWorkflows: boolean;
  groupId: string;
  groupName: string;
  allRelationships: NormalizedGroupRelationship[];
  incomingRequests: WorkflowWithStepsRow[];
  outgoingRequests: WorkflowWithStepsRow[];
  activeRelevantWorkflows: WorkflowWithStepsRow[];
  isWorkflowEditorOpen: boolean;
  editingWorkflow: WorkflowWithStepsRow | null;
  workflowDraftStartGroupId: string;
  onWorkflowDraftStartGroupIdChange: (groupId: string) => void;
  workflowDraftName: string;
  onWorkflowDraftNameChange: (name: string) => void;
  workflowDraftDescription: string;
  onWorkflowDraftDescriptionChange: (description: string) => void;
  workflowDraftIsDefaultEntry: boolean;
  onWorkflowDraftIsDefaultEntryChange: (value: boolean) => void;
  workflowDraftSteps: DraftWorkflowStep[];
  availableGroups: AvailableGroup[];
  availableWorkflows: AvailableWorkflow[];
  onOpenNewWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowWithStepsRow) => void;
  onCloseWorkflowEditor: () => void;
  onAddWorkflowStep: (step: DraftWorkflowStep) => void;
  onUpdateWorkflowStep: (index: number, patch: Partial<DraftWorkflowStep>) => void;
  onRemoveWorkflowStep: (index: number) => void;
  onMoveWorkflowStep: (fromIndex: number, toIndex: number) => void;
  onSaveWorkflow: () => void;
  onDeleteWorkflow: (workflowId: string) => void;
  onApproveWorkflowApproval: (approvalId: string) => void;
  onRejectWorkflowApproval: (approvalId: string) => void;
}

export function useManageWorkflowsTabViewModel(props: ManageWorkflowsTabProps) {
  return props;
}

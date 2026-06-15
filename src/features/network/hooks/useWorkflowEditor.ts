import { useCallback, useState } from 'react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useWorkflowState } from '@/zero/network/useWorkflowState';
import { useWorkflowActions } from '@/zero/network/useWorkflowActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';

export interface DraftWorkflowStep {
  id?: string;
  group_id: string;
  label: string | null;
  step_kind: 'group_vote' | 'merge_vote' | 'workflow_handoff';
  selection_mode: 'default_target_workflow' | 'explicit_workflow';
  merge_strategy: 'winner_continues' | null;
  event_rule: string | null;
  auto_task_on_missing_event: boolean;
  target_workflow_id: string | null;
}

function createDraftStep(step: DraftWorkflowStep): DraftWorkflowStep {
  return {
    ...step,
    id: step.id ?? crypto.randomUUID(),
  };
}

export function useWorkflowEditor(groupId: string) {
  const { t } = useTranslation();
  const { groupWorkflows, groupWorkflowsLoading, allWorkflows } = useWorkflowState({ groupId });
  const actions = useWorkflowActions();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowWithStepsRow | null>(null);
  const [draftStartGroupId, setDraftStartGroupId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftIsDefaultEntry, setDraftIsDefaultEntry] = useState(false);
  const [draftSteps, setDraftSteps] = useState<DraftWorkflowStep[]>([]);

  const openNewWorkflow = useCallback(() => {
    setEditingWorkflow(null);
    setDraftStartGroupId('');
    setDraftName('');
    setDraftDescription('');
    setDraftIsDefaultEntry(false);
    setDraftSteps([]);
    setIsEditorOpen(true);
  }, []);

  const openEditWorkflow = useCallback((workflow: WorkflowWithStepsRow) => {
    setEditingWorkflow(workflow);
    setDraftStartGroupId(workflow.start_group_id ?? '');
    setDraftName(workflow.name ?? '');
    setDraftDescription(workflow.description ?? '');
    setDraftIsDefaultEntry(workflow.is_default_entry ?? false);
    setDraftSteps(
      [...workflow.steps]
        .sort((a, b) => a.order_index - b.order_index)
        .map(step => ({
          id: step.id,
          group_id: step.group_id,
          label: step.label,
          step_kind:
            step.step_kind === 'merge_vote' || step.step_kind === 'workflow_handoff'
              ? step.step_kind
              : 'group_vote',
          selection_mode:
            step.selection_mode === 'explicit_workflow'
              ? 'explicit_workflow'
              : 'default_target_workflow',
          merge_strategy: step.merge_strategy === 'winner_continues' ? step.merge_strategy : null,
          event_rule: step.event_rule ?? null,
          auto_task_on_missing_event: step.auto_task_on_missing_event ?? false,
          target_workflow_id: step.target_workflow_id ?? null,
        }))
    );
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingWorkflow(null);
  }, []);

  const addDraftStep = useCallback((step: DraftWorkflowStep) => {
    setDraftSteps(prev => [...prev, createDraftStep(step)]);
  }, []);

  const updateDraftStep = useCallback((index: number, patch: Partial<DraftWorkflowStep>) => {
    setDraftSteps(prev =>
      prev.map((step, currentIndex) => {
        if (currentIndex !== index) {
          return step;
        }

        return {
          ...step,
          ...patch,
        };
      })
    );
  }, []);

  const removeDraftStep = useCallback((index: number) => {
    setDraftSteps(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const moveDraftStep = useCallback((fromIndex: number, toIndex: number) => {
    setDraftSteps(prev => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const saveWorkflow = useCallback(
    async (createdById: string) => {
      if (!draftStartGroupId || draftSteps.length === 0) {
        return;
      }

      try {
        const result = actions.saveWorkflowDefinition({
          id: editingWorkflow?.id ?? crypto.randomUUID(),
          editing_group_id: groupId,
          start_group_id: draftStartGroupId,
          name: draftName.trim(),
          description: draftDescription.trim(),
          is_default_entry: draftIsDefaultEntry,
          created_by_id: createdById,
          steps: draftSteps.map((step, index) => ({
            id: step.id ?? crypto.randomUUID(),
            group_id: step.group_id,
            order_index: index,
            label: step.label,
            step_kind: step.step_kind,
            selection_mode: step.selection_mode,
            merge_strategy: step.merge_strategy,
            event_rule: step.event_rule,
            auto_task_on_missing_event: step.auto_task_on_missing_event,
            target_workflow_id: step.target_workflow_id,
          })),
        });

        await serverConfirmed(result);
        toast.success(t('features.network.toasts.workflowSaved'));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('features.network.toasts.workflowSaveFailed')
        );
      }
    },
    [
      actions,
      draftDescription,
      draftIsDefaultEntry,
      draftName,
      draftStartGroupId,
      draftSteps,
      editingWorkflow?.id,
      groupId,
      t,
    ]
  );

  const deleteWorkflow = useCallback(
    async (workflowId: string) => {
      await actions.deleteWorkflow(workflowId);
    },
    [actions]
  );

  return {
    workflows: groupWorkflows,
    isLoading: groupWorkflowsLoading,
    allWorkflows,
    isEditorOpen,
    editingWorkflow,
    draftStartGroupId,
    setDraftStartGroupId,
    draftName,
    setDraftName,
    draftDescription,
    setDraftDescription,
    draftIsDefaultEntry,
    setDraftIsDefaultEntry,
    draftSteps,
    openNewWorkflow,
    openEditWorkflow,
    closeEditor,
    addDraftStep,
    updateDraftStep,
    removeDraftStep,
    moveDraftStep,
    saveWorkflow,
    deleteWorkflow,
  };
}

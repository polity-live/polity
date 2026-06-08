import { useState, useCallback } from 'react';
import { useWorkflowState } from '@/zero/network/useWorkflowState';
import { useWorkflowActions } from '@/zero/network/useWorkflowActions';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';

export interface DraftWorkflowStep {
  group_id: string;
  label: string | null;
  step_kind: 'group_vote' | 'merge_vote' | 'workflow_handoff';
  selection_mode: 'default_target_workflow' | 'explicit_workflow';
  merge_strategy: 'winner_continues' | null;
  event_rule: string | null;
  auto_task_on_missing_event: boolean;
  target_workflow_id: string | null;
}

export function useWorkflowEditor(groupId: string) {
  const { groupWorkflows, groupWorkflowsLoading, allWorkflows } = useWorkflowState({ groupId });
  const actions = useWorkflowActions();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowWithStepsRow | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftIsDefaultEntry, setDraftIsDefaultEntry] = useState(false);
  const [draftSteps, setDraftSteps] = useState<DraftWorkflowStep[]>([]);

  const openNewWorkflow = useCallback(() => {
    setEditingWorkflow(null);
    setDraftName('');
    setDraftDescription('');
    setDraftIsDefaultEntry(false);
    setDraftSteps([]);
    setIsEditorOpen(true);
  }, []);

  const openEditWorkflow = useCallback((workflow: WorkflowWithStepsRow) => {
    setEditingWorkflow(workflow);
    setDraftName(workflow.name ?? '');
    setDraftDescription(workflow.description ?? '');
    setDraftIsDefaultEntry(workflow.is_default_entry ?? false);
    setDraftSteps(
      [...workflow.steps]
        .sort((a, b) => a.order_index - b.order_index)
        .map(s => ({
          group_id: s.group_id,
          label: s.label,
          step_kind:
            s.step_kind === 'merge_vote' || s.step_kind === 'workflow_handoff'
              ? s.step_kind
              : 'group_vote',
          selection_mode:
            s.selection_mode === 'explicit_workflow'
              ? 'explicit_workflow'
              : 'default_target_workflow',
          merge_strategy: s.merge_strategy === 'winner_continues' ? s.merge_strategy : null,
          event_rule: s.event_rule ?? null,
          auto_task_on_missing_event: s.auto_task_on_missing_event ?? false,
          target_workflow_id: s.target_workflow_id ?? null,
        }))
    );
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingWorkflow(null);
  }, []);

  const addDraftStep = useCallback((groupId: string, label: string | null = null) => {
    setDraftSteps(prev => [
      ...prev,
      {
        group_id: groupId,
        label,
        step_kind: 'group_vote',
        selection_mode: 'default_target_workflow',
        merge_strategy: null,
        event_rule: null,
        auto_task_on_missing_event: true,
        target_workflow_id: null,
      },
    ]);
  }, []);

  const updateDraftStep = useCallback((index: number, patch: Partial<DraftWorkflowStep>) => {
    setDraftSteps(prev =>
      prev.map((step, currentIndex) =>
        currentIndex === index
          ? {
              ...step,
              ...patch,
            }
          : step
      )
    );
  }, []);

  const removeDraftStep = useCallback((index: number) => {
    setDraftSteps(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveDraftStep = useCallback((fromIndex: number, toIndex: number) => {
    setDraftSteps(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const saveWorkflow = useCallback(
    async (createdById: string) => {
      if (editingWorkflow) {
        // Update existing workflow
        await actions.updateWorkflow({
          id: editingWorkflow.id,
          name: draftName || null,
          description: draftDescription || null,
          is_default_entry: draftIsDefaultEntry,
        });

        // Delete old steps and recreate
        for (const step of editingWorkflow.steps) {
          await actions.deleteWorkflowStep(step.id);
        }

        for (let i = 0; i < draftSteps.length; i++) {
          await actions.createWorkflowStep({
            id: crypto.randomUUID(),
            workflow_id: editingWorkflow.id,
            group_id: draftSteps[i].group_id,
            order_index: i,
            label: draftSteps[i].label,
            step_kind: draftSteps[i].step_kind,
            selection_mode: draftSteps[i].selection_mode,
            merge_strategy: draftSteps[i].merge_strategy,
            event_rule: draftSteps[i].event_rule,
            auto_task_on_missing_event: draftSteps[i].auto_task_on_missing_event,
            target_workflow_id: draftSteps[i].target_workflow_id,
          });
        }
      } else {
        // Create new workflow
        const workflowId = crypto.randomUUID();
        await actions.createWorkflow({
          id: workflowId,
          group_id: groupId,
          name: draftName || null,
          description: draftDescription || null,
          is_default_entry: draftIsDefaultEntry,
          status: 'active',
          created_by_id: createdById,
        });

        for (let i = 0; i < draftSteps.length; i++) {
          await actions.createWorkflowStep({
            id: crypto.randomUUID(),
            workflow_id: workflowId,
            group_id: draftSteps[i].group_id,
            order_index: i,
            label: draftSteps[i].label,
            step_kind: draftSteps[i].step_kind,
            selection_mode: draftSteps[i].selection_mode,
            merge_strategy: draftSteps[i].merge_strategy,
            event_rule: draftSteps[i].event_rule,
            auto_task_on_missing_event: draftSteps[i].auto_task_on_missing_event,
            target_workflow_id: draftSteps[i].target_workflow_id,
          });
        }
      }

      closeEditor();
    },
    [
      editingWorkflow,
      draftDescription,
      draftIsDefaultEntry,
      draftName,
      draftSteps,
      groupId,
      actions,
      closeEditor,
    ]
  );

  const deleteWorkflow = useCallback(
    async (workflowId: string) => {
      await actions.deleteWorkflow(workflowId);
    },
    [actions]
  );

  return {
    // Data
    workflows: groupWorkflows,
    isLoading: groupWorkflowsLoading,
    allWorkflows,
    // Editor state
    isEditorOpen,
    editingWorkflow,
    draftName,
    setDraftName,
    draftDescription,
    setDraftDescription,
    draftIsDefaultEntry,
    setDraftIsDefaultEntry,
    draftSteps,
    // Editor actions
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

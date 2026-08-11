'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ActionSubmissionContext } from '@/features/shared/ui/action-submission';
import type { DraftWorkflowStep } from './useWorkflowEditor';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import type { NormalizedGroupRelationship, NetworkGroupEntity } from '../types/network.types';
import {
  type AmendmentNetworkGroup,
  type AmendmentNetworkRelationship,
  getDirectReachableTargetGroupsFromSource,
} from '@/features/amendments/logic/amendmentPathHelpers';
import { isActiveGroupRelationshipStatus } from '../logic/networkRelationshipHelpers';
import { type WorkflowFlowVisualizationWorkflow } from '../ui/WorkflowFlowVisualization';

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
  status?: string | null;
}

export interface WorkflowEditorProps {
  currentGroupId: string;
  currentGroupName: string;
  allRelationships: NormalizedGroupRelationship[];
  isOpen: boolean;
  editingWorkflow: WorkflowWithStepsRow | null;
  draftStartGroupId: string;
  setDraftStartGroupId: (groupId: string) => void;
  draftName: string;
  setDraftName: (name: string) => void;
  draftDescription: string;
  setDraftDescription: (description: string) => void;
  draftIsDefaultEntry: boolean;
  setDraftIsDefaultEntry: (value: boolean) => void;
  draftSteps: DraftWorkflowStep[];
  availableGroups: AvailableGroup[];
  availableWorkflows: AvailableWorkflow[];
  onClose: () => void;
  onAddStep: (step: DraftWorkflowStep) => void;
  onUpdateStep: (index: number, patch: Partial<DraftWorkflowStep>) => void;
  onRemoveStep: (index: number) => void;
  onMoveStep: (fromIndex: number, toIndex: number) => void;
  onSave: (submissionContext?: ActionSubmissionContext) => void;
}

interface WorkflowTransition {
  index: number;
  sourceGroupId: string;
  targetGroupId: string;
  step: DraftWorkflowStep;
}

function createBlankStepDraft(): DraftWorkflowStep {
  return {
    group_id: '',
    label: null,
    step_kind: 'group_vote',
    selection_mode: 'default_target_workflow',
    merge_strategy: null,
    event_rule: null,
    auto_task_on_missing_event: true,
    target_workflow_id: null,
  };
}

function sortGroupsByName(groups: AvailableGroup[]) {
  return [...groups].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
}

function getGroupName(groupId: string, availableGroups: AvailableGroup[]) {
  return availableGroups.find(group => group.id === groupId)?.name ?? groupId;
}

function getTypeaheadItems(groups: AvailableGroup[]) {
  return toTypeaheadItems(
    groups,
    'group',
    group => group.name ?? group.id,
    group => {
      const description = richTextToPlainText(group.description);
      return description ? description.substring(0, 80) : undefined;
    },
    undefined,
    group => `/group/${group.id}`
  );
}

export function useWorkflowEditorViewModel({
  currentGroupId,
  currentGroupName,
  allRelationships,
  isOpen,
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
  availableGroups,
  onClose,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  onSave,
}: WorkflowEditorProps) {
  const { t } = useTranslation();
  const [builderTab, setBuilderTab] = useState<'type' | 'graph'>('type');
  const [visualizationTab, setVisualizationTab] = useState<'graph' | 'list'>('graph');
  const [graphSelectionMode, setGraphSelectionMode] = useState<'start' | 'target'>('start');
  const [pendingTargetGroupId, setPendingTargetGroupId] = useState('');
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);

  const networkGroups = useMemo(
    () =>
      availableGroups.map(group => ({
        ...group,
        name: group.name ?? group.id,
      })) as AmendmentNetworkGroup[],
    [availableGroups]
  );
  const amendmentRelationships = useMemo(
    () =>
      allRelationships.filter(
        relationship =>
          relationship.with_right === 'amendmentRight' &&
          isActiveGroupRelationshipStatus(relationship.status)
      ) as AmendmentNetworkRelationship[],
    [allRelationships]
  );
  const allGroupOptions = useMemo(() => sortGroupsByName(availableGroups), [availableGroups]);
  const allGroupItems = useMemo(() => getTypeaheadItems(allGroupOptions), [allGroupOptions]);

  const transitions = useMemo<WorkflowTransition[]>(
    () =>
      draftSteps.map((step, index) => ({
        index,
        sourceGroupId: index === 0 ? draftStartGroupId : draftSteps[index - 1].group_id,
        targetGroupId: step.group_id,
        step,
      })),
    [draftStartGroupId, draftSteps]
  );

  const pendingSourceGroupId = useMemo(() => {
    if (draftSteps.length === 0) {
      return draftStartGroupId;
    }

    return draftSteps[draftSteps.length - 1].group_id;
  }, [draftStartGroupId, draftSteps]);

  const getDirectTargetGroups = useCallback(
    (sourceGroupId: string) => {
      if (!sourceGroupId) {
        return [];
      }

      return sortGroupsByName(
        getDirectReachableTargetGroupsFromSource({
          sourceGroupId,
          groups: networkGroups,
          relationships: amendmentRelationships,
        }) as AvailableGroup[]
      );
    },
    [amendmentRelationships, networkGroups]
  );

  const pendingTargetOptions = useMemo(
    () => getDirectTargetGroups(pendingSourceGroupId),
    [getDirectTargetGroups, pendingSourceGroupId]
  );
  const pendingTargetItems = useMemo(
    () => getTypeaheadItems(pendingTargetOptions),
    [pendingTargetOptions]
  );

  const pendingHighlightGroupIds = useMemo(() => {
    const highlights = pendingSourceGroupId ? [pendingSourceGroupId] : [];
    if (pendingTargetGroupId) {
      highlights.push(pendingTargetGroupId);
    }

    return highlights;
  }, [pendingSourceGroupId, pendingTargetGroupId]);

  const graphRootGroupId = useMemo(() => {
    if (draftSteps.length > 0) {
      return pendingSourceGroupId || currentGroupId;
    }

    if (graphSelectionMode === 'target' && draftStartGroupId) {
      return draftStartGroupId;
    }

    return currentGroupId;
  }, [
    currentGroupId,
    draftStartGroupId,
    draftSteps.length,
    graphSelectionMode,
    pendingSourceGroupId,
  ]);

  const participantGroupIds = useMemo(
    () =>
      new Set(
        [draftStartGroupId, ...draftSteps.map(step => step.group_id)].filter(
          (groupId): groupId is string => Boolean(groupId)
        )
      ),
    [draftStartGroupId, draftSteps]
  );

  const invalidTransitionIndexes = useMemo(() => {
    const invalidIndexes: number[] = [];

    for (const transition of transitions) {
      if (!transition.sourceGroupId || !transition.targetGroupId) {
        invalidIndexes.push(transition.index);
        continue;
      }

      const directTargetIds = new Set(
        getDirectTargetGroups(transition.sourceGroupId).map(group => group.id)
      );
      if (!directTargetIds.has(transition.targetGroupId)) {
        invalidIndexes.push(transition.index);
      }
    }

    return invalidIndexes;
  }, [getDirectTargetGroups, transitions]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (!draftName.trim()) {
      messages.push(t('features.network.workflows.validationMissingTitle'));
    }

    if (!draftStartGroupId) {
      messages.push(t('features.network.workflows.validationMissingStart'));
    }

    if (draftSteps.length === 0) {
      messages.push(t('features.network.workflows.validationMissingSteps'));
    }

    if (!participantGroupIds.has(currentGroupId)) {
      messages.push(t('features.network.workflows.validationCurrentGroupRequired'));
    }

    if (invalidTransitionIndexes.length > 0) {
      messages.push(t('features.network.workflows.validationDirectTransitions'));
    }

    return messages;
  }, [
    currentGroupId,
    draftName,
    draftStartGroupId,
    draftSteps.length,
    invalidTransitionIndexes.length,
    participantGroupIds,
    t,
  ]);

  const isPendingStepValid = Boolean(pendingSourceGroupId) && Boolean(pendingTargetGroupId);
  const canSave = validationMessages.length === 0;
  const finalTargetGroupId = draftSteps[draftSteps.length - 1]?.group_id ?? '';

  const previewWorkflow = useMemo<WorkflowFlowVisualizationWorkflow | null>(() => {
    if (draftSteps.length === 0) {
      return null;
    }

    return {
      name:
        draftName.trim() || editingWorkflow?.name || t('features.network.workflows.previewTitle'),
      description: draftDescription.trim() || null,
      startGroup: draftStartGroupId
        ? {
            id: draftStartGroupId,
            name: getGroupName(draftStartGroupId, availableGroups),
          }
        : null,
      approvalState: editingWorkflow?.status === 'active' ? 'accepted' : 'pending',
      steps: draftSteps.map((step, index) => ({
        id: step.id ?? `draft-step-${index}`,
        group_id: step.group_id,
        order_index: index,
        label: step.label,
        group: step.group_id
          ? {
              id: step.group_id,
              name: getGroupName(step.group_id, availableGroups),
            }
          : null,
      })),
    };
  }, [
    availableGroups,
    draftDescription,
    draftName,
    draftStartGroupId,
    draftSteps,
    editingWorkflow?.name,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setBuilderTab('type');
    setVisualizationTab('graph');
    setGraphSelectionMode(draftSteps.length === 0 && !draftStartGroupId ? 'start' : 'target');
    setPendingTargetGroupId('');
    setDraggedStepIndex(null);
  }, [draftStartGroupId, draftSteps.length, editingWorkflow?.id, isOpen]);

  useEffect(() => {
    if (draftSteps.length > 0) {
      setGraphSelectionMode('target');
    }
  }, [draftSteps.length]);

  const handleAddPendingStep = useCallback(() => {
    if (!pendingTargetGroupId || !isPendingStepValid) {
      return;
    }

    onAddStep({
      ...createBlankStepDraft(),
      group_id: pendingTargetGroupId,
    });

    setPendingTargetGroupId('');
    setGraphSelectionMode('target');
  }, [isPendingStepValid, onAddStep, pendingTargetGroupId]);

  const handleGraphGroupClick = useCallback(
    (groupId: string) => {
      if (draftSteps.length === 0 && graphSelectionMode === 'start') {
        setDraftStartGroupId(groupId);
        setPendingTargetGroupId('');
        setGraphSelectionMode('target');
        return;
      }

      const nextTargetIds = new Set(pendingTargetOptions.map(group => group.id));
      if (nextTargetIds.has(groupId)) {
        setPendingTargetGroupId(groupId);
      }
    },
    [draftSteps.length, graphSelectionMode, pendingTargetOptions, setDraftStartGroupId]
  );

  const handleRowDrop = useCallback(
    (targetIndex: number) => {
      if (draggedStepIndex == null || draggedStepIndex === targetIndex) {
        setDraggedStepIndex(null);
        return;
      }

      onMoveStep(draggedStepIndex, targetIndex);
      setDraggedStepIndex(null);
    },
    [draggedStepIndex, onMoveStep]
  );

  const handleRowTargetChange = useCallback(
    (index: number, value: string) => {
      onUpdateStep(index, {
        group_id: value,
      });
    },
    [onUpdateStep]
  );

  return {
    allGroupItems,
    availableGroups,
    builderTab,
    canSave,
    currentGroupId,
    currentGroupName,
    draftDescription,
    draftIsDefaultEntry,
    draftName,
    draftStartGroupId,
    draftSteps,
    editingWorkflow,
    finalTargetGroupId,
    getDirectTargetGroups,
    graphRootGroupId,
    graphSelectionMode,
    handleAddPendingStep,
    handleGraphGroupClick,
    handleRowDrop,
    handleRowTargetChange,
    invalidTransitionIndexes,
    isOpen,
    isPendingStepValid,
    onClose,
    onMoveStep,
    onRemoveStep,
    onSave,
    pendingHighlightGroupIds,
    pendingSourceGroupId,
    pendingTargetGroupId,
    pendingTargetItems,
    previewWorkflow,
    setBuilderTab,
    setDraftDescription,
    setDraftIsDefaultEntry,
    setDraftName,
    setDraftStartGroupId,
    setDraggedStepIndex,
    setGraphSelectionMode,
    setPendingTargetGroupId,
    setVisualizationTab,
    t,
    validationMessages,
    visualizationTab,
  };
}

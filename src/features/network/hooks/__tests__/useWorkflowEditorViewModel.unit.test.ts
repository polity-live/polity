/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkflowEditorProps } from '../useWorkflowEditorViewModel';
import type { DraftWorkflowStep } from '../useWorkflowEditor';

const getDirectReachableTargetGroupsFromSourceMock = vi.fn();

vi.mock('@/features/amendments/logic/amendmentPathHelpers', () => ({
  getDirectReachableTargetGroupsFromSource: (...args: unknown[]) =>
    getDirectReachableTargetGroupsFromSourceMock(...args),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useWorkflowEditorViewModel } from '../useWorkflowEditorViewModel';

function draftStep(overrides: Partial<DraftWorkflowStep> = {}): DraftWorkflowStep {
  return {
    id: 'step-1',
    group_id: 'valid',
    label: null,
    step_kind: 'group_vote',
    selection_mode: 'default_target_workflow',
    merge_strategy: null,
    event_rule: null,
    auto_task_on_missing_event: true,
    target_workflow_id: null,
    ...overrides,
  };
}

const availableGroups = [
  { id: 'other', name: 'Other', description: null },
  { id: 'start', name: null, description: { type: 'doc', content: [] } },
  { id: 'valid', name: 'Valid', description: 'A valid target description' },
  { id: 'current', name: 'Current', description: undefined },
];

function createProps(overrides: Partial<WorkflowEditorProps> = {}): WorkflowEditorProps {
  return {
    currentGroupId: 'current',
    currentGroupName: 'Current',
    allRelationships: [
      { id: 'amendment-active', with_right: 'amendmentRight', status: 'active' },
      { id: 'amendment-pending', with_right: 'amendmentRight', status: 'pending' },
      { id: 'information-active', with_right: 'informationRight', status: 'active' },
    ] as never,
    isOpen: false,
    editingWorkflow: null,
    draftStartGroupId: '',
    setDraftStartGroupId: vi.fn(),
    draftName: '',
    setDraftName: vi.fn(),
    draftDescription: '',
    setDraftDescription: vi.fn(),
    draftIsDefaultEntry: false,
    setDraftIsDefaultEntry: vi.fn(),
    draftSteps: [],
    availableGroups,
    availableWorkflows: [],
    onClose: vi.fn(),
    onAddStep: vi.fn(),
    onUpdateStep: vi.fn(),
    onRemoveStep: vi.fn(),
    onMoveStep: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
}

describe('useWorkflowEditorViewModel', () => {
  beforeEach(() => {
    getDirectReachableTargetGroupsFromSourceMock.mockReset();
    getDirectReachableTargetGroupsFromSourceMock.mockImplementation(
      ({ sourceGroupId, groups }: { sourceGroupId: string; groups: typeof availableGroups }) => {
        const targetIds =
          sourceGroupId === 'start' ? ['valid'] : sourceGroupId === 'valid' ? ['other'] : [];
        return groups.filter(group => targetIds.includes(group.id));
      }
    );
  });

  it('derives blank-state options, validation, and graph defaults', () => {
    const props = createProps();
    const { result } = renderHook(() => useWorkflowEditorViewModel(props));

    expect(result.current.canSave).toBe(false);
    expect(result.current.validationMessages).toEqual([
      'features.network.workflows.validationMissingTitle',
      'features.network.workflows.validationMissingStart',
      'features.network.workflows.validationMissingSteps',
      'features.network.workflows.validationCurrentGroupRequired',
    ]);
    expect(result.current.previewWorkflow).toBeNull();
    expect(result.current.pendingSourceGroupId).toBe('');
    expect(result.current.pendingTargetItems).toEqual([]);
    expect(result.current.pendingHighlightGroupIds).toEqual([]);
    expect(result.current.graphRootGroupId).toBe('current');
    expect(result.current.finalTargetGroupId).toBe('');
    expect(result.current.isPendingStepValid).toBe(false);
    expect(result.current.allGroupItems).toHaveLength(4);
    expect(getDirectReachableTargetGroupsFromSourceMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceGroupId: '' })
    );
  });

  it('builds a valid active preview and identifies malformed transitions', () => {
    const validProps = createProps({
      currentGroupId: 'start',
      currentGroupName: 'Start',
      isOpen: true,
      editingWorkflow: { id: 'workflow-1', name: 'Persisted', status: 'active' } as never,
      draftStartGroupId: 'start',
      draftName: '  Draft name  ',
      draftDescription: '  Draft description  ',
      draftSteps: [
        draftStep({ id: 'valid-step', group_id: 'valid' }),
        draftStep({ id: undefined, group_id: 'other', label: 'Other step' }),
      ],
    });
    const { result, rerender } = renderHook(
      ({ props }: { props: WorkflowEditorProps }) => useWorkflowEditorViewModel(props),
      { initialProps: { props: validProps } }
    );

    expect(result.current.invalidTransitionIndexes).toEqual([]);
    expect(result.current.validationMessages).toEqual([]);
    expect(result.current.canSave).toBe(true);
    expect(result.current.finalTargetGroupId).toBe('other');
    expect(result.current.graphRootGroupId).toBe('other');
    expect(result.current.previewWorkflow).toMatchObject({
      name: 'Draft name',
      description: 'Draft description',
      approvalState: 'accepted',
      startGroup: { id: 'start', name: 'start' },
      steps: [
        { id: 'valid-step', group: { id: 'valid', name: 'Valid' } },
        { id: 'draft-step-1', group: { id: 'other', name: 'Other' } },
      ],
    });

    const malformedProps = createProps({
      currentGroupId: 'current',
      editingWorkflow: { id: 'workflow-2', name: 'Persisted', status: 'pending_approval' } as never,
      draftStartGroupId: '',
      draftName: '   ',
      draftDescription: '   ',
      draftSteps: [
        draftStep({ group_id: '' }),
        draftStep({ id: 'missing-source', group_id: 'valid' }),
        draftStep({ id: 'unreachable', group_id: 'current' }),
      ],
    });
    rerender({ props: malformedProps });
    expect(result.current.invalidTransitionIndexes).toEqual([0, 1, 2]);
    expect(result.current.previewWorkflow).toMatchObject({
      name: 'Persisted',
      description: null,
      startGroup: null,
      approvalState: 'pending',
    });
    expect(result.current.previewWorkflow?.steps[0]?.group).toBeNull();
    expect(result.current.previewWorkflow?.steps[2]?.group).toEqual({
      id: 'current',
      name: 'Current',
    });

    rerender({
      props: createProps({
        currentGroupId: 'start',
        draftStartGroupId: 'start',
        draftName: '   ',
        editingWorkflow: { id: 'workflow-3', name: null, status: null } as never,
        draftSteps: [draftStep({ group_id: 'valid' })],
      }),
    });
    expect(result.current.previewWorkflow?.name).toBe('features.network.workflows.previewTitle');

    rerender({
      props: createProps({
        draftStartGroupId: 'start',
        draftName: 'Incomplete',
        draftSteps: [draftStep({ group_id: '' })],
      }),
    });
    expect(result.current.graphRootGroupId).toBe('current');
  });

  it('handles graph start/target selection and pending-step creation', () => {
    const setDraftStartGroupId = vi.fn();
    const onAddStep = vi.fn();
    const initialProps = createProps({
      isOpen: true,
      setDraftStartGroupId,
      onAddStep,
    });
    const { result, rerender } = renderHook(
      ({ props }: { props: WorkflowEditorProps }) => useWorkflowEditorViewModel(props),
      { initialProps: { props: initialProps } }
    );

    expect(result.current.graphSelectionMode).toBe('start');
    act(() => result.current.handleAddPendingStep());
    expect(onAddStep).not.toHaveBeenCalled();

    act(() => result.current.setPendingTargetGroupId('valid'));
    expect(result.current.pendingHighlightGroupIds).toEqual(['valid']);
    act(() => result.current.handleAddPendingStep());
    expect(onAddStep).not.toHaveBeenCalled();

    act(() => result.current.handleGraphGroupClick('start'));
    expect(setDraftStartGroupId).toHaveBeenCalledWith('start');

    const targetProps = createProps({
      isOpen: true,
      draftStartGroupId: 'start',
      setDraftStartGroupId,
      onAddStep,
    });
    rerender({ props: targetProps });
    expect(result.current.graphSelectionMode).toBe('target');
    expect(result.current.graphRootGroupId).toBe('start');
    expect(result.current.pendingTargetItems).toHaveLength(1);
    act(() => result.current.handleGraphGroupClick('other'));
    expect(result.current.pendingTargetGroupId).toBe('');
    act(() => result.current.handleGraphGroupClick('valid'));
    expect(result.current.pendingTargetGroupId).toBe('valid');
    expect(result.current.pendingHighlightGroupIds).toEqual(['start', 'valid']);
    expect(result.current.isPendingStepValid).toBe(true);
    act(() => result.current.handleAddPendingStep());
    expect(onAddStep).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'valid', step_kind: 'group_vote' })
    );
    expect(result.current.pendingTargetGroupId).toBe('');

    act(() => result.current.setGraphSelectionMode('start'));
    expect(result.current.graphRootGroupId).toBe('current');
  });

  it('coordinates row drag/drop and target edits', () => {
    const onMoveStep = vi.fn();
    const onUpdateStep = vi.fn();
    const props = createProps({
      draftStartGroupId: 'start',
      draftName: 'Workflow',
      draftSteps: [draftStep(), draftStep({ id: 'step-2', group_id: 'other' })],
      onMoveStep,
      onUpdateStep,
    });
    const { result } = renderHook(() => useWorkflowEditorViewModel(props));

    act(() => result.current.handleRowDrop(0));
    expect(onMoveStep).not.toHaveBeenCalled();
    act(() => {
      result.current.setDraggedStepIndex(1);
    });
    act(() => result.current.handleRowDrop(1));
    expect(onMoveStep).not.toHaveBeenCalled();
    act(() => result.current.setDraggedStepIndex(0));
    act(() => result.current.handleRowDrop(1));
    expect(onMoveStep).toHaveBeenCalledWith(0, 1);

    act(() => result.current.handleRowTargetChange(1, 'valid'));
    expect(onUpdateStep).toHaveBeenCalledWith(1, { group_id: 'valid' });
  });
});

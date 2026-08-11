/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useWorkflowStateMock = vi.fn();
const saveWorkflowDefinitionMock = vi.fn();
const deleteWorkflowMock = vi.fn();
const waitForClientApplyMock = vi.fn();
const trackServerFinalizationMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/zero/network/useWorkflowState', () => ({
  useWorkflowState: (...args: unknown[]) => useWorkflowStateMock(...args),
}));

vi.mock('@/zero/network/useWorkflowActions', () => ({
  useWorkflowActions: () => ({
    saveWorkflowDefinition: saveWorkflowDefinitionMock,
    deleteWorkflow: deleteWorkflowMock,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => waitForClientApplyMock(...args),
  trackServerFinalization: (...args: unknown[]) => trackServerFinalizationMock(...args),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

import type { DraftWorkflowStep } from '../useWorkflowEditor';
import { useWorkflowEditor } from '../useWorkflowEditor';

function step(overrides: Partial<DraftWorkflowStep> = {}): DraftWorkflowStep {
  return {
    group_id: 'target',
    label: null,
    step_kind: 'group_vote',
    selection_mode: 'default_target_workflow',
    merge_strategy: null,
    event_rule: null,
    auto_task_on_missing_event: false,
    target_workflow_id: null,
    ...overrides,
  };
}

describe('useWorkflowEditor', () => {
  beforeEach(() => {
    useWorkflowStateMock.mockReset();
    saveWorkflowDefinitionMock.mockReset();
    deleteWorkflowMock.mockReset();
    waitForClientApplyMock.mockReset();
    trackServerFinalizationMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    useWorkflowStateMock.mockReturnValue({
      groupWorkflows: [{ id: 'workflow-list' }],
      groupWorkflowsLoading: false,
      allWorkflows: [{ id: 'all-workflow' }],
    });
    waitForClientApplyMock.mockResolvedValue(undefined);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-id') });
  });

  it('normalizes sorted persisted steps and resets editor state', () => {
    const workflow = {
      id: 'workflow-1',
      start_group_id: null,
      name: null,
      description: null,
      is_default_entry: null,
      steps: [
        {
          id: 'step-merge',
          group_id: 'merge',
          order_index: 2,
          label: 'Merge',
          step_kind: 'merge_vote',
          selection_mode: 'explicit_workflow',
          merge_strategy: 'winner_continues',
          event_rule: 'always',
          auto_task_on_missing_event: true,
          target_workflow_id: 'target-workflow',
        },
        {
          id: 'step-handoff',
          group_id: 'handoff',
          order_index: 0,
          label: null,
          step_kind: 'workflow_handoff',
          selection_mode: 'invalid',
          merge_strategy: 'invalid',
          event_rule: null,
          auto_task_on_missing_event: null,
          target_workflow_id: null,
        },
        {
          id: 'step-default',
          group_id: 'default',
          order_index: 1,
          label: null,
          step_kind: 'unknown',
          selection_mode: null,
          merge_strategy: null,
          event_rule: undefined,
          auto_task_on_missing_event: undefined,
          target_workflow_id: undefined,
        },
      ],
    };
    const { result } = renderHook(() => useWorkflowEditor('group-1'));

    expect(result.current.workflows).toEqual([{ id: 'workflow-list' }]);
    expect(result.current.allWorkflows).toEqual([{ id: 'all-workflow' }]);
    act(() => result.current.openEditWorkflow(workflow as never));
    expect(result.current.isEditorOpen).toBe(true);
    expect(result.current.draftStartGroupId).toBe('');
    expect(result.current.draftName).toBe('');
    expect(result.current.draftDescription).toBe('');
    expect(result.current.draftIsDefaultEntry).toBe(false);
    expect(result.current.draftSteps).toEqual([
      expect.objectContaining({
        id: 'step-handoff',
        step_kind: 'workflow_handoff',
        selection_mode: 'default_target_workflow',
        merge_strategy: null,
        auto_task_on_missing_event: false,
      }),
      expect.objectContaining({ id: 'step-default', step_kind: 'group_vote' }),
      expect.objectContaining({
        id: 'step-merge',
        step_kind: 'merge_vote',
        selection_mode: 'explicit_workflow',
        merge_strategy: 'winner_continues',
        event_rule: 'always',
        auto_task_on_missing_event: true,
        target_workflow_id: 'target-workflow',
      }),
    ]);

    act(() => result.current.closeEditor());
    expect(result.current.isEditorOpen).toBe(false);
    expect(result.current.editingWorkflow).toBeNull();
    act(() => result.current.openNewWorkflow());
    expect(result.current).toMatchObject({
      isEditorOpen: true,
      editingWorkflow: null,
      draftStartGroupId: '',
      draftName: '',
      draftDescription: '',
      draftIsDefaultEntry: false,
      draftSteps: [],
    });
  });

  it('adds, updates, removes, and bounds-checks draft step moves', () => {
    const { result } = renderHook(() => useWorkflowEditor('group-1'));
    act(() => {
      result.current.addDraftStep(step({ group_id: 'one' }));
      result.current.addDraftStep(step({ id: 'existing', group_id: 'two' }));
      result.current.addDraftStep(step({ id: 'third', group_id: 'three' }));
    });
    expect(result.current.draftSteps.map(item => item.id)).toEqual([
      'generated-id',
      'existing',
      'third',
    ]);

    act(() => {
      result.current.updateDraftStep(1, { label: 'Updated' });
      result.current.updateDraftStep(99, { label: 'Ignored' });
    });
    expect(result.current.draftSteps[1]?.label).toBe('Updated');

    for (const [from, to] of [
      [-1, 0],
      [0, -1],
      [3, 0],
      [0, 3],
      [1, 1],
    ]) {
      act(() => result.current.moveDraftStep(from, to));
    }
    act(() => result.current.moveDraftStep(0, 2));
    expect(result.current.draftSteps.map(item => item.group_id)).toEqual(['two', 'three', 'one']);

    act(() => result.current.removeDraftStep(1));
    expect(result.current.draftSteps.map(item => item.group_id)).toEqual(['two', 'one']);
  });

  it('saves new and edited workflows, reports progress, restores drafts, and deletes', async () => {
    const resultValue = { server: Promise.resolve({ type: 'success' }) };
    saveWorkflowDefinitionMock.mockReturnValue(resultValue);
    deleteWorkflowMock.mockReturnValue('delete-result');
    let restoreAction: (() => void) | undefined;
    trackServerFinalizationMock.mockImplementation((_result, options) => {
      options.onError(new Error('server failed'));
      restoreAction = toastErrorMock.mock.calls.at(-1)?.[1]?.action?.onClick;
    });
    const reportProgress = vi.fn();
    const { result } = renderHook(() => useWorkflowEditor('group-1'));

    await act(async () => result.current.saveWorkflow('creator'));
    act(() => result.current.setDraftStartGroupId('start'));
    await act(async () => result.current.saveWorkflow('creator'));

    act(() => {
      result.current.setDraftName('  New workflow  ');
      result.current.setDraftDescription('  Description  ');
      result.current.setDraftIsDefaultEntry(true);
      result.current.addDraftStep(step({ group_id: 'target' }));
    });
    await act(async () => result.current.saveWorkflow('creator'));
    expect(saveWorkflowDefinitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-id',
        editing_group_id: 'group-1',
        start_group_id: 'start',
        name: 'New workflow',
        description: 'Description',
        is_default_entry: true,
        created_by_id: 'creator',
        steps: [expect.objectContaining({ id: 'generated-id', order_index: 0 })],
      })
    );
    expect(trackServerFinalizationMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith('features.network.toasts.workflowSaved');
    expect(restoreAction).toBeTypeOf('function');

    act(() => {
      result.current.closeEditor();
      restoreAction?.();
    });
    expect(result.current.isEditorOpen).toBe(true);
    expect(result.current.draftName).toBe('  New workflow  ');

    act(() =>
      result.current.openEditWorkflow({
        id: 'workflow-existing',
        start_group_id: 'start',
        name: 'Existing',
        description: '',
        is_default_entry: false,
        steps: [
          {
            id: 'existing-step',
            group_id: 'target',
            order_index: 0,
            label: null,
            step_kind: 'group_vote',
            selection_mode: 'default_target_workflow',
            merge_strategy: null,
            event_rule: null,
            auto_task_on_missing_event: false,
            target_workflow_id: null,
          },
        ],
      } as never)
    );
    await act(async () => result.current.saveWorkflow('creator', { reportProgress } as never));
    expect(saveWorkflowDefinitionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'workflow-existing' })
    );
    expect(reportProgress).toHaveBeenCalledWith({ key: 'commit', status: 'complete' });
    expect(reportProgress).toHaveBeenCalledWith({ key: 'sync', status: 'active' });
    expect(trackServerFinalizationMock).toHaveBeenCalledTimes(2);

    await act(async () => result.current.deleteWorkflow('workflow-existing'));
    expect(deleteWorkflowMock).toHaveBeenCalledWith('workflow-existing');
    expect(waitForClientApplyMock).toHaveBeenCalledWith('delete-result');
  });

  it('localizes client-apply failures', async () => {
    const consoleResult = { server: Promise.resolve({ type: 'success' }) };
    saveWorkflowDefinitionMock.mockReturnValue(consoleResult);
    waitForClientApplyMock.mockRejectedValueOnce(new Error('client apply failed'));
    const { result } = renderHook(() => useWorkflowEditor('group-1'));
    act(() => {
      result.current.setDraftStartGroupId('start');
      result.current.addDraftStep(step());
    });
    await act(async () => result.current.saveWorkflow('creator'));
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(String));
    expect(trackServerFinalizationMock).not.toHaveBeenCalled();
  });
});

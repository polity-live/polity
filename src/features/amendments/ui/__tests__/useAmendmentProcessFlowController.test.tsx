/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAmendmentProcessFlowController } from '../useAmendmentProcessFlowController';

let authUser: { id: string } | null = { id: 'user-1' };
const createAmendmentPathMock = vi.fn();
const updateAmendmentMock = vi.fn();
const replanProcessBranchEventsMock = vi.fn();
const submissionResetMock = vi.fn();
const reportTutorialMock = vi.fn();
const runActionWithSubmissionMock = vi.fn(
  async (action: () => Promise<unknown>, options?: { onSuccess?: () => void }) => {
    const result = await action();
    options?.onSuccess?.();
    return result;
  }
);

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    isActive: false,
    status: 'idle',
    progressSteps: [],
    error: null,
    reset: submissionResetMock,
    retry: vi.fn(),
    runActionWithSubmission: runActionWithSubmissionMock,
  }),
}));

vi.mock('@/features/amendments/hooks/useCreateAmendmentPath', () => ({
  useCreateAmendmentPath: () => ({ createAmendmentPath: createAmendmentPathMock }),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    updateAmendment: updateAmendmentMock,
    replanProcessBranchEvents: replanProcessBranchEventsMock,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: vi.fn(),
  waitForClientApply: vi.fn(),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: (...args: unknown[]) => reportTutorialMock(...args),
}));

function step(id: string, branchId: string, order: number) {
  return {
    id,
    branch_id: branchId,
    order_index: order,
    status: 'scheduled',
    decision_status: null,
    event_id: null,
    target_group_id: `${id}-group`,
    target_group: { id: `${id}-group`, name: `${id} group` },
  };
}

function branch(id: string, status = 'scheduled') {
  return {
    id,
    status,
    resolution: null,
    created_at: id === 'branch-1' ? 1 : 2,
    step_runs: [step(`${id}-step`, id, 0)],
    change_requests: [],
  };
}

const amendmentProcess = {
  id: 'amendment-1',
  title: 'Amendment',
  reason: null,
  current_process_run: {
    id: 'run-1',
    status: 'scheduled',
    active_branch_id: 'branch-2',
    selected_target_workflow_id: null,
    selected_target_group_id: 'target-1',
    selected_target_group: { id: 'target-1', name: 'Target' },
    branches: [branch('branch-1'), branch('branch-2')],
    step_runs: [step('branch-1-step', 'branch-1', 0), step('branch-2-step', 'branch-2', 0)],
    tasks: [],
  },
  process_runs: [],
  paths: [],
  group_decisions: [],
};

let amendmentProcessState: any = amendmentProcess;
let collaboratorsState: any[] = [];
let documentsState: any[] = [];
let allEventsState: any[] = [];
let loadingState = false;

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    amendmentProcess: amendmentProcessState,
    collaborators: collaboratorsState,
    documents: documentsState,
    allEvents: allEventsState,
    isLoading: loadingState,
  }),
}));

describe('useAmendmentProcessFlowController branch normalization', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    authUser = { id: 'user-1' };
    amendmentProcessState = amendmentProcess;
    collaboratorsState = [];
    documentsState = [];
    allEventsState = [];
    loadingState = false;
    createAmendmentPathMock.mockReset();
    updateAmendmentMock.mockReset();
    replanProcessBranchEventsMock.mockReset();
    submissionResetMock.mockReset();
    runActionWithSubmissionMock.mockClear();
    reportTutorialMock.mockReset();
    createAmendmentPathMock.mockResolvedValue(undefined);
    updateAmendmentMock.mockReturnValue(undefined);
    replanProcessBranchEventsMock.mockResolvedValue(undefined);
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
    vi.clearAllMocks();
  });

  it('normalizes an invalid requested branch to the resolved active branch with replace', async () => {
    const onBranchChange = vi.fn();

    const { result } = renderHook(() =>
      useAmendmentProcessFlowController({
        amendmentId: 'amendment-1',
        requestedBranchId: 'missing-branch',
        onBranchChange,
      })
    );

    expect(result.current.selectedBranchId).toBe('branch-2');

    await waitFor(() => {
      expect(onBranchChange).toHaveBeenCalledWith('branch-2', { replace: true });
    });
  });

  it('derives rich process, path, collaborator, decision, diff, and event-editor state', async () => {
    const branchOne = {
      id: 'branch-1',
      title: null,
      status: 'active',
      resolution: null,
      created_at: 2,
      document: { content: [{ text: 'branch one' }] },
      change_requests: [{ id: 'cr-1', status: 'open' }],
      step_runs: [
        {
          id: 'step-decided',
          branch_id: 'branch-1',
          order_index: 0,
          status: 'approved',
          target_group_id: 'group-a',
          target_group: { name: 'Group A' },
          event_id: 'event-old',
          event: { id: 'event-old', title: 'Old', start_date: 100, end_date: 200 },
          starts_at: 100,
          workflow_step: { label: 'Decided', target_workflow_id: 'workflow-next' },
        },
        {
          id: 'step-editable',
          branch_id: 'branch-1',
          order_index: 1,
          status: 'scheduled',
          source_group_id: 'group-b',
          source_group: { name: 'Group B' },
          event_id: 'event-old',
          starts_at: 300,
          selection_mode: 'manual',
          merge_strategy: 'winner',
        },
      ],
    };
    const branchTwo = {
      id: 'branch-2',
      title: 'Branch two',
      status: 'completed',
      resolution: 'winner',
      created_at: 1,
      document_version: { content: [{ text: 'branch two' }] },
      step_runs: [{ ...step('step-b', 'branch-2', 0), status: 'completed' }],
      change_requests: [],
    };
    amendmentProcessState = {
      id: 'amendment-1',
      title: null,
      reason: null,
      document_id: 'document-main',
      created_by_id: 'user-1',
      tutorial_run_id: 'tutorial-1',
      current_process_run: {
        id: 'run-current',
        created_at: 2,
        status: 'active',
        active_branch_id: 'branch-1',
        selected_target_workflow_id: 'workflow-1',
        branches: [branchOne, branchTwo],
        step_runs: [
          ...branchOne.step_runs,
          ...branchTwo.step_runs,
          { id: 'unscoped', branch_id: null, order_index: 2, status: 'scheduled' },
        ],
        tasks: [
          {
            id: 'task-open',
            step_run_id: 'step-editable',
            task_type: 'schedule_event',
            status: 'open',
          },
          { id: 'task-scheduled', status: 'scheduled' },
          { id: 'task-done', status: 'completed' },
        ],
      },
      process_runs: [
        { id: 'run-old', created_at: 1 },
        { id: 'run-current', created_at: 2 },
      ],
      paths: [
        {
          id: 'path-old',
          process_run_id: 'run-old',
          created_at: 5,
          segments: [{ order_index: 0, status: 'completed' }],
        },
        {
          id: 'path-current',
          process_run_id: 'run-current',
          created_at: null,
          segments: [
            {
              order_index: null,
              process_branch_id: 'branch-1',
              process_step_run_id: 'step-editable',
              status: 'approved',
            },
            { order_index: 1, process_branch_id: null, status: null },
          ],
        },
      ],
      group_decisions: [
        { id: 'decision-old', decided_at: null, updated_at: 1 },
        { id: 'decision-new', decided_at: 2, updated_at: null },
      ],
    };
    collaboratorsState = [
      { user: { id: 'user-2', first_name: null, last_name: null, email: null, avatar: null } },
      { user: { id: null } },
      { user: null },
    ];
    documentsState = [
      { id: 'document-fallback', content: 'fallback' },
      { id: 'document-main', content: 'original' },
    ];
    allEventsState = [
      { id: 'event-old', title: 'Old', start_date: 100, end_date: null },
      { id: 'event-new', title: 'New', start_date: 400, end_date: 500 },
    ];

    const { result } = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1' })
    );
    expect(result.current.canManageProcess).toBe(true);
    expect(result.current.currentRunPathMode).toBe('workflow');
    expect(result.current.historicalRuns).toHaveLength(1);
    expect(result.current.displayPath?.id).toBe('path-current');
    expect(result.current.openTasks).toHaveLength(2);
    expect(result.current.groupDecisions[0].id).toBe('decision-new');
    expect(result.current.selectorCollaborators).toEqual([
      expect.objectContaining({ id: 'user-2', name: 'User' }),
    ]);
    expect(result.current.branchDiffCandidates.length).toBeGreaterThan(1);

    act(() => result.current.openBranchEventEditor(branchOne));
    expect(result.current.eventEditorBranch?.id).toBe('branch-1');
    expect(result.current.branchEventEditorRows).toHaveLength(2);
    expect(result.current.branchEventEditorRows[0].isDecided).toBe(true);
    act(() => result.current.updateBranchEventDraft('step-editable', 'event-new'));
    await act(async () => result.current.saveBranchEventReplan());
    await waitFor(() => expect(replanProcessBranchEventsMock).toHaveBeenCalled());
    expect(replanProcessBranchEventsMock).toHaveBeenCalledWith({
      branch_id: 'branch-1',
      event_updates: [{ step_run_id: 'step-editable', event_id: 'event-new' }],
    });
  });

  it('covers empty, unauthorized, and initial-process selection paths', async () => {
    authUser = null;
    amendmentProcessState = null;
    collaboratorsState = null as never;
    documentsState = null as never;
    allEventsState = null as never;
    loadingState = true;
    const empty = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1' })
    );
    expect(empty.result.current.canManageProcess).toBe(false);
    expect(empty.result.current.branches).toEqual([]);
    expect(empty.result.current.displayPath).toBeNull();
    act(() => {
      empty.result.current.openBranchEventEditor(null);
      empty.result.current.updateBranchEventDraft('step', 'event');
      empty.result.current.saveBranchEventReplan();
      empty.result.current.handleConfirmSelection();
    });

    authUser = { id: 'user-1' };
    amendmentProcessState = {
      id: 'amendment-1',
      title: null,
      reason: null,
      created_by_id: 'user-1',
      tutorial_run_id: 'tutorial-1',
      current_process_run: null,
      process_runs: null,
      paths: null,
      group_decisions: null,
    };
    const initial = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1' })
    );
    act(() =>
      initial.result.current.setPendingSelection({
        groupId: 'group-target',
        eventId: null,
        sourceGroupId: 'group-source',
        workflowId: null,
        pathMode: 'hierarchy',
        pathWithEvents: [],
        eventData: null,
      } as never)
    );
    await act(async () => initial.result.current.handleConfirmSelection());
    await waitFor(() => expect(createAmendmentPathMock).toHaveBeenCalled());
    expect(updateAmendmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-target', event_id: null })
    );
    expect(reportTutorialMock).toHaveBeenCalled();
  });

  it('covers branch-step fallbacks, path tie-breakers, optional editor fields, and additional paths', async () => {
    const fallbackBranch = {
      id: 'branch-fallback',
      created_at: 1,
      status: null,
      resolution: null,
      step_runs: [
        {
          id: 'fallback-b',
          branch_id: null,
          order_index: 2,
          status: null,
          target_group_id: null,
          source_group_id: null,
          target_group: null,
          source_group: null,
          workflow_step: null,
          event_id: null,
          event: null,
          starts_at: null,
          step_kind: null,
          selection_mode: null,
          merge_strategy: null,
        },
        {
          id: 'fallback-a',
          branch_id: 'branch-fallback',
          order_index: 1,
          status: 'scheduled',
          source_group_id: 'group-1',
          source_group: { name: null },
          workflow_step: { label: null, target_workflow_id: null },
          event_id: 'event-1',
          event: { title: null, start_date: null, end_date: null },
          starts_at: 10,
        },
      ],
      document: { content: 'fallback content' },
      change_requests: [],
    };
    amendmentProcessState = {
      id: 'amendment-1',
      title: 'Title',
      reason: 'Reason',
      created_by_id: 'user-1',
      current_process_run: {
        id: 'run-1',
        created_at: 1,
        active_branch_id: 'branch-fallback',
        selected_target_workflow_id: null,
        branches: [fallbackBranch],
        step_runs: [],
        tasks: [],
      },
      process_runs: null,
      paths: [
        {
          id: 'path-created-old',
          process_run_id: 'other',
          created_at: 1,
          segments: [{ order_index: undefined, status: null }],
        },
        {
          id: 'path-created-new',
          process_run_id: 'other',
          created_at: 2,
          segments: [{ order_index: 1, status: 'completed' }],
        },
      ],
      group_decisions: [
        { id: 'none', decided_at: null, updated_at: null },
        { id: 'updated', decided_at: null, updated_at: 1 },
      ],
    };
    allEventsState = [{ id: 'event-1', title: null, start_date: null, end_date: null }];
    createAmendmentPathMock.mockResolvedValueOnce({
      client: Promise.resolve(),
      server: Promise.resolve(),
    });
    const { result } = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1' })
    );
    expect(result.current.currentRunPathMode).toBe('hierarchy');
    expect(result.current.activeBranchStepRuns.map((item: any) => item.id)).toEqual([
      'fallback-a',
      'fallback-b',
    ]);
    expect(result.current.displayPath?.id).toBe('path-created-new');

    act(() => result.current.openBranchEventEditor(fallbackBranch));
    act(() => result.current.saveBranchEventReplan());
    await waitFor(() => expect(result.current.eventEditorBranch).toBeNull());

    act(() =>
      result.current.setPendingSelection({
        groupId: 'group-target',
        eventId: 'event-1',
        sourceGroupId: 'group-source',
        workflowId: 'workflow-1',
        pathMode: 'workflow',
        pathWithEvents: [],
        eventData: { title: null, start_date: null, end_date: null },
      } as never)
    );
    await act(async () => result.current.handleConfirmSelection());
    await waitFor(() => expect(createAmendmentPathMock).toHaveBeenCalled());
    expect(updateAmendmentMock).not.toHaveBeenCalled();
  });

  it('covers callback guards, comparator fallbacks, and editor data refreshes', async () => {
    const onBranchChange = vi.fn();
    const matchingDerivedBranch = renderHook(() =>
      useAmendmentProcessFlowController({
        amendmentId: 'amendment-1',
        requestedBranchId: 'branch-1',
      })
    );
    expect(matchingDerivedBranch.result.current.firstUnresolvedStepId).toBe('branch-1-step');
    matchingDerivedBranch.unmount();

    const noCallbackBranches = renderHook(() =>
      useAmendmentProcessFlowController({
        amendmentId: 'amendment-1',
        requestedBranchId: 'branch-2',
        onBranchChange,
      })
    );
    await waitFor(() => expect(onBranchChange).not.toHaveBeenCalled());
    noCallbackBranches.unmount();

    amendmentProcessState = {
      ...amendmentProcess,
      current_process_run: { ...amendmentProcess.current_process_run, branches: [] },
    };
    const emptyBranches = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1', onBranchChange })
    );
    expect(emptyBranches.result.current.branches).toEqual([]);
    emptyBranches.unmount();

    amendmentProcessState = amendmentProcess;
    const normalizedNullRequest = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1', onBranchChange })
    );
    await waitFor(() => expect(onBranchChange).toHaveBeenCalledWith('branch-2', { replace: true }));
    normalizedNullRequest.unmount();

    const noGroupStep = {
      id: 'no-group-step',
      branch_id: 'no-group',
      order_index: 0,
      status: 'scheduled',
      target_group_id: null,
      source_group_id: null,
      target_group: null,
      source_group: null,
      workflow_step: null,
      event_id: null,
    };
    const editorSteps = [
      {
        ...noGroupStep,
        id: 'editor-empty',
        branch_id: 'editor',
        order_index: 0,
        starts_at: null,
        event: null,
      },
      {
        ...noGroupStep,
        id: 'editor-old',
        branch_id: 'editor',
        order_index: 1,
        event_id: 'event-old',
        starts_at: 10,
        event: null,
      },
    ];
    const editorBranch = {
      id: 'editor',
      created_at: 3,
      status: 'active',
      resolution: null,
      step_runs: editorSteps,
      change_requests: [],
    };
    amendmentProcessState = {
      id: 'amendment-1',
      title: 'Comparator coverage',
      reason: null,
      created_by_id: 'user-1',
      current_process_run: {
        id: 'run-current',
        created_at: 1,
        active_branch_id: 'no-group',
        selected_target_workflow_id: null,
        branches: [
          {
            id: 'empty-start',
            created_at: 0,
            status: 'active',
            resolution: null,
            step_runs: null,
            change_requests: [],
          },
          {
            id: 'no-group',
            created_at: 1,
            status: 'active',
            resolution: null,
            step_runs: [noGroupStep],
            change_requests: [],
          },
          editorBranch,
        ],
        step_runs: [
          { ...noGroupStep, id: 'null-branch', branch_id: null, order_index: 2 },
          { ...noGroupStep, id: 'z-branch', branch_id: 'z', order_index: 1 },
          noGroupStep,
        ],
        tasks: null,
      },
      process_runs: null,
      paths: [
        {
          id: 'current',
          process_run_id: 'run-current',
          created_at: 0,
          segments: [
            { order_index: 1, process_step_run_id: 'no-group-step', status: null },
            { order_index: null, process_step_run_id: null, status: null },
          ],
        },
        { id: 'other-null', process_run_id: 'other', created_at: 0, segments: null },
        {
          id: 'other-overlap',
          process_run_id: 'other',
          created_at: 0,
          segments: [{ process_step_run_id: 'no-group-step', status: null }],
        },
        {
          id: 'other-terminal',
          process_run_id: 'other',
          created_at: 1,
          segments: [{ process_step_run_id: null, status: 'completed' }],
        },
        {
          id: 'other-created',
          process_run_id: 'other',
          created_at: 2,
          segments: [{ process_step_run_id: null, status: null }],
        },
      ],
      group_decisions: [
        { id: 'zero-a', decided_at: null, updated_at: null },
        { id: 'one', decided_at: null, updated_at: 1 },
        { id: 'zero-b', decided_at: null, updated_at: null },
      ],
    };
    allEventsState = null as never;

    const { result } = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1' })
    );
    expect(result.current.existingBranchStartGroupIds).toEqual([]);
    expect(result.current.firstUnresolvedStepId).toBe('no-group-step');
    expect(result.current.displayPath?.id).toBe('current');

    act(() => result.current.openBranchEventEditor({ id: 'empty-start', step_runs: null }));
    expect(result.current.branchEventEditorRows).toEqual([]);
    act(() => result.current.closeBranchEventEditor());
    act(() => result.current.openBranchEventEditor({ id: null, step_runs: null }));
    expect(result.current.eventEditorBranch).toBeNull();

    act(() => result.current.openBranchEventEditor({ id: 'editor', step_runs: null }));
    expect(result.current.branchEventEditorRows).toHaveLength(2);
    act(() => result.current.updateBranchEventDraft('editor-old', 'event-new'));
    await act(async () => result.current.saveBranchEventReplan());
    await waitFor(() => expect(replanProcessBranchEventsMock).toHaveBeenCalled());
  });
});

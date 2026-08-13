/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runAction: vi.fn(() => Promise.reject(new Error('submission failed'))),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    isActive: false,
    status: 'idle',
    progressSteps: [],
    error: null,
    reset: vi.fn(),
    retry: vi.fn(),
    runActionWithSubmission: mocks.runAction,
  }),
}));
vi.mock('@/features/amendments/hooks/useCreateAmendmentPath', () => ({
  useCreateAmendmentPath: () => ({ createAmendmentPath: vi.fn() }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ updateAmendment: vi.fn(), replanProcessBranchEvents: vi.fn() }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: vi.fn(),
  waitForClientApply: vi.fn(),
}));
vi.mock('@/features/app-tutorial/events', () => ({ reportAppTutorialAction: vi.fn() }));

const branch = vi.hoisted(() => ({
  id: 'branch-1',
  status: 'scheduled',
  resolution: null,
  created_at: 1,
  change_requests: [],
  step_runs: [
    {
      id: 'step-1',
      branch_id: 'branch-1',
      order_index: 0,
      status: 'scheduled',
      decision_status: null,
      event_id: 'event-old',
      event: { id: 'event-old', title: 'Old event', start_date: 100, end_date: 200 },
      starts_at: 100,
      target_group_id: 'group-1',
      target_group: { id: 'group-1', name: 'Group' },
      source_group_id: null,
      source_group: null,
      workflow_step: null,
      step_kind: 'group_vote',
      selection_mode: null,
      merge_strategy: null,
    },
  ],
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    amendmentProcess: {
      id: 'amendment-1',
      title: 'Amendment',
      reason: null,
      created_by_id: 'user-1',
      current_process_run: {
        id: 'run-1',
        status: 'scheduled',
        active_branch_id: 'branch-1',
        selected_target_workflow_id: null,
        selected_target_group_id: 'group-1',
        branches: [branch],
        step_runs: branch.step_runs,
        tasks: [],
      },
      process_runs: [],
      paths: [],
      group_decisions: [],
    },
    collaborators: [],
    documents: [],
    allEvents: [
      { id: 'event-old', title: 'Old event', start_date: 100, end_date: 200 },
      { id: 'event-new', title: 'New event', start_date: 300, end_date: 400 },
    ],
    isLoading: false,
  }),
}));

import { useAmendmentProcessFlowController } from '../useAmendmentProcessFlowController';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useAmendmentProcessFlowController LSF rejection adapters', () => {
  it('reports rejected event replans and path submissions', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useAmendmentProcessFlowController({ amendmentId: 'amendment-1' })
    );

    act(() => result.current.openBranchEventEditor(branch));
    act(() => result.current.updateBranchEventDraft('step-1', 'event-new'));
    act(() => result.current.saveBranchEventReplan());
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Error replanning branch events:',
        expect.any(Error)
      )
    );

    act(() =>
      result.current.setPendingSelection({
        groupId: 'group-1',
        eventId: null,
        sourceGroupId: 'source-1',
        workflowId: null,
        pathMode: 'hierarchy',
        pathWithEvents: [],
        eventData: null,
      } as never)
    );
    act(() => result.current.handleConfirmSelection());
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Error starting amendment process:',
        expect.any(Error)
      )
    );
    expect(mocks.runAction).toHaveBeenCalledTimes(2);
  });
});

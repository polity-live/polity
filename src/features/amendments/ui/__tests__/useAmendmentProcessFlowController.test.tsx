/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAmendmentProcessFlowController } from '../useAmendmentProcessFlowController';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
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
    reset: vi.fn(),
    retry: vi.fn(),
    runActionWithSubmission: vi.fn(),
  }),
}));

vi.mock('@/features/amendments/hooks/useCreateAmendmentPath', () => ({
  useCreateAmendmentPath: () => ({ createAmendmentPath: vi.fn() }),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    updateAmendment: vi.fn(),
    replanProcessBranchEvents: vi.fn(),
  }),
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

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    amendmentProcess,
    collaborators: [],
    documents: [],
    allEvents: [],
    isLoading: false,
  }),
}));

describe('useAmendmentProcessFlowController branch normalization', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
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
});

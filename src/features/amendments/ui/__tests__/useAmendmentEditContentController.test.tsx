/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateAmendment: vi.fn(async () => undefined),
  createAmendment: vi.fn(async () => undefined),
  updateProcessBranch: vi.fn(async () => undefined),
  updateDocument: vi.fn(() => 'update-document-result'),
  waitForClientApply: vi.fn(async (result: unknown) => {
    if (result instanceof Promise) await result;
  }),
  syncEntityHashtags: vi.fn(async () => undefined),
  toastError: vi.fn(),
  documentEditingMode: 'edit' as string | null,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => hookMocks.navigate,
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    updateAmendment: hookMocks.updateAmendment,
    createAmendment: hookMocks.createAmendment,
    updateProcessBranch: hookMocks.updateProcessBranch,
  }),
}));

vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({
    updateDocument: hookMocks.updateDocument,
  }),
}));

vi.mock('@/zero/documents/useDocumentState', () => ({
  useDocumentState: () => ({
    document: {
      id: 'document-1',
      editing_mode: hookMocks.documentEditingMode,
    },
  }),
}));

vi.mock('@/zero/common', () => ({
  useCommonState: () => ({
    amendmentHashtags: [],
    allHashtags: [],
  }),
  useCommonActions: () => ({
    syncEntityHashtags: hookMocks.syncEntityHashtags,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => hookMocks.waitForClientApply(result),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (
    key: string,
    paramsOrFallback?: string | Record<string, unknown>,
    fallback?: string
  ) => (typeof paramsOrFallback === 'string' ? paramsOrFallback : (fallback ?? key)),
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) =>
      typeof paramsOrFallback === 'string' ? paramsOrFallback : (fallback ?? key),
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: (...args: unknown[]) => hookMocks.toastError(...args),
    success: vi.fn(),
  },
}));

vi.mock('@/features/timeline/utils/createTimelineEvent', () => ({
  createTimelineEvent: vi.fn(async () => undefined),
}));

import { useAmendmentEditContentController } from '../useAmendmentEditContentController';

const amendment = {
  id: 'amendment-1',
  title: 'A1',
  code: 'A-1',
  image_url: null,
  video_url: null,
  internal_cr_voting_close_trigger: 'all_collaborators_voted',
  internal_cr_voting_duration_minutes: null,
  internal_cr_resolution_visibility: 'public',
  visibility: 'public',
  document_id: 'document-1',
  tags: [],
};

function buildProcess(branchMode = 'suggest_internal') {
  return {
    current_process_run: {
      active_branch_id: 'branch-b',
      branches: [
        {
          id: 'branch-a',
          title: 'Branch A',
          editing_mode: 'edit',
          status: 'scheduled',
          resolution: null,
          created_at: 1,
          step_runs: [],
        },
        {
          id: 'branch-b',
          title: 'Branch B',
          editing_mode: branchMode,
          status: 'scheduled',
          resolution: null,
          created_at: 2,
          step_runs: [],
        },
      ],
    },
  };
}

afterEach(() => {
  cleanup();
  hookMocks.documentEditingMode = 'edit';
  Object.values(hookMocks).forEach(value => {
    const maybeMock = value as { mockClear?: () => void };
    maybeMock.mockClear?.();
  });
});

describe('useAmendmentEditContentController', () => {
  it('keeps a pending branch mode change visible during amendment refreshes', async () => {
    let resolveBranchUpdate: (() => void) | undefined;
    hookMocks.updateProcessBranch.mockImplementationOnce(
      () =>
        new Promise<undefined>(resolve => {
          resolveBranchUpdate = () => resolve(undefined);
        })
    );

    const initialProps = {
      amendmentId: 'amendment-1',
      amendment,
      amendmentProcess: buildProcess(),
      currentUserId: 'user-1',
      isLoading: false,
      mode: 'edit' as const,
    };

    const { result, rerender } = renderHook(props => useAmendmentEditContentController(props), {
      initialProps: initialProps as any,
    });

    await waitFor(() => {
      expect(result.current.selectedWorkflowBranchId).toBe('branch-b');
      expect(result.current.formData.workflowStatus).toBe('suggest_internal');
    });

    let changePromise: Promise<void> = Promise.resolve();
    await act(async () => {
      changePromise = result.current.handleWorkflowStatusChange('vote_internal');
      await Promise.resolve();
    });

    expect(result.current.formData.workflowStatus).toBe('vote_internal');

    rerender({
      ...initialProps,
      amendment: {
        ...amendment,
        code: 'A-1-refresh',
      },
    });

    expect(result.current.formData.workflowStatus).toBe('vote_internal');

    await act(async () => {
      resolveBranchUpdate?.();
      await changePromise;
    });

    expect(hookMocks.updateProcessBranch).toHaveBeenCalledWith({
      id: 'branch-b',
      editing_mode: 'vote_internal',
    });
    expect(hookMocks.updateDocument).not.toHaveBeenCalled();
  });

  it('persists workflow status to the amendment document when no branch exists yet', async () => {
    hookMocks.documentEditingMode = 'suggest_internal';
    const initialProps = {
      amendmentId: 'amendment-1',
      amendment,
      amendmentProcess: {
        current_process_run: {
          active_branch_id: null,
          branches: [],
        },
      },
      currentUserId: 'user-1',
      isLoading: false,
      mode: 'edit' as const,
    };

    const { result } = renderHook(props => useAmendmentEditContentController(props), {
      initialProps: initialProps as any,
    });

    await waitFor(() => {
      expect(result.current.selectedWorkflowBranchId).toBe(null);
      expect(result.current.formData.workflowStatus).toBe('suggest_internal');
    });

    await act(async () => {
      await result.current.handleWorkflowStatusChange('vote_internal');
    });

    expect(result.current.formData.workflowStatus).toBe('vote_internal');
    expect(hookMocks.updateProcessBranch).not.toHaveBeenCalled();
    expect(hookMocks.updateDocument).toHaveBeenCalledWith({
      id: 'document-1',
      editing_mode: 'vote_internal',
    });
    expect(hookMocks.waitForClientApply).toHaveBeenCalledWith('update-document-result');
  });
});

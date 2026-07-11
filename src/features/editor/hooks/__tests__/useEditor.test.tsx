/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => ({
  zeroMutate: vi.fn((mutation: unknown) => mutation),
  updateDocumentContent: vi.fn((args: unknown) => ({
    type: 'documents.updateContent',
    args,
  })),
  updateProcessBranch: vi.fn((args: unknown) => ({
    type: 'amendments.updateProcessBranch',
    args,
  })),
  updateAmendment: vi.fn((args: unknown) => ({
    type: 'amendments.update',
    args,
  })),
  updateBlog: vi.fn((args: unknown) => ({
    type: 'blogs.update',
    args,
  })),
  waitForClientApply: vi.fn(async (result: unknown) => {
    void result;
  }),
  trackServerFinalization: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  broadcastContent: vi.fn(),
  amendmentDocsCollabs: {
    id: 'amendment-1',
    title: 'Amendment 1',
    created_by_id: 'user-1',
    discussions: [],
    change_requests: [],
    current_process_run: null,
    collaborators: [],
    document: {
      id: 'document-1',
      title: 'Amendment 1',
      content: [{ type: 'p', children: [{ text: 'Text' }] }],
      editing_mode: 'vote_internal',
      visibility: 'public',
      collaborators: [],
      updated_at: 1,
    },
  } as any,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({
    mutate: hookMocks.zeroMutate,
  }),
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    amendments: {
      update: hookMocks.updateAmendment,
      updateProcessBranch: hookMocks.updateProcessBranch,
    },
    blogs: {
      update: hookMocks.updateBlog,
    },
    documents: {
      updateContent: hookMocks.updateDocumentContent,
      updateGroupDocumentTitle: vi.fn(),
    },
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => hookMocks.waitForClientApply(result),
  trackServerFinalization: (...args: unknown[]) => hookMocks.trackServerFinalization(...args),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    isLoading: false,
    amendmentDocsCollabs: hookMocks.amendmentDocsCollabs,
  }),
}));

vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({
    blogForEditor: null,
    isLoading: false,
  }),
}));

vi.mock('@/zero/documents/useDocumentState', () => ({
  useDocumentState: () => ({
    document: null,
    isLoading: false,
  }),
}));

vi.mock('../useRealtimeSync', () => ({
  useRealtimeSync: () => ({
    broadcastContent: hookMocks.broadcastContent,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    success: (...args: unknown[]) => hookMocks.toastSuccess(...args),
    error: (...args: unknown[]) => hookMocks.toastError(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { useEditor } from '../useEditor';

beforeEach(() => {
  hookMocks.amendmentDocsCollabs = {
    ...hookMocks.amendmentDocsCollabs,
    change_requests: [],
    document: {
      id: 'document-1',
      title: 'Amendment 1',
      content: [{ type: 'p', children: [{ text: 'Text' }] }],
      editing_mode: 'vote_internal',
      visibility: 'public',
      collaborators: [],
      updated_at: 1,
    },
  };
});

afterEach(() => {
  Object.values(hookMocks).forEach(value => {
    if (vi.isMockFunction(value)) value.mockClear();
  });
});

describe('useEditor', () => {
  it('persists amendment mode changes to the document when no process branch exists', async () => {
    const { result } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );

    await waitFor(() => {
      expect(result.current.mode).toBe('vote_internal');
    });

    await act(async () => {
      await result.current.setMode('suggest_internal');
    });

    expect(hookMocks.updateDocumentContent).toHaveBeenCalledWith({
      id: 'document-1',
      editing_mode: 'suggest_internal',
    });
    expect(hookMocks.updateProcessBranch).not.toHaveBeenCalled();
    expect(hookMocks.waitForClientApply).toHaveBeenCalledWith({
      type: 'documents.updateContent',
      args: {
        id: 'document-1',
        editing_mode: 'suggest_internal',
      },
    });
  });

  it('adopts canonical remote content in internal voting even with an older timestamp', async () => {
    const { result, rerender } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(result.current.content[0]).toMatchObject({ type: 'p' }));

    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        content: [{ type: 'p', children: [{ text: 'Canonical accepted text' }] }],
        // A local save can make lastRemoteUpdate newer than this authoritative row timestamp.
        updated_at: 0,
      },
    };
    rerender();

    await waitFor(() =>
      expect(JSON.stringify(result.current.content)).toContain('Canonical accepted text')
    );
  });
});

/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  flushProjectEditor,
  useProjectTextSelection,
} from '@/features/project-chat/hooks/editor-bridge';
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
  reportAppTutorialAction: vi.fn(),
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
  serverConfirmed: (result: unknown) => hookMocks.waitForClientApply(result),
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

vi.mock('@/features/app-tutorial/events', () => ({
  APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION: 'avatar-menu.opened',
  reportAppTutorialAction: (...args: unknown[]) => hookMocks.reportAppTutorialAction(...args),
}));

import { useEditor } from '../useEditor';

beforeEach(() => {
  hookMocks.waitForClientApply.mockReset().mockResolvedValue(undefined);
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
  cleanup();
  Object.values(hookMocks).forEach(value => {
    if (vi.isMockFunction(value)) value.mockClear();
  });
});

describe('useEditor', () => {
  const bridgeScope = { kind: 'amendment' as const, amendmentId: 'amendment-1' };
  const edited = (text: string) => [{ type: 'p', children: [{ text }] }];
  function renderEditableAmendment() {
    hookMocks.amendmentDocsCollabs.document.editing_mode = 'edit';
    return renderHook(() =>
      useEditor({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' })
    );
  }

  it('publishes the persisted revision and the latest text selection before an amendment AI request', async () => {
    hookMocks.amendmentDocsCollabs.document.content_revision = 7;
    const selection = { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 3 } };
    renderHook(() => useProjectTextSelection('document-1', () => selection));
    const hook = renderEditableAmendment();
    await waitFor(() => expect(hook.result.current.mode).toBe('edit'));
    await expect(
      flushProjectEditor(bridgeScope, { surface: 'amendment_text' })
    ).resolves.toMatchObject({ documentId: 'document-1', contentRevision: 7, selection });
    expect(hookMocks.updateDocumentContent).not.toHaveBeenCalled();
  });

  it('serializes overlapping confirmed saves and advances the revision only after each acceptance', async () => {
    let completeFirst!: () => void;
    const first = new Promise<void>(resolve => {
      completeFirst = resolve;
    });
    hookMocks.waitForClientApply.mockImplementationOnce(() => first);
    const hook = renderEditableAmendment();
    await waitFor(() => expect(hook.result.current.mode).toBe('edit'));
    act(() => hook.result.current.setContent(edited('First edit')));
    act(() => hook.result.current.setContent(edited('Second edit')));
    expect(hookMocks.updateDocumentContent).toHaveBeenCalledTimes(1);
    await act(async () => {
      completeFirst();
      await first;
    });
    await waitFor(() => expect(hook.result.current.saveStatus).toBe('saved'));
    expect(
      hookMocks.updateDocumentContent.mock.calls.map(
        ([args]) => (args as { expected_content_revision: number }).expected_content_revision
      )
    ).toEqual([0, 1]);
    await expect(
      flushProjectEditor(bridgeScope, { surface: 'amendment_text' })
    ).resolves.toMatchObject({ contentRevision: 2 });
    expect(hook.result.current.hasUnsavedChanges).toBe(false);
  });

  it('flushes a throttled trailing edit immediately and cancels its delayed duplicate save', async () => {
    const hook = renderEditableAmendment();
    await waitFor(() => expect(hook.result.current.mode).toBe('edit'));
    act(() => hook.result.current.setContent(edited('First edit')));
    await waitFor(() => expect(hook.result.current.saveStatus).toBe('saved'));
    act(() => hook.result.current.setContent(edited('Second edit')));
    expect(hook.result.current.hasUnsavedChanges).toBe(true);
    let context;
    await act(async () => {
      context = await flushProjectEditor(bridgeScope, { surface: 'amendment_text' });
    });
    expect(context).toMatchObject({ contentRevision: 2 });
    expect(hookMocks.updateDocumentContent).toHaveBeenCalledTimes(2);
    expect(hook.result.current.hasUnsavedChanges).toBe(false);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });
    expect(hookMocks.updateDocumentContent).toHaveBeenCalledTimes(2);
  });

  it('waits for an in-flight server confirmation before releasing the editor context', async () => {
    let complete!: () => void;
    const accepted = new Promise<void>(resolve => {
      complete = resolve;
    });
    hookMocks.waitForClientApply.mockImplementationOnce(() => accepted);
    const hook = renderEditableAmendment();
    await waitFor(() => expect(hook.result.current.mode).toBe('edit'));
    act(() => hook.result.current.setContent(edited('Confirmed edit')));
    let released = false;
    let flush!: Promise<unknown>;
    act(() => {
      flush = flushProjectEditor(bridgeScope, { surface: 'amendment_text' }).then(value => {
        released = true;
        return value;
      });
    });
    expect(released).toBe(false);
    await act(async () => {
      complete();
      expect(await flush).toMatchObject({ contentRevision: 1 });
    });
    expect(released).toBe(true);
  });

  it('keeps the new document revision when an older document save completes after a context switch', async () => {
    let complete!: () => void;
    const accepted = new Promise<void>(resolve => {
      complete = resolve;
    });
    hookMocks.waitForClientApply.mockImplementationOnce(() => accepted);
    const hook = renderEditableAmendment();
    await waitFor(() => expect(hook.result.current.mode).toBe('edit'));
    act(() => hook.result.current.setContent(edited('Old document edit')));
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        id: 'new-document',
        content_revision: 12,
        content: edited('New document'),
      },
    };
    hook.rerender();
    await act(async () => {
      complete();
      await accepted;
    });
    await expect(
      flushProjectEditor(bridgeScope, { surface: 'amendment_text' })
    ).resolves.toMatchObject({ documentId: 'new-document', contentRevision: 12 });
  });

  it('propagates rejected dirty flushes and allows a later confirmed retry to start the AI', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      hookMocks.waitForClientApply.mockRejectedValueOnce(new Error('First rejection'));
      const hook = renderEditableAmendment();
      await waitFor(() => expect(hook.result.current.mode).toBe('edit'));
      act(() => hook.result.current.setContent(edited('Retry this edit')));
      await waitFor(() => expect(hook.result.current.saveStatus).toBe('error'));
      hookMocks.waitForClientApply.mockRejectedValueOnce(new Error('Retry rejection'));
      await act(async () => {
        await expect(
          flushProjectEditor(bridgeScope, { surface: 'amendment_text' })
        ).rejects.toThrow('Retry rejection');
      });
      expect(hook.result.current.hasUnsavedChanges).toBe(true);
      await act(async () => {
        await expect(
          flushProjectEditor(bridgeScope, { surface: 'amendment_text' })
        ).resolves.toMatchObject({ contentRevision: 1 });
      });
      expect(hook.result.current.saveStatus).toBe('saved');
      expect(hook.result.current.hasUnsavedChanges).toBe(false);
    } finally {
      errors.mockRestore();
    }
  });
  it('keeps a valid amendment editor loading while its Zero document is hydrating', () => {
    const hydratedAmendment = hookMocks.amendmentDocsCollabs;
    hookMocks.amendmentDocsCollabs = null;
    const { result, rerender } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );

    expect(result.current.isLoading).toBe(true);

    hookMocks.amendmentDocsCollabs = hydratedAmendment;
    rerender();
    expect(result.current.isLoading).toBe(false);
  });

  it('enables orphaned change-request reconciliation for normal collaborative amendment saves', async () => {
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        editing_mode: 'edit',
      },
    };
    const { result } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );
    const updatedContent = [{ type: 'p', children: [{ text: 'Collaborative edit' }] }] as any;

    await waitFor(() => expect(result.current.mode).toBe('edit'));
    act(() => result.current.setContent(updatedContent));

    await waitFor(() =>
      expect(hookMocks.updateDocumentContent).toHaveBeenCalledWith({
        id: 'document-1',
        expected_content_revision: 0,
        content: updatedContent,
        reconcile_orphaned_change_requests: true,
      })
    );
  });

  it.each([
    'Zusätzliche entsiegelte Flächen verbessern die Versickerung bei Starkregen.',
    'Additional unsealed areas improve infiltration during heavy rainfall.',
  ])('recognizes the localized tutorial amendment text immediately: %s', async requiredText => {
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        editing_mode: 'edit',
      },
    };
    const { result } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );
    const updatedContent = [
      { type: 'p', children: [{ text: `Existing text ${requiredText}` }] },
    ] as any;

    await waitFor(() => expect(result.current.mode).toBe('edit'));
    act(() => result.current.setContent(updatedContent));

    expect(result.current.getLatestContent()).toBe(updatedContent);
    expect(hookMocks.reportAppTutorialAction).toHaveBeenCalledWith({
      type: 'input',
      value: requiredText,
    });
  });

  it('does not enable orphan reconciliation when restoring a version in collaborative mode', async () => {
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        editing_mode: 'edit',
      },
    };
    const { result } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );
    const restoredContent = [{ type: 'p', children: [{ text: 'Restored' }] }] as any;

    await act(async () => {
      await result.current.restoreVersion(restoredContent);
    });

    expect(hookMocks.updateDocumentContent).toHaveBeenCalledWith({
      id: 'document-1',
      content: restoredContent,
    });
    expect(hookMocks.updateDocumentContent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        reconcile_orphaned_change_requests: expect.anything(),
      })
    );
  });

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

  it('does not publish a local save echo back through the controlled content value', async () => {
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        editing_mode: 'suggest_event',
      },
    };
    const { result, rerender } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(JSON.stringify(result.current.content)).toContain('Text'));
    const controlledValueBeforeEdit = result.current.content;
    const localContent = [{ type: 'p', children: [{ text: 'TextX' }] }] as any;

    act(() => result.current.setContent(localContent));
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        content: localContent,
        updated_at: 2,
      },
    };
    rerender();

    await waitFor(() => expect(hookMocks.updateDocumentContent).toHaveBeenCalled());
    expect(result.current.content).toBe(controlledValueBeforeEdit);
  });

  it('keeps the controlled content value stable when only CR metadata changes', async () => {
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        editing_mode: 'suggest_event',
      },
    };
    const { result, rerender } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(JSON.stringify(result.current.content)).toContain('Text'));
    const controlledValue = result.current.content;

    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      change_requests: [{ id: 'cr-1', status: 'open', suggestion_id: 'suggestion-1' }],
    };
    rerender();

    expect(result.current.content).toBe(controlledValue);
  });

  it('adopts genuinely different remote content outside voting modes', async () => {
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        editing_mode: 'suggest_event',
      },
    };
    const { result, rerender } = renderHook(() =>
      useEditor({
        entityType: 'amendment',
        entityId: 'amendment-1',
        userId: 'user-1',
      })
    );

    await waitFor(() => expect(JSON.stringify(result.current.content)).toContain('Text'));
    hookMocks.amendmentDocsCollabs = {
      ...hookMocks.amendmentDocsCollabs,
      document: {
        ...hookMocks.amendmentDocsCollabs.document,
        content: [{ type: 'p', children: [{ text: 'Remote collaborator text' }] }],
        updated_at: Date.now() + 1000,
      },
    };
    rerender();

    await waitFor(() =>
      expect(JSON.stringify(result.current.content)).toContain('Remote collaborator text')
    );
  });
});

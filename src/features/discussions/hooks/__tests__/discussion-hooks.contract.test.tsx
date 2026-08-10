/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateThreadDialogController } from '../useCreateThreadDialogController';
import { useDiscussionMutations } from '../useDiscussionMutations';
import { normalizeDiscussionThread, useDiscussions } from '../useDiscussions';

const mocks = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  isUploading: false,
  createThread: vi.fn(),
  addComment: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  amendmentResponses: [] as any[],
}));

vi.mock('@/features/file-upload/hooks/use-upload-file.ts', () => ({
  useUploadFile: () => ({ uploadFile: mocks.uploadFile, isUploading: mocks.isUploading }),
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({ createThread: mocks.createThread, addComment: mocks.addComment }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => mocks.amendmentResponses.shift() ?? {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.uploadFile.mockResolvedValue({ key: 'file-1' });
  mocks.createThread.mockResolvedValue(undefined);
  mocks.addComment.mockResolvedValue(undefined);
  mocks.amendmentResponses = [];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('discussion hooks', () => {
  it('uploads an optional attachment, creates a thread, and resets successful dialog state', async () => {
    const onOpenChange = vi.fn();
    const onCreateThread = vi.fn(async () => 'thread-1');
    const { result } = renderHook(() =>
      useCreateThreadDialogController({
        amendmentId: 'amendment-1',
        userId: 'user-1',
        onOpenChange,
        onCreateThread,
      })
    );
    const file = new File(['policy'], 'policy.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.onTitleChange('Title');
      result.current.onDescriptionChange('Description');
      result.current.onFileChange(file);
    });
    await act(async () => result.current.onSubmit());
    expect(mocks.uploadFile).toHaveBeenCalledWith(file);
    expect(onCreateThread).toHaveBeenCalledWith(
      'amendment-1',
      'Title',
      'Description',
      'user-1',
      'file-1'
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current).toMatchObject({
      title: '',
      description: '',
      selectedFile: null,
      isSubmitting: false,
    });
    act(() => result.current.onRemoveFile());
    expect(result.current.selectedFile).toBeNull();
  });

  it('continues without a failed upload, reports create failures, and guards invalid submissions', async () => {
    mocks.uploadFile.mockRejectedValueOnce(new Error('upload failed'));
    const onCreateThread = vi.fn(async () => 'thread-1');
    const { result } = renderHook(() =>
      useCreateThreadDialogController({
        amendmentId: 'amendment-1',
        userId: 'user-1',
        onOpenChange: vi.fn(),
        onCreateThread,
      })
    );
    act(() => {
      result.current.onTitleChange('Title');
      result.current.onFileChange(new File(['x'], 'x.txt'));
    });
    await act(async () => result.current.onSubmit());
    expect(onCreateThread).toHaveBeenCalledWith('amendment-1', 'Title', '', 'user-1', undefined);
    expect(console.error).toHaveBeenCalledWith('Error uploading file:', expect.any(Error));

    onCreateThread.mockRejectedValueOnce(new Error('create failed'));
    act(() => result.current.onTitleChange('Again'));
    await act(async () => result.current.onSubmit());
    expect(result.current.isSubmitting).toBe(false);
  });

  it('ignores blank and anonymous submissions and tolerates uploads without a storage key', async () => {
    const onCreateThread = vi.fn(async () => 'thread-1');
    const { result, rerender } = renderHook(
      ({ userId }) =>
        useCreateThreadDialogController({
          amendmentId: 'amendment-1',
          userId,
          onOpenChange: vi.fn(),
          onCreateThread,
        }),
      { initialProps: { userId: 'user-1' as string | undefined } }
    );

    await act(async () => result.current.onSubmit());
    expect(onCreateThread).not.toHaveBeenCalled();
    act(() => result.current.onTitleChange('Title'));
    rerender({ userId: undefined });
    await act(async () => result.current.onSubmit());
    expect(onCreateThread).not.toHaveBeenCalled();

    mocks.uploadFile.mockResolvedValueOnce(undefined);
    act(() => result.current.onFileChange(new File(['x'], 'x.txt')));
    rerender({ userId: 'user-1' });
    await act(async () => result.current.onSubmit());
    expect(onCreateThread).toHaveBeenCalledWith('amendment-1', 'Title', '', 'user-1', undefined);
  });

  it('constructs canonical thread and comment mutations including optional document and parent links', async () => {
    const { result } = renderHook(() => useDiscussionMutations());
    const threadId = await act(async () =>
      result.current.createThread('amendment-1', 'Title', 'Description', 'user-1', 'file-1')
    );
    expect(threadId).toEqual(expect.any(String));
    expect(mocks.createThread).toHaveBeenCalledWith(
      expect.objectContaining({
        id: threadId,
        amendment_id: 'amendment-1',
        document_id: 'file-1',
        user_id: 'user-1',
        content: 'Title\n\nDescription',
        status: 'open',
      })
    );
    const commentId = await act(async () =>
      result.current.createComment(threadId, 'Reply', 'user-1', 'parent-1')
    );
    expect(mocks.addComment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: commentId,
        thread_id: threadId,
        parent_id: 'parent-1',
        content: 'Reply',
      })
    );
  });

  it('constructs minimal thread and root-comment mutations without optional values', async () => {
    const { result } = renderHook(() => useDiscussionMutations());

    await act(async () => result.current.createThread('amendment-1', 'Title', '', 'user-1'));
    expect(mocks.createThread).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: 'Title', document_id: null })
    );

    await act(async () => result.current.createComment('thread-1', 'Root', 'user-1'));
    expect(mocks.addComment).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: 'Root', parent_id: null })
    );
  });

  it('normalizes nested sorting and exposes loading, pagination, and load-more state', () => {
    const comments: any[] = [
      { id: 'low', parent_id: null, upvotes: 1, downvotes: 0, created_at: 20 },
      { id: 'high', parent_id: null, upvotes: 5, downvotes: 0, created_at: 10 },
      { id: 'reply', parent_id: 'high', upvotes: 2, downvotes: 0, created_at: 30 },
    ];
    const rawThread: any = { id: 'thread-1', comments };
    expect(
      normalizeDiscussionThread(rawThread, 'votes').comments.map(comment => comment.id)
    ).toEqual(['high', 'low']);
    mocks.amendmentResponses = [
      { amendment: { id: 'amendment-1' }, isLoading: false },
      {
        threads: Array.from({ length: 10 }, (_, index) => ({
          ...rawThread,
          id: `thread-${index}`,
        })),
        isLoading: true,
      },
    ];
    const { result, rerender } = renderHook(() => useDiscussions('amendment-1', 'time'));
    expect(result.current).toMatchObject({
      amendment: { id: 'amendment-1' },
      isLoading: true,
      hasMore: true,
    });
    act(() => result.current.loadMore());
    mocks.amendmentResponses = [
      { amendment: { id: 'amendment-1' }, isLoading: false },
      { threads: [], isLoading: false },
    ];
    rerender();
    expect(result.current.hasMore).toBe(false);
  });

  it('normalizes absent comments and absent thread results without mutating query data', () => {
    const rawThread: any = { id: 'thread-1', comments: undefined };
    expect(normalizeDiscussionThread(rawThread, 'time')).toEqual({
      id: 'thread-1',
      comments: [],
    });

    mocks.amendmentResponses = [
      { amendment: undefined, isLoading: true },
      { threads: undefined, isLoading: false },
    ];
    const { result } = renderHook(() => useDiscussions('amendment-1'));
    expect(result.current).toMatchObject({
      amendment: undefined,
      threads: [],
      isLoading: true,
      hasMore: false,
    });
  });
});

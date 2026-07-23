import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { toMutableJSONValue } from '../../shared/helpers';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { documentSharedMutators } from '../shared-mutators';

type DocumentMutatorInput = Parameters<typeof documentSharedMutators.create.fn>[0];
type DocumentMutatorTx = DocumentMutatorInput['tx'];
type DocumentMutatorCtx = DocumentMutatorInput['ctx'];

function createTx(location: DocumentMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      document: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      document_version: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      document_collaborator: {
        insert: vi.fn(),
      },
      thread: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      comment: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      thread_vote: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      comment_vote: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      amendment: {
        update: vi.fn(),
      },
    },
  };
}

function createCtx(): DocumentMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('documentSharedMutators group RBAC', () => {
  it('allows any authenticated viewer to create a thread on a public statement', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({
      id: 'statement-1',
      user_id: 'author-1',
      visibility: 'public',
      expires_at: null,
    });

    await documentSharedMutators.createThread.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'thread-1',
        statement_id: 'statement-1',
        amendment_id: null,
        document_id: null,
        blog_id: null,
        todo_id: null,
        user_id: 'user-1',
        content: null,
        status: 'open',
        resolved_at: 0,
        position: 0,
        upvotes: 0,
        downvotes: 0,
      },
    });

    expect(tx.mutate.thread.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'thread-1', user_id: 'user-1' })
    );
  });

  it('allows any authenticated viewer to create a thread on a public amendment', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({
      id: 'amendment-1',
      created_by_id: 'author-1',
      visibility: 'public',
    });

    await documentSharedMutators.createThread.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'thread-1',
        statement_id: null,
        amendment_id: 'amendment-1',
        document_id: null,
        blog_id: null,
        todo_id: null,
        user_id: 'user-1',
        content: 'A discussion',
        status: 'open',
        resolved_at: 0,
        position: 0,
        upvotes: 0,
        downvotes: 0,
      },
    });

    expect(canMock).not.toHaveBeenCalled();
    expect(tx.mutate.thread.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'thread-1', user_id: 'user-1' })
    );
  });

  it('allows an active group member to comment on a private statement', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ id: 'thread-1', statement_id: 'statement-1' })
      .mockResolvedValueOnce({
        id: 'statement-1',
        user_id: 'author-1',
        group_id: 'group-1',
        visibility: 'private',
        expires_at: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'membership-1', status: 'active' })
      .mockResolvedValueOnce(null);

    await documentSharedMutators.addComment.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'comment-1',
        thread_id: 'thread-1',
        user_id: 'user-1',
        parent_id: null,
        content: 'Member feedback',
        upvotes: 0,
        downvotes: 0,
      },
    });

    expect(tx.mutate.comment.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'comment-1', user_id: 'user-1' })
    );
  });

  it('rejects an unrelated authenticated user on a private statement', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ id: 'thread-1', statement_id: 'statement-1' })
      .mockResolvedValueOnce({
        id: 'statement-1',
        user_id: 'author-1',
        group_id: 'group-1',
        visibility: 'private',
        expires_at: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      documentSharedMutators.addComment.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'comment-1',
          thread_id: 'thread-1',
          user_id: 'user-1',
          parent_id: null,
          content: 'Should be denied',
          upvotes: 0,
          downvotes: 0,
        },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    expect(tx.mutate.comment.insert).not.toHaveBeenCalled();
  });

  it('allows an authenticated viewer to vote on a public statement comment', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ id: 'comment-1', thread_id: 'thread-1' })
      .mockResolvedValueOnce({ id: 'thread-1', statement_id: 'statement-1' })
      .mockResolvedValueOnce({
        id: 'statement-1',
        user_id: 'author-1',
        visibility: 'public',
        expires_at: null,
      });

    await documentSharedMutators.voteComment.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'vote-1',
        comment_id: 'comment-1',
        user_id: 'user-1',
        vote: 1,
      },
    });

    expect(tx.mutate.comment_vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vote-1', user_id: 'user-1' })
    );
  });

  it('rejects anonymous thread creation even on public blogs', async () => {
    const tx = createTx('server');

    await expect(
      documentSharedMutators.createThread.fn({
        tx: tx as never,
        ctx: { ...createCtx(), userID: 'anon' },
        args: {
          id: 'thread-1',
          statement_id: null,
          amendment_id: null,
          document_id: null,
          blog_id: 'blog-1',
          todo_id: null,
          user_id: 'anon',
          content: null,
          status: 'open',
          resolved_at: 0,
          position: 0,
          upvotes: 0,
          downvotes: 0,
        },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.thread.insert).not.toHaveBeenCalled();
  });

  it('allows an authenticated todo viewer to add a comment', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ id: 'thread-1', todo_id: 'todo-1' })
      .mockResolvedValueOnce({ id: 'todo-1', creator_id: 'user-2' });

    await documentSharedMutators.addComment.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'comment-1',
        thread_id: 'thread-1',
        user_id: 'user-1',
        parent_id: null,
        content: 'Looks good',
        upvotes: 0,
        downvotes: 0,
      },
    });

    expect(tx.mutate.comment.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'comment-1', user_id: 'user-1' })
    );
  });

  it('rejects anonymous comments on public todo threads', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({ id: 'thread-1', todo_id: 'todo-1' });

    await expect(
      documentSharedMutators.addComment.fn({
        tx: tx as never,
        ctx: { ...createCtx(), userID: 'anon' },
        args: {
          id: 'comment-1',
          thread_id: 'thread-1',
          user_id: 'anon',
          parent_id: null,
          content: 'Anonymous comment',
          upvotes: 0,
          downvotes: 0,
        },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    expect(tx.mutate.comment.insert).not.toHaveBeenCalled();
  });

  it('rejects group document creation without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run.mockResolvedValue({
      id: 'amendment-1',
      group_id: 'group-1',
    });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.create.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'doc-1',
          amendment_id: 'amendment-1',
          content: [],
          editing_mode: 'edit',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.document.insert).not.toHaveBeenCalled();
  });

  it('rejects group document content updates without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.updateContent.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'doc-1',
          content: [],
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.document.update).not.toHaveBeenCalled();
  });

  it('authorizes amendment-linked document content updates through amendment document rights', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      })
      .mockResolvedValueOnce([]);
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'doc-1',
        content: [{ type: 'p', children: [{ text: 'Updated' }] }],
      },
    });

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'update',
      resource: 'documents',
      amendmentId: 'amendment-1',
    });
    expect(tx.mutate.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-1',
        content: [{ type: 'p', children: [{ text: 'Updated' }] }],
        updated_at: expect.any(Number),
      })
    );
  });

  it('prevents stale document saves from resurrecting completed suggestions', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const staleContent = [
      {
        type: 'p',
        children: [
          {
            text: 'remove me',
            suggestion: true,
            suggestion_insert: { id: 'suggestion-rejected-insert', type: 'insert' },
          },
          {
            text: 'keep me',
            suggestion: true,
            suggestion_remove: { id: 'suggestion-rejected-remove', type: 'remove' },
          },
        ],
      },
    ];

    tx.run
      .mockResolvedValueOnce({ id: 'doc-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce({ id: 'amendment-1', group_id: 'group-1' })
      .mockResolvedValueOnce([
        {
          suggestion_id: 'suggestion-rejected-insert',
          status: 'rejected',
          voting_status: 'completed',
          created_at: 1,
        },
        {
          suggestion_id: 'suggestion-rejected-remove',
          status: 'rejected',
          voting_status: 'completed',
          created_at: 2,
        },
      ]);
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: { id: 'doc-1', content: toMutableJSONValue(staleContent) },
    });

    const update = tx.mutate.document.update.mock.calls[0][0];
    expect(JSON.stringify(update.content)).not.toContain('remove me');
    expect(JSON.stringify(update.content)).toContain('keep me');
    expect(JSON.stringify(update.content)).not.toContain('suggestion-rejected-remove');
  });

  it('rejects standalone document content updates without an active collaborator', async () => {
    const tx = createTx('server');

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: null,
      })
      .mockResolvedValueOnce(null);

    await expect(
      documentSharedMutators.updateContent.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'doc-1',
          content: [],
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(canMock).not.toHaveBeenCalled();
    expect(tx.mutate.document.update).not.toHaveBeenCalled();
  });

  it('updates group document titles through the document mutator when authorized', async () => {
    const tx = createTx('server');

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateGroupDocumentTitle.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        document_id: 'doc-1',
        title: 'Updated Title',
      },
    });

    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        title: 'Updated Title',
      })
    );
  });

  it('rejects group document versions without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.createVersion.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'version-1',
          document_id: 'doc-1',
          amendment_id: null,
          blog_id: null,
          content: [],
          version_number: 1,
          change_summary: 'First version',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.document_version.insert).not.toHaveBeenCalled();
  });

  it('rejects group document comments without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupDocuments', 'group:group-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'thread-1',
        document_id: 'doc-1',
      })
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        group_id: 'group-1',
      });
    canMock.mockRejectedValue(error);

    await expect(
      documentSharedMutators.addComment.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'comment-1',
          thread_id: 'thread-1',
          user_id: 'user-1',
          parent_id: null,
          content: 'Needs work',
          upvotes: 0,
          downvotes: 0,
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.comment.insert).not.toHaveBeenCalled();
  });
});

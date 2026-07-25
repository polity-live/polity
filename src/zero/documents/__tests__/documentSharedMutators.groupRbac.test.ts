import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { toMutableJSONValue } from '../../shared/helpers';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { collectSuggestionIds, documentSharedMutators } from '../shared-mutators';

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
      change_request: {
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
  it('collects inline and block suggestion ids from nested document content', () => {
    expect(
      collectSuggestionIds([
        {
          type: 'p',
          suggestion: {
            id: 'block-suggestion',
            isLineBreak: true,
            type: 'insert',
          },
          children: [
            {
              text: 'Changed',
              suggestion: true,
              suggestion_inline: {
                id: 'inline-suggestion',
                type: 'insert',
              },
            },
          ],
        },
      ])
    ).toEqual(new Set(['block-suggestion', 'inline-suggestion']));
  });

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

  it('marks an open change request obsolete when its final suggestion marker is removed', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const changeRequest = {
      id: 'cr-1',
      process_branch_id: null,
      suggestion_id: 'suggestion-1',
      status: 'open',
      voting_status: 'open',
      votes_for: 2,
      votes_against: 1,
      votes_abstain: 1,
      obsolete_at: null,
      obsolete_reason: null,
    };

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
        editing_mode: 'edit',
      })
      .mockResolvedValueOnce({ id: 'amendment-1', group_id: 'group-1' })
      .mockResolvedValueOnce([changeRequest])
      .mockResolvedValueOnce(null);
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'doc-1',
        content: [{ type: 'p', children: [{ text: 'Updated' }] }],
        reconcile_orphaned_change_requests: true,
      },
    });

    expect(tx.mutate.change_request.update).toHaveBeenCalledWith({
      id: 'cr-1',
      voting_status: 'completed',
      obsolete_reason: 'suggestion_removed_in_collaborative_editing',
      obsolete_at: expect.any(Number),
      obsolete_by_vote_id: null,
      updated_at: expect.any(Number),
    });
    expect(tx.mutate.change_request.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.anything(),
        votes_for: expect.anything(),
      })
    );
    expect(tx.mutate.document.update).toHaveBeenCalledWith(
      expect.not.objectContaining({
        reconcile_orphaned_change_requests: expect.anything(),
      })
    );
  });

  it('keeps an open change request active while one of its suggestion markers remains', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
        editing_mode: 'edit',
      })
      .mockResolvedValueOnce({ id: 'amendment-1', group_id: 'group-1' })
      .mockResolvedValueOnce([
        {
          id: 'cr-1',
          process_branch_id: null,
          suggestion_id: 'suggestion-1',
          status: 'open',
          voting_status: 'open',
        },
      ])
      .mockResolvedValueOnce(null);
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'doc-1',
        content: [
          {
            type: 'p',
            children: [
              {
                text: 'Still suggested',
                suggestion: true,
                suggestion_remaining: {
                  id: 'suggestion-1',
                  type: 'insert',
                },
              },
            ],
          },
        ],
        reconcile_orphaned_change_requests: true,
      },
    });

    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
  });

  it('does not reconcile orphaned change requests outside collaborative editing mode', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
        editing_mode: 'suggest_internal',
      })
      .mockResolvedValueOnce({ id: 'amendment-1', group_id: 'group-1' })
      .mockResolvedValueOnce([
        {
          id: 'cr-1',
          process_branch_id: null,
          suggestion_id: 'suggestion-1',
          status: 'open',
          voting_status: 'open',
        },
      ])
      .mockResolvedValueOnce(null);
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'doc-1',
        content: [{ type: 'p', children: [{ text: 'Updated' }] }],
        reconcile_orphaned_change_requests: true,
      },
    });

    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
  });

  it('only reconciles open non-obsolete change requests in the document branch scope', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-branch-1',
        amendment_id: 'amendment-1',
        editing_mode: 'suggest_internal',
      })
      .mockResolvedValueOnce({ id: 'amendment-1', group_id: 'group-1' })
      .mockResolvedValueOnce([
        {
          id: 'same-branch-open',
          process_branch_id: 'branch-1',
          suggestion_id: 'suggestion-open',
          status: 'open',
          voting_status: 'open',
        },
        {
          id: 'other-branch-open',
          process_branch_id: 'branch-2',
          suggestion_id: 'suggestion-other',
          status: 'open',
          voting_status: 'open',
        },
        {
          id: 'same-branch-decided',
          process_branch_id: 'branch-1',
          suggestion_id: 'suggestion-decided',
          status: 'accepted',
          voting_status: 'completed',
        },
        {
          id: 'same-branch-obsolete',
          process_branch_id: 'branch-1',
          suggestion_id: 'suggestion-obsolete',
          status: 'open',
          voting_status: 'completed',
          obsolete_at: 123,
          obsolete_reason: 'superseded',
        },
      ])
      .mockResolvedValueOnce({
        id: 'branch-1',
        document_id: 'doc-branch-1',
        editing_mode: 'edit',
      });
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'doc-branch-1',
        content: [{ type: 'p', children: [{ text: 'Updated branch' }] }],
        reconcile_orphaned_change_requests: true,
      },
    });

    expect(tx.mutate.change_request.update).toHaveBeenCalledTimes(1);
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'same-branch-open' })
    );
  });

  it('does not reconcile an orphaned request when the internal save flag is absent', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'doc-1',
        amendment_id: 'amendment-1',
        editing_mode: 'edit',
      })
      .mockResolvedValueOnce({ id: 'amendment-1', group_id: 'group-1' })
      .mockResolvedValueOnce([
        {
          id: 'cr-1',
          process_branch_id: null,
          suggestion_id: 'suggestion-1',
          status: 'open',
          voting_status: 'open',
        },
      ]);
    canMock.mockResolvedValueOnce(undefined);

    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'doc-1',
        content: [{ type: 'p', children: [{ text: 'Updated' }] }],
      },
    });

    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
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

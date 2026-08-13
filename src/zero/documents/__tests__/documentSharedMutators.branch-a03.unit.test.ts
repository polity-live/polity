import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();
const requireAuthenticatedMock = vi.fn();
const requireOwnerMock = vi.fn();
const assertCanViewAmendmentMock = vi.fn();
const assertCanViewBlogMock = vi.fn();
const assertCanViewStatementMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

vi.mock('../../rbac/authorize', () => ({
  requireAuthenticated: (...args: unknown[]) => requireAuthenticatedMock(...args),
  requireOwner: (...args: unknown[]) => requireOwnerMock(...args),
}));

vi.mock('../../rbac/amendment-access', () => ({
  assertCanViewAmendment: (...args: unknown[]) => assertCanViewAmendmentMock(...args),
}));

vi.mock('../../blogs/shared-mutators', () => ({
  assertCanViewBlog: (...args: unknown[]) => assertCanViewBlogMock(...args),
}));

vi.mock('../../statements/shared-mutators', () => ({
  assertCanViewStatement: (...args: unknown[]) => assertCanViewStatementMock(...args),
}));

import { collectSuggestionIds, documentSharedMutators } from '../shared-mutators';

type CreateInput = Parameters<typeof documentSharedMutators.create.fn>[0];
type Tx = CreateInput['tx'];
type Ctx = CreateInput['ctx'];

const ctx: Ctx = { userID: 'user-1', email: 'user@example.com' };

function createTx(location: Tx['location'] = 'server', rows: unknown[] = []) {
  const pendingRows = [...rows];
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn().mockImplementation(() => Promise.resolve(pendingRows.shift())),
    mutate: {
      document: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      document_version: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      document_collaborator: { insert: vi.fn() },
      thread: { insert: vi.fn(), update: vi.fn() },
      comment: { insert: vi.fn(), update: vi.fn() },
      thread_vote: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      comment_vote: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      amendment: { update: vi.fn() },
      change_request: { update: vi.fn() },
    },
  };
}

beforeEach(() => {
  canMock.mockReset().mockResolvedValue(undefined);
  requireAuthenticatedMock.mockReset();
  requireOwnerMock.mockReset();
  assertCanViewAmendmentMock.mockReset().mockResolvedValue(undefined);
  assertCanViewBlogMock.mockReset().mockResolvedValue(undefined);
  assertCanViewStatementMock.mockReset().mockResolvedValue(undefined);
  vi.spyOn(Date, 'now').mockReturnValue(1234);
});

describe('documentSharedMutators A03 branch contracts', () => {
  it('ignores malformed suggestion nodes and only collects non-empty string ids', () => {
    expect(collectSuggestionIds(null)).toEqual(new Set());
    expect(
      collectSuggestionIds([
        null,
        'text',
        [],
        { suggestion: [], suggestion_bad: [], children: 'not-an-array' },
        { suggestion: { id: '' }, suggestion_null: null },
        { suggestion: { id: 42 }, suggestion_scalar: 1 },
        { suggestion: { id: 'block' }, suggestion_inline: { id: '' } },
        { suggestion_inline: { id: 42 }, suggestion_valid: { id: 'inline' } },
      ])
    ).toEqual(new Set(['block', 'inline']));
  });

  it('covers create authorization on client, standalone server, missing amendment and fallback', async () => {
    const client = createTx('client');
    await documentSharedMutators.create.fn({
      tx: client as never,
      ctx,
      args: { id: 'client-doc', amendment_id: null, content: [] } as never,
    });
    expect(client.mutate.document.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'client-doc', created_at: 1234, updated_at: 1234 })
    );

    const standalone = createTx('server');
    await documentSharedMutators.create.fn({
      tx: standalone as never,
      ctx,
      args: { id: 'standalone-doc', amendment_id: null, content: [] } as never,
    });
    expect(requireAuthenticatedMock).toHaveBeenCalledWith(
      standalone,
      ctx,
      expect.objectContaining({ action: 'create', resource: 'documents' })
    );

    const missing = createTx('server', [undefined]);
    await expect(
      documentSharedMutators.create.fn({
        tx: missing as never,
        ctx,
        args: { id: 'missing-doc', amendment_id: 'missing', content: [] } as never,
      })
    ).rejects.toThrow('Amendment not found');

    const denied = new PermissionError('update', 'documents', 'amendment:a-1');
    canMock.mockRejectedValueOnce(denied).mockResolvedValueOnce(undefined);
    const fallback = createTx('server', [{ id: 'a-1', group_id: 'group-1' }]);
    await documentSharedMutators.create.fn({
      tx: fallback as never,
      ctx,
      args: { id: 'fallback-doc', amendment_id: 'a-1', content: [] } as never,
    });
    expect(canMock).toHaveBeenLastCalledWith(
      fallback,
      ctx,
      expect.objectContaining({ resource: 'groupDocuments', groupId: 'group-1' })
    );

    canMock.mockRejectedValueOnce(new Error('storage unavailable'));
    const infrastructureFailure = createTx('server', [{ id: 'a-2', group_id: 'group-2' }]);
    await expect(
      documentSharedMutators.create.fn({
        tx: infrastructureFailure as never,
        ctx,
        args: { id: 'failed-doc', amendment_id: 'a-2', content: [] } as never,
      })
    ).rejects.toThrow('storage unavailable');

    canMock.mockRejectedValueOnce(denied);
    const noGroupFallback = createTx('server', [{ id: 'a-3', group_id: null }]);
    await expect(
      documentSharedMutators.create.fn({
        tx: noGroupFallback as never,
        ctx,
        args: { id: 'failed-doc-2', amendment_id: 'a-3', content: [] } as never,
      })
    ).rejects.toBe(denied);
  });

  it('covers standalone document scope success and document/amendment failures', async () => {
    const missingDocument = createTx('server', [undefined]);
    await expect(
      documentSharedMutators.delete.fn({
        tx: missingDocument as never,
        ctx,
        args: { id: 'missing' },
      })
    ).rejects.toThrow('Document not found');

    const missingAmendment = createTx('server', [
      { id: 'doc-1', amendment_id: 'missing-amendment' },
      undefined,
    ]);
    await expect(
      documentSharedMutators.delete.fn({
        tx: missingAmendment as never,
        ctx,
        args: { id: 'doc-1' },
      })
    ).rejects.toThrow('Amendment not found');

    const collaborator = createTx('server', [
      { id: 'doc-2', amendment_id: null },
      { id: 'collaborator-1', status: 'active' },
    ]);
    await documentSharedMutators.delete.fn({
      tx: collaborator as never,
      ctx,
      args: { id: 'doc-2' },
    });
    expect(collaborator.mutate.document.delete).toHaveBeenCalledWith({ id: 'doc-2' });

    const denied = new PermissionError('update', 'documents', 'amendment:a-1');
    canMock.mockRejectedValueOnce(denied).mockResolvedValueOnce(undefined);
    const groupFallback = createTx('server', [
      { id: 'doc-3', amendment_id: 'a-1' },
      { id: 'a-1', group_id: 'group-1' },
    ]);
    await documentSharedMutators.delete.fn({
      tx: groupFallback as never,
      ctx,
      args: { id: 'doc-3' },
    });

    canMock.mockRejectedValueOnce(new Error('rbac offline'));
    const unexpected = createTx('server', [
      { id: 'doc-4', amendment_id: 'a-2' },
      { id: 'a-2', group_id: 'group-2' },
    ]);
    await expect(
      documentSharedMutators.delete.fn({ tx: unexpected as never, ctx, args: { id: 'doc-4' } })
    ).rejects.toThrow('rbac offline');

    canMock.mockRejectedValueOnce(denied);
    const missingGroup = createTx('server', [
      { id: 'doc-5', amendment_id: 'a-3' },
      { id: 'a-3', group_id: null },
    ]);
    await expect(
      documentSharedMutators.delete.fn({ tx: missingGroup as never, ctx, args: { id: 'doc-5' } })
    ).rejects.toBe(denied);
  });

  it('covers content update payload branches and client reconciliation guards', async () => {
    const server = createTx('server', [{ id: 'doc-1', amendment_id: null }, { id: 'collab-1' }]);
    await documentSharedMutators.updateContent.fn({
      tx: server as never,
      ctx,
      args: { id: 'doc-1' } as never,
    });
    expect(server.mutate.document.update).toHaveBeenCalledWith({ id: 'doc-1', updated_at: 1234 });

    const clientMissing = createTx('client', [undefined]);
    await documentSharedMutators.updateContent.fn({
      tx: clientMissing as never,
      ctx,
      args: {
        id: 'doc-2',
        content: null,
        reconcile_orphaned_change_requests: true,
      } as never,
    });

    const noAmendment = createTx('client', [{ id: 'doc-3', amendment_id: null }]);
    await documentSharedMutators.updateContent.fn({
      tx: noAmendment as never,
      ctx,
      args: {
        id: 'doc-3',
        content: [],
        reconcile_orphaned_change_requests: true,
      } as never,
    });

    const clientWithoutReconciliation = createTx('client');
    await documentSharedMutators.updateContent.fn({
      tx: clientWithoutReconciliation as never,
      ctx,
      args: { id: 'doc-without-reconciliation', content: [] } as never,
    });

    const wrongMode = createTx('client', [
      { id: 'doc-4', amendment_id: 'a-1', editing_mode: 'suggest_internal' },
      null,
    ]);
    await documentSharedMutators.updateContent.fn({
      tx: wrongMode as never,
      ctx,
      args: {
        id: 'doc-4',
        content: [],
        reconcile_orphaned_change_requests: true,
      } as never,
    });
  });

  it('loads change requests during client reconciliation and covers every open-state guard', async () => {
    const rows = [
      { id: 'doc-1', amendment_id: 'a-1', editing_mode: 'edit' },
      { id: 'branch-1', editing_mode: 'edit' },
      [
        { id: 'wrong-branch', process_branch_id: 'branch-2', suggestion_id: 's-1' },
        { id: 'missing-suggestion', process_branch_id: 'branch-1' },
        {
          id: 'closed-status',
          process_branch_id: 'branch-1',
          suggestion_id: 's-2',
          status: 'closed',
        },
        {
          id: 'completed',
          process_branch_id: 'branch-1',
          suggestion_id: 's-3',
          voting_status: 'completed',
        },
        {
          id: 'obsolete-at',
          process_branch_id: 'branch-1',
          suggestion_id: 's-4',
          obsolete_at: 1,
        },
        {
          id: 'obsolete-reason',
          process_branch_id: 'branch-1',
          suggestion_id: 's-5',
          obsolete_reason: 'old',
        },
        { id: 'active-marker', process_branch_id: 'branch-1', suggestion_id: 'active' },
        { id: 'orphan', process_branch_id: 'branch-1', suggestion_id: 'gone', status: null },
      ],
    ];
    const tx = createTx('client', rows);
    await documentSharedMutators.updateContent.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'doc-1',
        content: [{ type: 'p', children: [{ text: 'x', suggestion_active: { id: 'active' } }] }],
        reconcile_orphaned_change_requests: true,
      } as never,
    });
    expect(tx.mutate.change_request.update).toHaveBeenCalledTimes(1);
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'orphan', obsolete_at: 1234 })
    );
  });

  it('updates titles from client lookup and rejects titles without a parent amendment', async () => {
    const client = createTx('client', [{ id: 'doc-1', amendment_id: 'a-1' }]);
    await documentSharedMutators.updateGroupDocumentTitle.fn({
      tx: client as never,
      ctx,
      args: { document_id: 'doc-1', title: 'Client title' },
    });
    expect(client.mutate.amendment.update).toHaveBeenCalledWith({
      id: 'a-1',
      title: 'Client title',
      updated_at: 1234,
    });

    const missing = createTx('client', [undefined]);
    await expect(
      documentSharedMutators.updateGroupDocumentTitle.fn({
        tx: missing as never,
        ctx,
        args: { document_id: 'missing', title: 'No parent' },
      })
    ).rejects.toThrow('missing parent amendment id');
  });

  it('covers client and server version/collaborator mutations', async () => {
    const client = createTx('client');
    await documentSharedMutators.createVersion.fn({
      tx: client as never,
      ctx,
      args: { id: 'v-1', document_id: null, content: [], version_number: 1 } as never,
    });
    await documentSharedMutators.addCollaborator.fn({
      tx: client as never,
      ctx,
      args: { id: 'c-1', document_id: 'doc-1', user_id: 'user-2' } as never,
    });
    expect(client.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'v-1', author_id: 'user-1', created_at: 1234 })
    );
    expect(client.mutate.document_collaborator.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c-1', created_at: 1234 })
    );

    const serverNoDocument = createTx('server');
    await documentSharedMutators.createVersion.fn({
      tx: serverNoDocument as never,
      ctx,
      args: { id: 'v-2', document_id: null, content: [], version_number: 2 } as never,
    });

    const serverCollaborator = createTx('server', [
      { id: 'doc-1', amendment_id: null },
      { id: 'active-collaborator' },
    ]);
    await documentSharedMutators.addCollaborator.fn({
      tx: serverCollaborator as never,
      ctx,
      args: { id: 'c-2', document_id: 'doc-1', user_id: 'user-2' } as never,
    });
  });

  it('authorizes every create-thread parent and rejects a missing parent', async () => {
    const cases = [
      {
        args: { document_id: 'doc-1' },
        rows: [{ id: 'doc-1', amendment_id: null }, { id: 'collab-1' }],
      },
      { args: { amendment_id: 'a-1' }, rows: [] },
      { args: { blog_id: 'blog-1' }, rows: [] },
      { args: { statement_id: 'statement-1' }, rows: [] },
      {
        args: { todo_id: 'todo-1' },
        rows: [{ id: 'todo-1', creator_id: 'other', group_id: null }],
      },
    ];
    for (const [index, testCase] of cases.entries()) {
      const tx = createTx('server', testCase.rows);
      await documentSharedMutators.createThread.fn({
        tx: tx as never,
        ctx,
        args: {
          id: `thread-${index}`,
          document_id: null,
          amendment_id: null,
          blog_id: null,
          statement_id: null,
          todo_id: null,
          ...testCase.args,
        } as never,
      });
      expect(tx.mutate.thread.insert).toHaveBeenCalled();
    }

    const missing = createTx('server');
    await expect(
      documentSharedMutators.createThread.fn({
        tx: missing as never,
        ctx,
        args: {
          id: 'thread-missing',
          document_id: null,
          amendment_id: null,
          blog_id: null,
          statement_id: null,
          todo_id: null,
        } as never,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const client = createTx('client');
    await documentSharedMutators.createThread.fn({
      tx: client as never,
      ctx,
      args: { id: 'thread-client' } as never,
    });
  });

  it('covers todo authorization for missing, creator, group manager, denied and client paths', async () => {
    const invokeUpdate = (tx: ReturnType<typeof createTx>, id: string) =>
      documentSharedMutators.updateThread.fn({
        tx: tx as never,
        ctx,
        args: { id, content: 'updated' } as never,
      });

    const missingTodo = createTx('server', [
      { id: 'thread-1', user_id: 'other', todo_id: 'todo-1' },
      undefined,
    ]);
    await expect(invokeUpdate(missingTodo, 'thread-1')).rejects.toBeInstanceOf(PermissionError);

    const creator = createTx('server', [
      { id: 'thread-2', user_id: 'other', todo_id: 'todo-2' },
      { id: 'todo-2', creator_id: 'user-1', group_id: null },
    ]);
    await invokeUpdate(creator, 'thread-2');

    const group = createTx('server', [
      { id: 'thread-3', user_id: 'other', todo_id: 'todo-3' },
      { id: 'todo-3', creator_id: 'other', group_id: 'group-1' },
    ]);
    await invokeUpdate(group, 'thread-3');
    expect(canMock).toHaveBeenCalledWith(
      group,
      ctx,
      expect.objectContaining({ resource: 'groupTodos', groupId: 'group-1' })
    );

    const denied = createTx('server', [
      { id: 'thread-4', user_id: 'other', todo_id: 'todo-4' },
      { id: 'todo-4', creator_id: 'other', group_id: null },
    ]);
    await expect(invokeUpdate(denied, 'thread-4')).rejects.toBeInstanceOf(PermissionError);

    const client = createTx('client');
    await invokeUpdate(client, 'thread-client');
  });

  it('authorizes participation through all parent scopes and handles missing rows/parents', async () => {
    const parents = [
      { thread: { id: 't-doc', document_id: 'doc-1' }, rest: [{ id: 'doc-1' }, { id: 'c' }] },
      { thread: { id: 't-amendment', amendment_id: 'a-1' }, rest: [] },
      { thread: { id: 't-blog', blog_id: 'b-1' }, rest: [] },
      { thread: { id: 't-statement', statement_id: 's-1' }, rest: [] },
      {
        thread: { id: 't-todo', todo_id: 'todo-1' },
        rest: [{ id: 'todo-1', creator_id: 'other' }],
      },
    ];
    for (const [index, parent] of parents.entries()) {
      const tx = createTx('server', [parent.thread, ...parent.rest]);
      await documentSharedMutators.addComment.fn({
        tx: tx as never,
        ctx,
        args: { id: `comment-${index}`, thread_id: parent.thread.id, content: 'text' } as never,
      });
      expect(tx.mutate.comment.insert).toHaveBeenCalled();
    }

    const missingThread = createTx('server', [undefined]);
    await expect(
      documentSharedMutators.addComment.fn({
        tx: missingThread as never,
        ctx,
        args: { id: 'comment-missing', thread_id: 'missing', content: 'x' } as never,
      })
    ).rejects.toThrow('Thread not found');

    const noParent = createTx('server', [{ id: 't-empty' }]);
    await expect(
      documentSharedMutators.addComment.fn({
        tx: noParent as never,
        ctx,
        args: { id: 'comment-empty', thread_id: 't-empty', content: 'x' } as never,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const client = createTx('client');
    await documentSharedMutators.addComment.fn({
      tx: client as never,
      ctx,
      args: { id: 'comment-client', thread_id: 't-client', content: 'x' } as never,
    });
  });

  it('covers thread parent management for document, amendment, blog, statement, todo and no parent', async () => {
    const parents = [
      {
        thread: { id: 't-doc', user_id: 'other', document_id: 'doc-1' },
        rest: [{ id: 'doc-1' }, { id: 'collab-1' }],
      },
      { thread: { id: 't-amendment', user_id: 'other', amendment_id: 'a-1' }, rest: [] },
      { thread: { id: 't-blog', user_id: 'other', blog_id: 'b-1' }, rest: [] },
      {
        thread: { id: 't-statement', user_id: 'other', statement_id: 's-1' },
        rest: [{ id: 's-1', user_id: 'owner-1' }],
      },
      {
        thread: { id: 't-todo', user_id: 'other', todo_id: 'todo-1' },
        rest: [{ id: 'todo-1', creator_id: 'user-1' }],
      },
    ];
    for (const parent of parents) {
      const tx = createTx('server', [parent.thread, ...parent.rest]);
      await documentSharedMutators.updateThread.fn({
        tx: tx as never,
        ctx,
        args: { id: parent.thread.id, content: 'updated' } as never,
      });
      expect(tx.mutate.thread.update).toHaveBeenCalled();
    }

    const owner = createTx('server', [{ id: 't-owner', user_id: 'user-1' }]);
    await documentSharedMutators.updateThread.fn({
      tx: owner as never,
      ctx,
      args: { id: 't-owner', content: 'owner update' } as never,
    });
    expect(requireOwnerMock).toHaveBeenCalled();

    const missing = createTx('server', [undefined]);
    await expect(
      documentSharedMutators.updateThread.fn({
        tx: missing as never,
        ctx,
        args: { id: 'missing', content: 'x' } as never,
      })
    ).rejects.toThrow('Thread not found');

    const noParent = createTx('server', [{ id: 't-empty', user_id: 'other' }]);
    await expect(
      documentSharedMutators.updateThread.fn({
        tx: noParent as never,
        ctx,
        args: { id: 't-empty', content: 'x' } as never,
      })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it('covers comment owner/parent management, missing comments and client updates', async () => {
    const owner = createTx('server', [{ id: 'c-owner', user_id: 'user-1' }]);
    await documentSharedMutators.updateComment.fn({
      tx: owner as never,
      ctx,
      args: { id: 'c-owner', content: 'owner edit' } as never,
    });
    expect(requireOwnerMock).toHaveBeenCalled();

    const parent = createTx('server', [
      { id: 'c-parent', user_id: 'other', thread_id: 't-1' },
      { id: 't-1', user_id: 'other', amendment_id: 'a-1' },
    ]);
    await documentSharedMutators.updateComment.fn({
      tx: parent as never,
      ctx,
      args: { id: 'c-parent', content: 'manager edit' } as never,
    });

    const missing = createTx('server', [undefined]);
    await expect(
      documentSharedMutators.updateComment.fn({
        tx: missing as never,
        ctx,
        args: { id: 'missing', content: 'x' } as never,
      })
    ).rejects.toThrow('Comment not found');

    const client = createTx('client');
    await documentSharedMutators.updateComment.fn({
      tx: client as never,
      ctx,
      args: { id: 'c-client', content: 'client edit' } as never,
    });
  });

  it('covers vote server parity, missing scope records and client no-op counters', async () => {
    const serverThread = createTx('server', [{ id: 't-1', amendment_id: 'a-1' }]);
    await documentSharedMutators.voteThread.fn({
      tx: serverThread as never,
      ctx,
      args: { id: 'tv-1', thread_id: 't-1', vote: 1 } as never,
    });
    expect(serverThread.mutate.thread.update).not.toHaveBeenCalled();

    const missingComment = createTx('server', [undefined]);
    await expect(
      documentSharedMutators.voteComment.fn({
        tx: missingComment as never,
        ctx,
        args: { id: 'cv-1', comment_id: 'missing', vote: 1 } as never,
      })
    ).rejects.toThrow('Comment not found');

    const noThreadCounter = createTx('client', [undefined]);
    await documentSharedMutators.voteThread.fn({
      tx: noThreadCounter as never,
      ctx,
      args: { id: 'tv-client', thread_id: 'missing', vote: 0 } as never,
    });
    expect(noThreadCounter.mutate.thread.update).not.toHaveBeenCalled();

    const noCommentCounter = createTx('client', [undefined]);
    await documentSharedMutators.voteComment.fn({
      tx: noCommentCounter as never,
      ctx,
      args: { id: 'cv-client', comment_id: 'missing', vote: 0 } as never,
    });
    expect(noCommentCounter.mutate.comment.update).not.toHaveBeenCalled();

    const defaultsAndClamp = createTx('client', [
      { id: 't-2', upvotes: null, downvotes: null },
      { id: 'c-2', upvotes: null, downvotes: null },
    ]);
    await documentSharedMutators.voteThread.fn({
      tx: defaultsAndClamp as never,
      ctx,
      args: { id: 'tv-2', thread_id: 't-2', vote: -1 } as never,
    });
    await documentSharedMutators.voteComment.fn({
      tx: defaultsAndClamp as never,
      ctx,
      args: { id: 'cv-2', comment_id: 'c-2', vote: 1 } as never,
    });
  });

  it('covers version update/delete client, missing server rows and unscoped versions', async () => {
    const client = createTx('client');
    await documentSharedMutators.updateVersion.fn({
      tx: client as never,
      ctx,
      args: { id: 'v-client', change_summary: 'updated' } as never,
    });
    await documentSharedMutators.deleteVersion.fn({
      tx: client as never,
      ctx,
      args: { id: 'v-client' },
    });
    await documentSharedMutators.delete.fn({
      tx: client as never,
      ctx,
      args: { id: 'doc-client' },
    });

    for (const mutator of [
      documentSharedMutators.updateVersion,
      documentSharedMutators.deleteVersion,
    ]) {
      const tx = createTx('server', [undefined]);
      await expect(
        mutator.fn({ tx: tx as never, ctx, args: { id: 'missing' } as never })
      ).rejects.toThrow('Document version not found');
    }

    const updateUnscoped = createTx('server', [{ id: 'v-1', document_id: null }]);
    await documentSharedMutators.updateVersion.fn({
      tx: updateUnscoped as never,
      ctx,
      args: { id: 'v-1', change_summary: 'updated' } as never,
    });
    const deleteUnscoped = createTx('server', [{ id: 'v-2', document_id: null }]);
    await documentSharedMutators.deleteVersion.fn({
      tx: deleteUnscoped as never,
      ctx,
      args: { id: 'v-2' },
    });

    const updateScoped = createTx('server', [
      { id: 'v-3', document_id: 'doc-3' },
      { id: 'doc-3', amendment_id: null },
      { id: 'active-collaborator' },
    ]);
    await documentSharedMutators.updateVersion.fn({
      tx: updateScoped as never,
      ctx,
      args: { id: 'v-3', change_summary: 'scoped' } as never,
    });

    const deleteScoped = createTx('server', [
      { id: 'v-4', document_id: 'doc-4' },
      { id: 'doc-4', amendment_id: null },
      { id: 'active-collaborator' },
    ]);
    await documentSharedMutators.deleteVersion.fn({
      tx: deleteScoped as never,
      ctx,
      args: { id: 'v-4' },
    });
  });

  it('covers vote update/delete server validation and optimistic missing vote branches', async () => {
    const cases = [
      ['updateCommentVote', 'Comment vote not found'],
      ['deleteCommentVote', 'Comment vote not found'],
      ['updateThreadVote', 'Thread vote not found'],
      ['deleteThreadVote', 'Thread vote not found'],
    ] as const;
    for (const [name, message] of cases) {
      const tx = createTx('server', [undefined]);
      await expect(
        documentSharedMutators[name].fn({
          tx: tx as never,
          ctx,
          args: { id: 'missing', vote: 1 } as never,
        })
      ).rejects.toThrow(message);
    }

    const clientCases = [
      documentSharedMutators.updateCommentVote,
      documentSharedMutators.deleteCommentVote,
      documentSharedMutators.updateThreadVote,
      documentSharedMutators.deleteThreadVote,
    ];
    for (const mutator of clientCases) {
      const tx = createTx('client', [undefined]);
      await mutator.fn({ tx: tx as never, ctx, args: { id: 'missing', vote: 1 } as never });
      expect(tx.mutate.comment.update).not.toHaveBeenCalled();
      expect(tx.mutate.thread.update).not.toHaveBeenCalled();
    }
  });

  it('covers successful server vote updates/deletes through comment and thread scopes', async () => {
    const commentRows = [
      { id: 'cv-1', user_id: 'user-1', comment_id: 'c-1' },
      { id: 'c-1', thread_id: 't-1' },
      { id: 't-1', amendment_id: 'a-1' },
    ];
    const updateComment = createTx('server', commentRows);
    await documentSharedMutators.updateCommentVote.fn({
      tx: updateComment as never,
      ctx,
      args: { id: 'cv-1', vote: -1 },
    });
    const deleteComment = createTx('server', commentRows);
    await documentSharedMutators.deleteCommentVote.fn({
      tx: deleteComment as never,
      ctx,
      args: { id: 'cv-1' },
    });

    const threadRows = [
      { id: 'tv-1', user_id: 'user-1', thread_id: 't-1' },
      { id: 't-1', amendment_id: 'a-1' },
    ];
    const updateThread = createTx('server', threadRows);
    await documentSharedMutators.updateThreadVote.fn({
      tx: updateThread as never,
      ctx,
      args: { id: 'tv-1', vote: -1 },
    });
    const deleteThread = createTx('server', threadRows);
    await documentSharedMutators.deleteThreadVote.fn({
      tx: deleteThread as never,
      ctx,
      args: { id: 'tv-1' },
    });
    expect(requireOwnerMock).toHaveBeenCalledTimes(4);
  });
});

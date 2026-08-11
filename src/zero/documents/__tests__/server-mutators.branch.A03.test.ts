import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const shared = Object.fromEntries(
    [
      'updateContent',
      'create',
      'delete',
      'createVersion',
      'addCollaborator',
      'addComment',
      'voteThread',
      'updateThreadVote',
      'deleteThreadVote',
      'voteComment',
      'updateCommentVote',
      'deleteCommentVote',
    ].map(name => [name, vi.fn()])
  ) as Record<string, ReturnType<typeof vi.fn>>;
  return {
    shared,
    fireNotification: vi.fn(),
    amendmentTitle: vi.fn(),
    blogTitle: vi.fn(),
    groupName: vi.fn(),
    recomputeAmendmentCounters: vi.fn(),
    recomputeBlogCounters: vi.fn(),
    recomputeEventCounters: vi.fn(),
    userName: vi.fn(),
    recipients: vi.fn(),
  };
});

vi.mock('../../mutators', () => ({
  mutators: {
    documents: Object.fromEntries(Object.entries(mocks.shared).map(([name, fn]) => [name, { fn }])),
  },
}));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fireNotification }));
vi.mock('../../server-helpers', () => ({
  amendmentTitle: mocks.amendmentTitle,
  blogTitle: mocks.blogTitle,
  groupName: mocks.groupName,
  recomputeAmendmentCounters: mocks.recomputeAmendmentCounters,
  recomputeBlogCounters: mocks.recomputeBlogCounters,
  recomputeEventCounters: mocks.recomputeEventCounters,
  userName: mocks.userName,
}));
vi.mock('../../todos/comment-notifications', () => ({
  collectTodoCommentRecipientIds: mocks.recipients,
}));

import { documentServerMutators } from '../server-mutators';

function makeTx(...responses: unknown[]) {
  const run = vi.fn();
  for (const response of responses) run.mockResolvedValueOnce(response);
  return {
    location: 'server',
    run,
    mutate: {
      amendment: { update: vi.fn() },
      blog: { update: vi.fn() },
      comment: { update: vi.fn() },
      group: { update: vi.fn() },
      statement: { update: vi.fn() },
      thread: { update: vi.fn() },
    },
  };
}

const ctx = { userID: 'actor', email: 'actor@example.test' };

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mocks.shared).forEach(fn => fn.mockResolvedValue(undefined));
  mocks.fireNotification.mockResolvedValue(undefined);
  mocks.amendmentTitle.mockResolvedValue('Amendment title');
  mocks.blogTitle.mockResolvedValue('Blog title');
  mocks.groupName.mockResolvedValue('Group name');
  mocks.userName.mockResolvedValue('Actor name');
  mocks.recomputeAmendmentCounters.mockResolvedValue(undefined);
  mocks.recomputeBlogCounters.mockResolvedValue(undefined);
  mocks.recomputeEventCounters.mockResolvedValue(undefined);
  mocks.recipients.mockReturnValue(['recipient-1']);
});

describe('document server mutators branch campaign A03', () => {
  it('reconciles update content only for amendment documents and optional events', async () => {
    const noReconcile = makeTx(null);
    await documentServerMutators.updateContent.fn({
      tx: noReconcile as never,
      ctx,
      args: { id: 'doc-1', content: [], reconcile_orphaned_change_requests: false } as never,
    });
    expect(mocks.recomputeAmendmentCounters).not.toHaveBeenCalled();

    const noAmendment = makeTx({ amendment_id: null });
    await documentServerMutators.updateContent.fn({
      tx: noAmendment as never,
      ctx,
      args: { id: 'doc-2', content: [], reconcile_orphaned_change_requests: true } as never,
    });

    const withoutEvent = makeTx({ amendment_id: 'amd-1' }, { id: 'amd-1', event_id: null });
    await documentServerMutators.updateContent.fn({
      tx: withoutEvent as never,
      ctx,
      args: { id: 'doc-3', content: [], reconcile_orphaned_change_requests: true } as never,
    });
    expect(mocks.recomputeAmendmentCounters).toHaveBeenCalledWith(withoutEvent, 'amd-1');

    const withEvent = makeTx({ amendment_id: 'amd-2' }, { id: 'amd-2', event_id: 'event-1' });
    await documentServerMutators.updateContent.fn({
      tx: withEvent as never,
      ctx,
      args: { id: 'doc-4', content: [], reconcile_orphaned_change_requests: true } as never,
    });
    expect(mocks.recomputeEventCounters).toHaveBeenCalledWith(withEvent, 'event-1');
  });

  it('creates documents across absent amendment/group/row and complete counter paths', async () => {
    await documentServerMutators.create.fn({
      tx: makeTx() as never,
      ctx,
      args: { id: 'doc-0', amendment_id: null } as never,
    });
    await documentServerMutators.create.fn({
      tx: makeTx(null) as never,
      ctx,
      args: { id: 'doc-1', amendment_id: 'missing' } as never,
    });
    await documentServerMutators.create.fn({
      tx: makeTx({ id: 'amd', group_id: null }) as never,
      ctx,
      args: { id: 'doc-2', amendment_id: 'amd' } as never,
    });

    const missingGroup = makeTx({ id: 'amd', group_id: 'group-1', title: null }, null);
    await documentServerMutators.create.fn({
      tx: missingGroup as never,
      ctx,
      args: { id: 'doc-3', amendment_id: 'amd' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyDocumentCreated',
      expect.objectContaining({ documentTitle: 'Document' })
    );

    const complete = makeTx(
      { id: 'amd', group_id: 'group-1', title: 'Named' },
      { id: 'group-1', document_count: null }
    );
    await documentServerMutators.create.fn({
      tx: complete as never,
      ctx,
      args: { id: 'doc-4', amendment_id: 'amd' } as never,
    });
    expect(complete.mutate.group.update).toHaveBeenCalledWith({
      id: 'group-1',
      document_count: 1,
    });

    const existingCount = makeTx(
      { id: 'amd', group_id: 'group-1', title: 'Named' },
      { id: 'group-1', document_count: 4 }
    );
    await documentServerMutators.create.fn({
      tx: existingCount as never,
      ctx,
      args: { id: 'doc-5', amendment_id: 'amd' } as never,
    });
    expect(existingCount.mutate.group.update).toHaveBeenCalledWith(
      expect.objectContaining({ document_count: 5 })
    );
  });

  it('deletes documents across absent and complete decrement paths', async () => {
    await documentServerMutators.delete.fn({
      tx: makeTx(null) as never,
      ctx,
      args: { id: 'missing' },
    });
    await documentServerMutators.delete.fn({
      tx: makeTx({ amendment_id: 'amd' }, null) as never,
      ctx,
      args: { id: 'doc-1' },
    });
    await documentServerMutators.delete.fn({
      tx: makeTx({ amendment_id: 'amd' }, { group_id: null }) as never,
      ctx,
      args: { id: 'doc-2' },
    });

    const missingGroup = makeTx(
      { amendment_id: 'amd' },
      { group_id: 'group-1', title: null },
      null
    );
    await documentServerMutators.delete.fn({
      tx: missingGroup as never,
      ctx,
      args: { id: 'doc-3' },
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyDocumentDeleted',
      expect.objectContaining({ documentTitle: 'Document' })
    );

    const zero = makeTx(
      { amendment_id: 'amd' },
      { group_id: 'group-1', title: 'Named' },
      { document_count: null }
    );
    await documentServerMutators.delete.fn({ tx: zero as never, ctx, args: { id: 'doc-4' } });
    expect(zero.mutate.group.update).toHaveBeenCalledWith(
      expect.objectContaining({ document_count: 0 })
    );
    const positive = makeTx(
      { amendment_id: 'amd' },
      { group_id: 'group-1', title: 'Named' },
      { document_count: 3 }
    );
    await documentServerMutators.delete.fn({ tx: positive as never, ctx, args: { id: 'doc-5' } });
    expect(positive.mutate.group.update).toHaveBeenCalledWith(
      expect.objectContaining({ document_count: 2 })
    );
  });

  it('creates versions from explicit and document amendment ids with version fallbacks', async () => {
    await documentServerMutators.createVersion.fn({
      tx: makeTx({ amendment_id: null }) as never,
      ctx,
      args: { id: 'version-0', document_id: 'doc', amendment_id: null } as never,
    });
    expect(mocks.fireNotification).not.toHaveBeenCalled();

    await documentServerMutators.createVersion.fn({
      tx: makeTx({ amendment_id: 'amd-from-document' }) as never,
      ctx,
      args: { id: 'version-1', document_id: 'doc', version_number: null } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyVersionCreated',
      expect.objectContaining({ amendmentId: 'amd-from-document', version: 'v.1' })
    );

    await documentServerMutators.createVersion.fn({
      tx: makeTx(null) as never,
      ctx,
      args: {
        id: 'version-2',
        document_id: 'doc',
        amendment_id: 'amd-explicit',
        version_number: 7,
      } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyVersionCreated',
      expect.objectContaining({ amendmentId: 'amd-explicit', version: 'v.7' })
    );
  });

  it('guards self collaboration and resolves amendment or generic document titles', async () => {
    await documentServerMutators.addCollaborator.fn({
      tx: makeTx() as never,
      ctx,
      args: { id: 'link-self', user_id: 'actor', document_id: 'doc' } as never,
    });
    expect(mocks.fireNotification).not.toHaveBeenCalled();

    await documentServerMutators.addCollaborator.fn({
      tx: makeTx({ amendment_id: 'amd' }) as never,
      ctx,
      args: { id: 'link-1', user_id: 'recipient', document_id: 'doc' } as never,
    });
    expect(mocks.amendmentTitle).toHaveBeenCalled();

    await documentServerMutators.addCollaborator.fn({
      tx: makeTx(null) as never,
      ctx,
      args: { id: 'link-2', user_id: 'recipient-2', document_id: 'doc' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenLastCalledWith(
      'notifyDocumentCollaboratorInvited',
      expect.objectContaining({ documentTitle: 'Document' })
    );
  });

  it('adds comments for amendment, blog, statement, and todo threads', async () => {
    const tx = makeTx(
      {
        id: 'thread',
        amendment_id: 'amd',
        blog_id: 'blog',
        statement_id: 'statement',
        todo_id: 'todo',
      },
      { id: 'amd', comment_count: null },
      { id: 'blog', group_id: null },
      { user_id: null },
      { id: 'statement', comment_count: null },
      { id: 'todo', creator_id: 'creator', title: null },
      [{ user_id: 'assignee' }]
    );
    await documentServerMutators.addComment.fn({
      tx: tx as never,
      ctx,
      args: { id: 'comment', thread_id: 'thread', content: 'Hi', user_id: 'actor' } as never,
    });
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({ comment_count: 1 })
    );
    expect(tx.mutate.statement.update).toHaveBeenCalledWith(
      expect.objectContaining({ comment_count: 1 })
    );
    expect(mocks.recomputeBlogCounters).toHaveBeenCalledWith(tx, 'blog');
    expect(mocks.recomputeAmendmentCounters).toHaveBeenCalledWith(tx, 'amd');
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyBlogCommentAdded',
      expect.objectContaining({ groupId: undefined, ownerId: undefined })
    );
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyTodoCommentAdded',
      expect.objectContaining({ todoTitle: 'Todo' })
    );
  });

  it('covers comment guards and missing related rows', async () => {
    await documentServerMutators.addComment.fn({
      tx: makeTx() as never,
      ctx,
      args: { id: 'comment-no-thread', thread_id: null } as never,
    });

    await documentServerMutators.addComment.fn({
      tx: makeTx({ id: 'thread' }) as never,
      ctx,
      args: { id: 'comment-empty-thread', thread_id: 'thread' } as never,
    });

    const missing = makeTx(
      { amendment_id: 'amd', blog_id: 'blog', statement_id: 'statement', todo_id: 'todo' },
      null,
      undefined,
      undefined,
      null,
      null,
      []
    );
    await documentServerMutators.addComment.fn({
      tx: missing as never,
      ctx,
      args: { id: 'comment-missing', thread_id: 'thread' } as never,
    });
    expect(missing.mutate.amendment.update).not.toHaveBeenCalled();
    expect(missing.mutate.statement.update).not.toHaveBeenCalled();
  });

  it('recomputes thread vote counters and guards missing update/delete votes', async () => {
    const votes = [{ vote: 1 }, { vote: -1 }, { vote: 0 }];
    const created = makeTx(votes);
    await documentServerMutators.voteThread.fn({
      tx: created as never,
      ctx,
      args: { id: 'vote', thread_id: 'thread', vote: 1 } as never,
    });
    expect(created.mutate.thread.update).toHaveBeenCalledWith(
      expect.objectContaining({ upvotes: 1, downvotes: 1 })
    );

    for (const name of ['updateThreadVote', 'deleteThreadVote'] as const) {
      await documentServerMutators[name].fn({
        tx: makeTx(null) as never,
        ctx,
        args: { id: 'missing' } as never,
      });
      const tx = makeTx({ thread_id: 'thread' }, votes);
      await documentServerMutators[name].fn({
        tx: tx as never,
        ctx,
        args: { id: 'vote' } as never,
      });
      expect(tx.mutate.thread.update).toHaveBeenCalled();
    }
  });

  it('recomputes comment vote counters and guards missing update/delete votes', async () => {
    const votes = [{ vote: 1 }, { vote: -1 }, { vote: 0 }];
    const created = makeTx(votes);
    await documentServerMutators.voteComment.fn({
      tx: created as never,
      ctx,
      args: { id: 'vote', comment_id: 'comment', vote: 1 } as never,
    });
    expect(created.mutate.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({ upvotes: 1, downvotes: 1 })
    );

    for (const name of ['updateCommentVote', 'deleteCommentVote'] as const) {
      await documentServerMutators[name].fn({
        tx: makeTx(null) as never,
        ctx,
        args: { id: 'missing' } as never,
      });
      const tx = makeTx({ comment_id: 'comment' }, votes);
      await documentServerMutators[name].fn({
        tx: tx as never,
        ctx,
        args: { id: 'vote' } as never,
      });
      expect(tx.mutate.comment.update).toHaveBeenCalled();
    }
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const auth = vi.hoisted(() => ({
  can: vi.fn(),
  canReadVisibility: vi.fn(),
  denyPublicApiMutation: vi.fn(),
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => auth.can(...args),
}));

vi.mock('../../rbac/authorize', () => ({
  canReadVisibility: (...args: unknown[]) => auth.canReadVisibility(...args),
  denyPublicApiMutation: (...args: unknown[]) => auth.denyPublicApiMutation(...args),
  requireAuthenticated: (...args: unknown[]) => auth.requireAuthenticated(...args),
  requireOwner: (...args: unknown[]) => auth.requireOwner(...args),
}));

import { assertCanViewBlog, blogSharedMutators } from '../shared-mutators';

type CreateInput = Parameters<typeof blogSharedMutators.create.fn>[0];
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
      blog: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      blog_blogger: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      blog_support_vote: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      role: { insert: vi.fn() },
      action_right: { insert: vi.fn() },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.can.mockResolvedValue(undefined);
  auth.canReadVisibility.mockReturnValue(false);
  vi.spyOn(Date, 'now').mockReturnValue(1234);
});

describe('blogSharedMutators A10 branch contracts', () => {
  it('allows client/public/relation and every group visibility path', async () => {
    await expect(assertCanViewBlog(createTx('client') as never, ctx, 'client-blog')).resolves.toBe(
      undefined
    );

    const missing = createTx('server', [undefined]);
    await expect(assertCanViewBlog(missing as never, ctx, 'missing')).rejects.toThrow(
      'Blog not found'
    );

    auth.canReadVisibility.mockReturnValueOnce(true);
    const publicBlog = createTx('server', [{ id: 'public-blog', visibility: 'public' }]);
    await expect(
      assertCanViewBlog(publicBlog as never, ctx, 'public-blog')
    ).resolves.toBeUndefined();

    const relation = createTx('server', [
      { id: 'private-blog', visibility: 'private' },
      { id: 'relation-1' },
    ]);
    await expect(
      assertCanViewBlog(relation as never, ctx, 'private-blog')
    ).resolves.toBeUndefined();

    const groupPaths: [unknown, unknown, unknown][] = [
      [{ id: 'group-1' }, undefined, undefined],
      [undefined, { id: 'membership-1' }, undefined],
      [undefined, undefined, { id: 'guest-1' }],
    ];
    for (const groupRows of groupPaths) {
      const tx = createTx('server', [
        { id: 'group-blog', visibility: 'private', group_id: 'group-1' },
        undefined,
        ...groupRows,
      ]);
      await expect(assertCanViewBlog(tx as never, ctx, 'group-blog')).resolves.toBeUndefined();
    }

    const deniedWithoutGroup = createTx('server', [
      { id: 'private-blog', visibility: 'private', group_id: null },
      undefined,
    ]);
    await expect(
      assertCanViewBlog(deniedWithoutGroup as never, ctx, 'private-blog')
    ).rejects.toBeInstanceOf(PermissionError);

    const deniedGroup = createTx('server', [
      { id: 'group-blog', visibility: 'private', group_id: 'group-1' },
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    await expect(assertCanViewBlog(deniedGroup as never, ctx, 'group-blog')).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  it('creates standalone/group blogs and delegates createFull with deterministic counters', async () => {
    const standalone = createTx('server');
    await blogSharedMutators.create.fn({
      tx: standalone as never,
      ctx,
      args: { id: 'blog-1', group_id: null, title: 'Standalone' } as never,
    });
    expect(auth.can).not.toHaveBeenCalled();
    expect(standalone.mutate.blog.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'blog-1',
        subscriber_count: 0,
        supporter_count: 0,
        upvotes: 0,
        downvotes: 0,
        created_at: 1234,
        updated_at: 1234,
      })
    );

    const group = createTx('server');
    await blogSharedMutators.create.fn({
      tx: group as never,
      ctx,
      args: { id: 'blog-2', group_id: 'group-1', title: 'Group' } as never,
    });
    expect(auth.can).toHaveBeenCalledWith(
      group,
      ctx,
      expect.objectContaining({ action: 'create', groupId: 'group-1' })
    );

    const full = createTx('client');
    await blogSharedMutators.createFull.fn({
      tx: full as never,
      ctx,
      args: { blog: { id: 'blog-3', group_id: null, title: 'Full' } } as never,
    });
    expect(full.mutate.blog.insert).toHaveBeenCalled();
  });

  it('updates and deletes through server authorization and client parity', async () => {
    const server = createTx('server');
    await blogSharedMutators.update.fn({
      tx: server as never,
      ctx,
      args: { id: 'blog-1', title: 'Updated' } as never,
    });
    await blogSharedMutators.delete.fn({ tx: server as never, ctx, args: { id: 'blog-1' } });
    expect(auth.can).toHaveBeenCalledWith(
      server,
      ctx,
      expect.objectContaining({ action: 'update', resource: 'blogs', blogId: 'blog-1' })
    );
    expect(auth.can).toHaveBeenCalledWith(
      server,
      ctx,
      expect.objectContaining({ action: 'delete', resource: 'blogs', blogId: 'blog-1' })
    );

    auth.can.mockClear();
    const client = createTx('client');
    await blogSharedMutators.update.fn({
      tx: client as never,
      ctx,
      args: { id: 'blog-client', title: 'Optimistic' } as never,
    });
    await blogSharedMutators.delete.fn({
      tx: client as never,
      ctx,
      args: { id: 'blog-client' },
    });
    expect(auth.can).not.toHaveBeenCalled();
  });

  it('creates self requests through view access and managed invitations otherwise', async () => {
    auth.canReadVisibility.mockReturnValue(true);
    const self = createTx('server', [{ id: 'blog-1', visibility: 'public' }]);
    await blogSharedMutators.createEntry.fn({
      tx: self as never,
      ctx,
      args: { id: 'entry-1', blog_id: 'blog-1', user_id: 'user-1', status: 'requested' } as never,
    });
    expect(self.mutate.blog_blogger.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'entry-1', created_at: 1234 })
    );

    const manager = createTx('server');
    await blogSharedMutators.createEntry.fn({
      tx: manager as never,
      ctx,
      args: { id: 'entry-2', blog_id: 'blog-1', user_id: 'user-2', status: 'invited' } as never,
    });
    await blogSharedMutators.createEntry.fn({
      tx: manager as never,
      ctx,
      args: { id: 'entry-3', blog_id: 'blog-1', user_id: 'user-1', status: 'active' } as never,
    });
    expect(auth.can).toHaveBeenCalledTimes(2);
  });

  it('handles update-entry client, missing relation, self status, role and visibility management', async () => {
    const client = createTx('client');
    await blogSharedMutators.updateEntry.fn({
      tx: client as never,
      ctx,
      args: { id: 'client-entry', status: 'active' } as never,
    });

    const missing = createTx('server', [undefined]);
    await expect(
      blogSharedMutators.updateEntry.fn({
        tx: missing as never,
        ctx,
        args: { id: 'missing', status: 'active' } as never,
      })
    ).rejects.toThrow('Blog relation not found');

    const self = createTx('server', [{ id: 'entry-1', user_id: 'user-1', blog_id: 'blog-1' }]);
    await blogSharedMutators.updateEntry.fn({
      tx: self as never,
      ctx,
      args: { id: 'entry-1', status: 'active' } as never,
    });
    expect(auth.can).not.toHaveBeenCalled();

    for (const [index, args] of [
      { id: 'entry-2', status: 'active', role_id: 'role-1' },
      { id: 'entry-3', status: 'active', visibility: 'private' },
      { id: 'entry-4', status: 'active' },
    ].entries()) {
      const tx = createTx('server', [
        { id: args.id, user_id: index === 2 ? 'other' : 'user-1', blog_id: 'blog-1' },
      ]);
      await blogSharedMutators.updateEntry.fn({ tx: tx as never, ctx, args: args as never });
    }
    expect(auth.can).toHaveBeenCalledTimes(3);
  });

  it('handles delete-entry client, missing relation, self delete and manager delete', async () => {
    const client = createTx('client');
    await blogSharedMutators.deleteEntry.fn({
      tx: client as never,
      ctx,
      args: { id: 'client-entry' },
    });

    const missing = createTx('server', [undefined]);
    await expect(
      blogSharedMutators.deleteEntry.fn({ tx: missing as never, ctx, args: { id: 'missing' } })
    ).rejects.toThrow('Blog relation not found');

    const self = createTx('server', [{ id: 'entry-1', user_id: 'user-1', blog_id: 'blog-1' }]);
    await blogSharedMutators.deleteEntry.fn({ tx: self as never, ctx, args: { id: 'entry-1' } });

    const managed = createTx('server', [{ id: 'entry-2', user_id: 'other', blog_id: 'blog-1' }]);
    await blogSharedMutators.deleteEntry.fn({
      tx: managed as never,
      ctx,
      args: { id: 'entry-2' },
    });
    expect(auth.can).toHaveBeenCalledOnce();
  });

  it('creates support votes and validates update/delete ownership on client and server', async () => {
    auth.canReadVisibility.mockReturnValue(true);
    const create = createTx('server', [{ id: 'blog-1', visibility: 'public' }]);
    await blogSharedMutators.createSupportVote.fn({
      tx: create as never,
      ctx,
      args: { id: 'vote-1', blog_id: 'blog-1', vote: 1 } as never,
    });
    expect(create.mutate.blog_support_vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vote-1', user_id: 'user-1', created_at: 1234 })
    );

    const client = createTx('client');
    await blogSharedMutators.updateSupportVote.fn({
      tx: client as never,
      ctx,
      args: { id: 'vote-client', vote: -1 },
    });
    await blogSharedMutators.deleteSupportVote.fn({
      tx: client as never,
      ctx,
      args: { id: 'vote-client' },
    });

    const serverUpdate = createTx('server', [{ id: 'vote-2', user_id: 'user-1' }]);
    await blogSharedMutators.updateSupportVote.fn({
      tx: serverUpdate as never,
      ctx,
      args: { id: 'vote-2', vote: 1 },
    });
    const serverDelete = createTx('server', [undefined]);
    await blogSharedMutators.deleteSupportVote.fn({
      tx: serverDelete as never,
      ctx,
      args: { id: 'vote-3' },
    });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      serverDelete,
      ctx,
      undefined,
      expect.objectContaining({ action: 'delete' })
    );
  });

  it('creates roles with defaults and explicit values and rejects missing blog scope', async () => {
    const defaults = createTx('server');
    await blogSharedMutators.createRole.fn({
      tx: defaults as never,
      ctx,
      args: { id: 'role-1', blog_id: 'blog-1', name: 'Writer' } as never,
    });
    expect(defaults.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        assignee_kind: 'member',
        assignment_mode: 'assigned',
        visibility: 'public',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        default_request_role: false,
        default_invite_role: false,
        sort_order: 0,
      })
    );

    const explicit = createTx('server');
    await blogSharedMutators.createRole.fn({
      tx: explicit as never,
      ctx,
      args: {
        id: 'role-2',
        blog_id: 'blog-1',
        name: 'Editor',
        assignee_kind: 'role',
        assignment_mode: 'elected',
        visibility: 'private',
        term_start_date: 1,
        is_recurring: true,
        recurrence_pattern: 'weekly',
        recurrence_rule: 'rule',
        recurrence_interval: 2,
        recurrence_days: ['monday'],
        recurrence_end_date: 3,
        scheduled_revote_date: 4,
        default_request_role: true,
        default_invite_role: true,
        sort_order: 5,
      } as never,
    });
    expect(explicit.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_kind: 'role', sort_order: 5 })
    );

    const missing = createTx('server');
    await blogSharedMutators.createRole.fn({
      tx: missing as never,
      ctx,
      args: { id: 'role-3', blog_id: null, name: 'Invalid' } as never,
    });
    expect(auth.denyPublicApiMutation).toHaveBeenCalledWith(
      missing,
      expect.objectContaining({ resource: 'roles', scope: 'blog required' })
    );
  });

  it('assigns scoped action rights and invokes the public mutation denial without a blog', async () => {
    const scoped = createTx('server');
    await blogSharedMutators.assignActionRight.fn({
      tx: scoped as never,
      ctx,
      args: { id: 'right-1', blog_id: 'blog-1', action: 'update' } as never,
    });
    expect(scoped.mutate.action_right.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'right-1', created_at: 1234 })
    );

    const missing = createTx('server');
    await blogSharedMutators.assignActionRight.fn({
      tx: missing as never,
      ctx,
      args: { id: 'right-2', blog_id: null, action: 'update' } as never,
    });
    expect(auth.denyPublicApiMutation).toHaveBeenCalledWith(
      missing,
      expect.objectContaining({ resource: 'actionRights', scope: 'blog required' })
    );
  });
});

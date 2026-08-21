import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shared: {
    create: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createSupportVote: vi.fn(),
    updateSupportVote: vi.fn(),
    deleteSupportVote: vi.fn(),
  },
  fire: vi.fn(),
  userName: vi.fn(async () => 'Sender'),
  recompute: vi.fn(async () => undefined),
  hashtags: vi.fn(async () => undefined),
}));

vi.mock('@rocicorp/zero', () => ({
  defineMutator: (_schema: unknown, fn: (...args: any[]) => unknown) => ({ fn }),
}));
vi.mock('../../mutators', () => ({
  mutators: {
    blogs: Object.fromEntries(Object.entries(mocks.shared).map(([key, fn]) => [key, { fn }])),
  },
}));
vi.mock('../../schema', () => {
  const table = new Proxy(
    {},
    {
      get: (_target, property) => ({
        table: property,
        where() {
          return this;
        },
        one() {
          return this;
        },
      }),
    }
  );
  return { zql: table };
});
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fire }));
vi.mock('../../server-helpers', () => ({
  userName: (...args: unknown[]) => (mocks.userName as (...values: unknown[]) => unknown)(...args),
  recomputeBlogCounters: (...args: unknown[]) =>
    (mocks.recompute as (...values: unknown[]) => unknown)(...args),
}));
vi.mock('../../common/server-hashtags', () => ({
  syncEntityHashtagsForCreate: (...args: unknown[]) =>
    (mocks.hashtags as (...values: unknown[]) => unknown)(...args),
}));
vi.mock('../../rbac/constants', () => ({
  DEFAULT_BLOG_ROLES: [
    {
      name: 'Owner',
      description: 'Owns',
      permissions: [{ resource: 'blogs', action: 'manage' }],
    },
    { name: 'Writer', description: 'Writes', permissions: [] },
  ],
}));
vi.mock('../schema', () => ({
  createBlogSchema: {},
  createBlogFullMutatorSchema: {},
  createBlogBloggerSchema: {},
  updateBlogBloggerSchema: {},
  deleteBlogBloggerSchema: {},
  updateBlogSchema: {},
  deleteBlogSchema: {},
}));
vi.mock('../../votes/schema', () => ({
  createBlogSupportVoteSchema: {},
  updateBlogSupportVoteSchema: {},
  deleteBlogSupportVoteSchema: {},
}));

import { blogServerMutators } from '../server-mutators';

function transaction(rows: unknown[] = []) {
  const queue = [...rows];
  return {
    run: vi.fn(async () => queue.shift()),
    mutate: {
      role: { insert: vi.fn(async () => undefined) },
      action_right: { insert: vi.fn(async () => undefined) },
      blog_blogger: { insert: vi.fn(async () => undefined) },
      timeline_event: { insert: vi.fn(async () => undefined) },
    },
  } as any;
}

const ctx = { userID: 'actor' } as any;

async function invoke(name: keyof typeof blogServerMutators, tx: any, args: any) {
  return blogServerMutators[name].fn({ tx, ctx, args } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mocks.shared).forEach(fn => fn.mockResolvedValue(undefined));
  vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
    .mockReturnValue('00000000-0000-4000-8000-000000000004');
});

describe('blog server mutators', () => {
  it('delegates creator RBAC bootstrap without duplicate server inserts', async () => {
    const tx = transaction();
    await invoke('create', tx, { id: 'blog-1' });

    expect(mocks.shared.create).toHaveBeenCalled();
    expect(tx.mutate.role.insert).not.toHaveBeenCalled();
    expect(tx.mutate.action_right.insert).not.toHaveBeenCalled();
    expect(tx.mutate.blog_blogger.insert).not.toHaveBeenCalled();

    const explicit = transaction();
    await invoke('create', explicit, { id: 'blog-2', visibility: 'private' });
    expect(mocks.shared.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ args: expect.objectContaining({ visibility: 'private' }) })
    );
  });

  it('creates full blogs with optional timeline events', async () => {
    const withoutTimeline = transaction();
    await invoke('createFull', withoutTimeline, {
      blog: { id: 'blog-1', visibility: 'public' },
      hashtags: ['one'],
    });
    expect(mocks.hashtags).toHaveBeenCalledWith(withoutTimeline, ctx, 'blog', 'blog-1', ['one']);
    expect(withoutTimeline.mutate.timeline_event.insert).not.toHaveBeenCalled();

    const withTimeline = transaction();
    await invoke('createFull', withTimeline, {
      blog: { id: 'blog-2', visibility: 'public' },
      hashtags: [],
      timeline_event: { id: 'timeline-1', type: 'blog_created' },
    });
    expect(withTimeline.mutate.timeline_event.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'timeline-1', created_at: expect.any(Number) })
    );
  });

  it('notifies invitations and requests with complete and missing blog context', async () => {
    const invited = transaction([{ title: 'News', group_id: 'group-1' }, { user_id: 'owner-1' }]);
    await invoke('createEntry', invited, {
      id: 'entry-1',
      blog_id: 'blog-1',
      user_id: 'invitee',
      status: 'invited',
    });
    expect(mocks.fire).toHaveBeenCalledWith(
      'notifyBloggerInvited',
      expect.objectContaining({ blogTitle: 'News', groupId: 'group-1', ownerId: 'owner-1' })
    );

    const requested = transaction([null, null]);
    await invoke('createEntry', requested, {
      id: 'entry-2',
      blog_id: 'blog-2',
      user_id: 'actor',
      status: 'requested',
    });
    expect(mocks.fire).toHaveBeenCalledWith(
      'notifyBlogWriterRequest',
      expect.objectContaining({ blogTitle: 'Blog', groupId: undefined, ownerId: undefined })
    );

    mocks.fire.mockClear();
    await invoke('createEntry', transaction([{}, {}]), {
      id: 'entry-3',
      blog_id: 'blog-3',
      user_id: 'actor',
      status: 'member',
    });
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('handles missing, accepted, approved, unchanged, and role-updated blogger entries', async () => {
    await invoke('updateEntry', transaction([null]), { id: 'missing' });

    const selfAccepted = transaction([
      { id: 'entry-1', blog_id: 'blog-1', user_id: 'actor', status: 'invited', role_id: 'old' },
      { title: 'News' },
      { user_id: 'owner' },
    ]);
    await invoke('updateEntry', selfAccepted, { id: 'entry-1', status: 'member' });
    expect(mocks.fire).toHaveBeenCalledWith(
      'notifyBlogInvitationAccepted',
      expect.objectContaining({ senderId: 'actor' })
    );

    const approved = transaction([
      { id: 'entry-2', blog_id: 'blog-2', user_id: 'writer', status: 'requested', role_id: 'old' },
      { title: 'Blog 2' },
      { user_id: 'owner' },
    ]);
    await invoke('updateEntry', approved, { id: 'entry-2', status: 'writer' });
    expect(mocks.fire).toHaveBeenCalledWith(
      'notifyBlogWriterApproved',
      expect.objectContaining({ recipientUserId: 'writer' })
    );

    mocks.fire.mockClear();
    const unchanged = transaction([
      { id: 'entry-3', blog_id: 'blog-3', user_id: 'writer', status: 'member', role_id: 'role-1' },
      {},
      {},
    ]);
    await invoke('updateEntry', unchanged, { id: 'entry-3', status: 'member' });
    await invoke(
      'updateEntry',
      transaction([
        { id: 'entry-4', blog_id: 'blog-4', user_id: 'writer', status: 'other', role_id: 'role-1' },
        {},
        {},
      ]),
      { id: 'entry-4', status: 'member', role_id: 'role-1' }
    );
    expect(mocks.fire).not.toHaveBeenCalled();

    const newRole = transaction([
      { id: 'entry-5', blog_id: 'blog-5', user_id: 'writer', status: 'member', role_id: 'old' },
      { title: 'Five' },
      { user_id: 'owner' },
      { name: 'Editor' },
    ]);
    await invoke('updateEntry', newRole, { id: 'entry-5', role_id: 'new' });
    expect(mocks.fire).toHaveBeenCalledWith(
      'notifyBloggerRoleChanged',
      expect.objectContaining({ newRole: 'Editor' })
    );

    const clearedRole = transaction([
      { id: 'entry-6', blog_id: 'blog-6', user_id: 'writer', status: 'member', role_id: 'old' },
      {},
      {},
    ]);
    await invoke('updateEntry', clearedRole, { id: 'entry-6', role_id: null });
    expect(mocks.fire).toHaveBeenCalledWith(
      'notifyBloggerRoleChanged',
      expect.objectContaining({ newRole: 'Writer' })
    );
  });

  it.each([
    ['requested', 'notifyBlogRequestWithdrawn'],
    ['invited', 'notifyBlogInvitationDeclined'],
    ['member', 'notifyBlogWriterLeft'],
  ])('notifies self deletion for %s', async (status, notification) => {
    const tx = transaction([
      { id: 'entry', blog_id: 'blog', user_id: 'actor', status },
      { title: 'Blog' },
      { user_id: 'owner' },
    ]);
    await invoke('deleteEntry', tx, { id: 'entry' });
    expect(mocks.fire).toHaveBeenCalledWith(
      notification,
      expect.objectContaining({ blogId: 'blog' })
    );
  });

  it('handles missing and moderator-deleted blogger entries', async () => {
    await invoke('deleteEntry', transaction([null]), { id: 'missing' });
    const tx = transaction([
      { id: 'entry', blog_id: 'blog', user_id: 'writer', status: 'member' },
      { title: 'Blog' },
      { user_id: 'owner' },
    ]);
    await invoke('deleteEntry', tx, { id: 'entry' });
    expect(mocks.fire).toHaveBeenCalledWith(
      'notifyBlogWriterRemoved',
      expect.objectContaining({ recipientUserId: 'writer' })
    );
  });

  it('detects every profile field and distinguishes publication from regular updates', async () => {
    const previous = {
      title: 'Old',
      description: 'Old description',
      date: 1,
      image_url: 'old.png',
      video_url: 'old.mp4',
      visibility: 'private',
    };

    await invoke('update', transaction([null]), { id: 'missing', title: 'New' });
    mocks.fire.mockClear();
    await invoke('update', transaction([previous]), { id: 'same' });
    expect(mocks.fire).not.toHaveBeenCalled();

    for (const args of [
      { title: 'New' },
      { description: 'New description' },
      { date: 2 },
      { image_url: 'new.png' },
      { video_url: 'new.mp4' },
    ]) {
      await invoke('update', transaction([previous, { title: 'Context' }, { user_id: 'owner' }]), {
        id: 'blog',
        ...args,
      });
      expect(mocks.fire).toHaveBeenLastCalledWith(
        'notifyBlogUpdated',
        expect.objectContaining({ blogTitle: args.title ?? 'Context' })
      );
    }

    await invoke('update', transaction([previous, { title: 'Context' }, { user_id: 'owner' }]), {
      id: 'blog',
      visibility: 'public',
    });
    expect(mocks.fire).toHaveBeenLastCalledWith(
      'notifyBlogPublished',
      expect.objectContaining({ blogTitle: 'Context' })
    );

    await invoke(
      'update',
      transaction([{ ...previous, visibility: 'public' }, { title: 'Context' }, {}]),
      { id: 'blog', visibility: 'private' }
    );
    expect(mocks.fire).toHaveBeenLastCalledWith('notifyBlogUpdated', expect.any(Object));
  });

  it('notifies deletion with loaded context', async () => {
    const tx = transaction([{ title: 'Delete me' }, { user_id: 'owner' }]);
    await invoke('delete', tx, { id: 'blog' });
    expect(mocks.shared.delete).toHaveBeenCalled();
    expect(mocks.fire).toHaveBeenCalledWith('notifyBlogDeleted', {
      senderId: 'actor',
      blogId: 'blog',
      blogTitle: 'Delete me',
    });
  });

  it('creates positive-default and negative support votes', async () => {
    await invoke('createSupportVote', transaction([{ title: 'Blog' }, { user_id: 'owner' }]), {
      id: 'vote-1',
      blog_id: 'blog',
      vote: null,
    });
    expect(mocks.fire).toHaveBeenLastCalledWith(
      'notifyBlogVoted',
      expect.objectContaining({ voteType: 'upvote' })
    );

    await invoke('createSupportVote', transaction([{ title: 'Blog' }, { user_id: 'owner' }]), {
      id: 'vote-2',
      blog_id: 'blog',
      vote: -1,
    });
    expect(mocks.fire).toHaveBeenLastCalledWith(
      'notifyBlogVoted',
      expect.objectContaining({ voteType: 'downvote' })
    );
  });

  it('updates votes only when a persisted blog and changed value exist', async () => {
    await invoke('updateSupportVote', transaction([null]), { id: 'missing', vote: 1 });
    await invoke('updateSupportVote', transaction([{ blog_id: null, vote: 1 }]), {
      id: 'orphan',
      vote: -1,
    });
    await invoke('updateSupportVote', transaction([{ blog_id: 'blog', vote: 1 }]), {
      id: 'same',
      vote: 1,
    });
    await invoke('updateSupportVote', transaction([{ blog_id: 'blog', vote: 1 }]), {
      id: 'undefined',
    });

    await invoke(
      'updateSupportVote',
      transaction([{ blog_id: 'blog', vote: 1 }, { title: 'Blog' }, { user_id: 'owner' }]),
      { id: 'changed', vote: -1 }
    );
    expect(mocks.fire).toHaveBeenLastCalledWith(
      'notifyBlogVoted',
      expect.objectContaining({ voteType: 'downvote' })
    );
    await invoke(
      'updateSupportVote',
      transaction([{ blog_id: 'blog', vote: -1 }, { title: 'Blog' }, { user_id: 'owner' }]),
      { id: 'changed-up', vote: null }
    );
    expect(mocks.fire).toHaveBeenLastCalledWith(
      'notifyBlogVoted',
      expect.objectContaining({ voteType: 'upvote' })
    );
  });

  it('deletes support votes with and without a persisted blog', async () => {
    await invoke('deleteSupportVote', transaction([null]), { id: 'missing' });
    await invoke('deleteSupportVote', transaction([{ blog_id: null }]), { id: 'orphan' });
    await invoke('deleteSupportVote', transaction([{ blog_id: 'blog' }]), { id: 'vote' });
    expect(mocks.recompute).toHaveBeenCalledWith(expect.any(Object), 'blog');
  });
});

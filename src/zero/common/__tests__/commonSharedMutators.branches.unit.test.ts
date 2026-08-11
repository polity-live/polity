import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  can: vi.fn(),
  denyPublicApiMutation: vi.fn(),
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
  requireSelf: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({ can: auth.can }));
vi.mock('../../rbac/authorize', () => ({
  denyPublicApiMutation: auth.denyPublicApiMutation,
  requireAuthenticated: auth.requireAuthenticated,
  requireOwner: auth.requireOwner,
  requireSelf: auth.requireSelf,
}));
vi.mock('../../rbac/query-access', () => ({
  applyAmendmentQueryAccess: (query: unknown) => query,
  applyBlogQueryAccess: (query: unknown) => query,
  applyEventQueryAccess: (query: unknown) => query,
  applyGroupQueryAccess: (query: unknown) => query,
  applyUserQueryAccess: (query: unknown) => query,
}));

import { commonSharedMutators } from '../shared-mutators';

function createTx(location: 'client' | 'server' = 'server') {
  const tables = [
    'subscriber',
    'hashtag',
    'user_hashtag',
    'group_hashtag',
    'amendment_hashtag',
    'event_hashtag',
    'blog_hashtag',
    'statement_hashtag',
    'link',
    'reaction',
    'timeline_event',
  ];
  return {
    location,
    run: vi.fn(),
    mutate: Object.fromEntries(
      tables.map(table => [table, { insert: vi.fn(), delete: vi.fn(), update: vi.fn() }])
    ),
  };
}

const ctx = { userID: 'user-1', email: 'user@example.com' };

beforeEach(() => vi.clearAllMocks());

describe('commonSharedMutators full branch contract', () => {
  it('creates and deletes canonical hashtags and subscribes on the client fast path', async () => {
    const tx = createTx('client');
    await commonSharedMutators.subscribe.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'subscriber',
        user_id: 'target',
        group_id: 'group',
        amendment_id: 'amendment',
        event_id: 'event',
        blog_id: 'blog',
      },
    });
    await commonSharedMutators.unsubscribe.fn({ tx: tx as never, ctx, args: { id: 'subscriber' } });
    await commonSharedMutators.addHashtag.fn({
      tx: tx as never,
      ctx,
      args: { id: 'tag', tag: 'tag' },
    });
    await commonSharedMutators.deleteHashtag.fn({ tx: tx as never, ctx, args: { id: 'tag' } });
    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.subscriber.insert).toHaveBeenCalled();
    expect(tx.mutate.hashtag.delete).toHaveBeenCalled();
  });

  it('validates every subscription target and each hidden-target error', async () => {
    const allTargets = {
      id: 'subscriber',
      user_id: 'target',
      group_id: 'group',
      amendment_id: 'amendment',
      event_id: 'event',
      blog_id: 'blog',
    };
    const tx = createTx('server');
    tx.run.mockResolvedValue({ id: 'visible' });
    await commonSharedMutators.subscribe.fn({ tx: tx as never, ctx, args: allTargets });
    expect(tx.run).toHaveBeenCalledTimes(5);

    for (const field of ['user_id', 'group_id', 'amendment_id', 'event_id', 'blog_id'] as const) {
      const hiddenTx = createTx('server');
      hiddenTx.run.mockResolvedValue(null);
      await expect(
        commonSharedMutators.subscribe.fn({
          tx: hiddenTx as never,
          ctx,
          args: {
            id: `hidden-${field}`,
            user_id: null,
            group_id: null,
            amendment_id: null,
            event_id: null,
            blog_id: null,
            [field]: 'hidden',
          },
        })
      ).rejects.toThrow();
    }
  });

  it('checks server unsubscribe ownership with present and missing subscriber rows', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({ subscriber_id: 'user-1' }).mockResolvedValueOnce(null);
    await commonSharedMutators.unsubscribe.fn({ tx: tx as never, ctx, args: { id: 'owned' } });
    await commonSharedMutators.unsubscribe.fn({ tx: tx as never, ctx, args: { id: 'missing' } });
    expect(auth.requireOwner).toHaveBeenCalledWith(
      tx,
      ctx,
      undefined,
      expect.objectContaining({ action: 'delete' })
    );
  });

  it('links every hashtag junction and exercises client/server unlink checks', async () => {
    const createCases = [
      ['linkUserHashtag', { id: 'user-link', user_id: 'user-1', hashtag_id: 'tag' }],
      ['linkGroupHashtag', { id: 'group-link', group_id: 'group-1', hashtag_id: 'tag' }],
      [
        'linkAmendmentHashtag',
        { id: 'amendment-link', amendment_id: 'amendment-1', hashtag_id: 'tag' },
      ],
      ['linkEventHashtag', { id: 'event-link', event_id: 'event-1', hashtag_id: 'tag' }],
      ['linkBlogHashtag', { id: 'blog-link', blog_id: 'blog-1', hashtag_id: 'tag' }],
      [
        'linkStatementHashtag',
        { id: 'statement-link', statement_id: 'statement-1', hashtag_id: 'tag' },
      ],
    ] as const;
    const clientTx = createTx('client');
    for (const [name, args] of createCases) {
      await (commonSharedMutators[name].fn as any)({ tx: clientTx, ctx, args });
    }

    const serverStatementTx = createTx('server');
    serverStatementTx.run.mockResolvedValue({ user_id: 'user-1' });
    await commonSharedMutators.linkStatementHashtag.fn({
      tx: serverStatementTx as never,
      ctx,
      args: { id: 'statement-server', statement_id: 'statement-1', hashtag_id: 'tag' },
    });

    const unlinkCases = [
      ['unlinkUserHashtag', { user_id: 'user-1' }],
      ['unlinkGroupHashtag', { group_id: 'group-1' }],
      ['unlinkAmendmentHashtag', { amendment_id: 'amendment-1' }],
      ['unlinkEventHashtag', { event_id: 'event-1' }],
      ['unlinkBlogHashtag', { blog_id: 'blog-1' }],
      ['unlinkStatementHashtag', { statement_id: 'statement-1' }],
    ] as const;
    for (const [name] of unlinkCases) {
      await (commonSharedMutators[name].fn as any)({
        tx: clientTx,
        ctx,
        args: { id: `${name}-client` },
      });
    }
    for (const [name, row] of unlinkCases) {
      const serverTx = createTx('server');
      serverTx.run.mockResolvedValueOnce(row).mockResolvedValueOnce({ user_id: 'user-1' });
      await (commonSharedMutators[name].fn as any)({
        tx: serverTx,
        ctx,
        args: { id: `${name}-server` },
      });

      const emptyTx = createTx('server');
      emptyTx.run.mockResolvedValue(null);
      await (commonSharedMutators[name].fn as any)({
        tx: emptyTx,
        ctx,
        args: { id: `${name}-empty` },
      });
    }
    expect(auth.can).toHaveBeenCalled();
    expect(auth.requireSelf).toHaveBeenCalled();
    expect(auth.requireOwner).toHaveBeenCalled();
  });

  it('authorizes all link owner scopes and rejects ownerless server creates', async () => {
    const tx = createTx('server');
    await commonSharedMutators.createLink.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'all-scopes',
        label: 'Link',
        url: 'https://example.com',
        user_id: 'user-1',
        group_id: 'group-1',
        event_id: 'event-1',
      },
    });
    await expect(
      commonSharedMutators.createLink.fn({
        tx: tx as never,
        ctx,
        args: {
          id: 'ownerless',
          label: 'Link',
          url: 'https://example.com',
          user_id: null,
          group_id: null,
          event_id: null,
        },
      })
    ).rejects.toThrow();

    const clientTx = createTx('client');
    await commonSharedMutators.createLink.fn({
      tx: clientTx as never,
      ctx,
      args: {
        id: 'ownerless-client',
        label: 'Link',
        url: 'https://example.com',
        user_id: null,
        group_id: null,
        event_id: null,
      },
    });
    expect(clientTx.mutate.link.insert).toHaveBeenCalled();
  });

  it('creates reactions/timeline events and checks server reaction deletion', async () => {
    const tx = createTx('server');
    await commonSharedMutators.createReaction.fn({
      tx: tx as never,
      ctx,
      args: { id: 'reaction', reaction: 'like' } as never,
    });
    await commonSharedMutators.createTimelineEvent.fn({
      tx: tx as never,
      ctx,
      args: { id: 'timeline' } as never,
    });
    tx.run.mockResolvedValue({ user_id: 'user-1' });
    await commonSharedMutators.deleteReaction.fn({
      tx: tx as never,
      ctx,
      args: { id: 'reaction' },
    });
    const clientTx = createTx('client');
    await commonSharedMutators.deleteReaction.fn({
      tx: clientTx as never,
      ctx,
      args: { id: 'reaction-client' },
    });
    expect(auth.denyPublicApiMutation).toHaveBeenCalled();
  });

  it('handles all server link-delete scopes, missing rows, and ownerless rows', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({
      group_id: 'group-1',
      user_id: 'user-1',
      event_id: 'event-1',
    });
    await commonSharedMutators.deleteLink.fn({ tx: tx as never, ctx, args: { id: 'owned' } });

    const missingTx = createTx('server');
    missingTx.run.mockResolvedValue(null);
    await expect(
      commonSharedMutators.deleteLink.fn({
        tx: missingTx as never,
        ctx,
        args: { id: 'missing' },
      })
    ).rejects.toThrow('Link not found');

    const ownerlessTx = createTx('server');
    ownerlessTx.run.mockResolvedValue({ group_id: null, user_id: null, event_id: null });
    await expect(
      commonSharedMutators.deleteLink.fn({
        tx: ownerlessTx as never,
        ctx,
        args: { id: 'ownerless' },
      })
    ).rejects.toThrow();

    const clientTx = createTx('client');
    await commonSharedMutators.deleteLink.fn({
      tx: clientTx as never,
      ctx,
      args: { id: 'client' },
    });
    expect(clientTx.mutate.link.delete).toHaveBeenCalled();
  });
});

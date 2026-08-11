import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCtx,
  createQueryHarness,
  createTxHarness,
  installDeterministicGlobals,
} from './test-utils/zeroHarness';

type MutatorRegistry = Record<string, { fn: (input: unknown) => unknown }>;

beforeEach(() => {
  vi.resetModules();
});

async function loadMutatorContext(options: { includeRegistries?: boolean } = {}) {
  const queryHarness = createQueryHarness();
  const canMock = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
  const requireAuthenticatedMock = vi.fn<(...args: unknown[]) => void>(() => undefined);
  const requireOwnerMock = vi.fn<(...args: unknown[]) => void>(() => undefined);

  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
    defineMutator: (_schema: unknown, fn: unknown) => ({ fn }),
    defineMutators: (...registries: unknown[]) =>
      registries.reduce<Record<string, unknown>>((merged, registry) => {
        if (registry && typeof registry === 'object') {
          Object.assign(merged, registry);
        }
        return merged;
      }, {}),
  }));
  vi.doMock('../schema', () => ({
    zql: queryHarness.zql,
  }));
  vi.doMock('../rbac/can', () => ({
    can: (...args: unknown[]) => canMock(...args),
  }));
  vi.doMock('../rbac/authorize', () => ({
    denyPublicApiMutation: vi.fn(),
    requireAuthenticated: (...args: unknown[]) => requireAuthenticatedMock(...args),
    requireOwner: (...args: unknown[]) => requireOwnerMock(...args),
  }));

  const [users, ai, preferences, calendarSubscriptions, pql] = await Promise.all([
    import('../users/shared-mutators'),
    import('../ai/shared-mutators'),
    import('../preferences/shared-mutators'),
    import('../calendar-subscriptions/shared-mutators'),
    import('../pql/shared-mutators'),
  ]);

  const [mutatorsRegistry, serverMutatorsRegistry] = options.includeRegistries
    ? await Promise.all([import('../mutators'), import('../server-mutators')])
    : [{ mutators: {} }, { serverMutators: {} }];

  return {
    canMock,
    requireAuthenticatedMock,
    requireOwnerMock,
    userSharedMutators: users.userSharedMutators as MutatorRegistry,
    aiSharedMutators: ai.aiSharedMutators as MutatorRegistry,
    preferenceSharedMutators: preferences.preferenceSharedMutators as MutatorRegistry,
    calendarSubscriptionSharedMutators:
      calendarSubscriptions.calendarSubscriptionSharedMutators as MutatorRegistry,
    pqlSharedMutators: pql.pqlSharedMutators as MutatorRegistry,
    mutators: mutatorsRegistry.mutators as Record<string, MutatorRegistry>,
    serverMutators: serverMutatorsRegistry.serverMutators as Record<string, MutatorRegistry>,
  };
}

function countMutators(registry: Record<string, unknown>): number {
  let count = 0;
  for (const value of Object.values(registry)) {
    if (value && typeof value === 'object' && 'fn' in value) {
      count += 1;
      continue;
    }
    if (value && typeof value === 'object') {
      count += countMutators(value as Record<string, unknown>);
    }
  }
  return count;
}

describe('Zero mutator contracts', () => {
  it('loads shared and server mutator registries without a database', async () => {
    const { mutators, serverMutators } = await loadMutatorContext({
      includeRegistries: true,
    });

    expect(Object.keys(mutators)).toEqual(
      expect.arrayContaining(['users', 'groups', 'events', 'amendments', 'network'])
    );
    expect(Object.keys(serverMutators)).toEqual(
      expect.arrayContaining(['groups', 'events', 'amendments', 'votes', 'network'])
    );
    expect(countMutators(mutators)).toBeGreaterThan(100);
    expect(countMutators(serverMutators)).toBeGreaterThan(100);
  }, 60_000);

  it('forces profile updates onto the authenticated user id', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_000_123 });
    const { userSharedMutators, requireAuthenticatedMock } = await loadMutatorContext();
    const { tx, mutation } = createTxHarness();

    await userSharedMutators.updateProfile.fn({
      tx,
      ctx: createCtx(),
      args: {
        id: 'attacker-user',
        first_name: 'Ada',
        visibility: 'public',
      },
    });

    expect(requireAuthenticatedMock).toHaveBeenCalledWith(
      tx,
      createCtx(),
      expect.objectContaining({ action: 'update', resource: '$users' })
    );
    expect(mutation('user', 'update')).toHaveBeenCalledWith({
      id: 'user-1',
      first_name: 'Ada',
      visibility: 'public',
      updated_at: 1_700_000_000_123,
    });

    globals.restore();
  });

  it('does not mutate when authentication rejects a shared mutator', async () => {
    const { userSharedMutators, requireAuthenticatedMock } = await loadMutatorContext();
    const { tx, mutation } = createTxHarness();
    const error = new Error('login required');
    requireAuthenticatedMock.mockImplementationOnce(() => {
      throw error;
    });

    await expect(
      userSharedMutators.follow.fn({
        tx,
        ctx: createCtx(),
        args: { id: 'follow-1', followee_id: 'user-2' },
      })
    ).rejects.toBe(error);

    expect(mutation('follow', 'insert')).not.toHaveBeenCalled();
  });

  it('defaults AI skill fields and stamps ownership without DB access', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_000_456 });
    const { aiSharedMutators } = await loadMutatorContext();
    const { tx, mutation } = createTxHarness();

    await aiSharedMutators.createSkill.fn({
      tx,
      ctx: createCtx(),
      args: {
        id: 'skill-1',
        name: 'Summarize',
        prompt: 'Summarize this',
      },
    });

    expect(mutation('ai_skill', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'skill-1',
        aliases: '',
        enabled: true,
        user_id: 'user-1',
        created_at: 1_700_000_000_456,
        updated_at: 1_700_000_000_456,
      })
    );

    globals.restore();
  });

  it('upserts user preferences when a preference row already exists', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_000_789 });
    const { preferenceSharedMutators } = await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();
    queueRunResults({ id: 'pref-existing', user_id: 'user-1' });

    await preferenceSharedMutators.create.fn({
      tx,
      ctx: createCtx(),
      args: {
        id: 'pref-new',
        locale: 'de',
        theme: 'dark',
      },
    });

    expect(mutation('user_preference', 'insert')).not.toHaveBeenCalled();
    expect(mutation('user_preference', 'update')).toHaveBeenCalledWith({
      id: 'pref-existing',
      locale: 'de',
      theme: 'dark',
      updated_at: 1_700_000_000_789,
    });

    globals.restore();
  });

  it('checks calendar subscription ownership before deleting on the server', async () => {
    const { calendarSubscriptionSharedMutators, requireOwnerMock } = await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();
    queueRunResults({ id: 'subscription-1', user_id: 'user-1' });

    await calendarSubscriptionSharedMutators.unsubscribe.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'subscription-1' },
    });

    expect(requireOwnerMock).toHaveBeenCalledWith(
      tx,
      createCtx(),
      'user-1',
      expect.objectContaining({
        action: 'delete',
        resource: 'calendarSubscriptions',
      })
    );
    expect(mutation('calendar_subscription', 'delete')).toHaveBeenCalledWith({
      id: 'subscription-1',
    });
  });

  it('checks group visibility before creating a group-scoped PQL filter', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_000_999 });
    const { pqlSharedMutators, canMock } = await loadMutatorContext();
    const { tx, mutation } = createTxHarness();

    await pqlSharedMutators.create.fn({
      tx,
      ctx: createCtx(),
      args: {
        id: 'filter-1',
        group_id: 'group-1',
        name: 'Important',
        query: 'status:open',
      },
    });

    expect(canMock).toHaveBeenCalledWith(
      tx,
      createCtx(),
      expect.objectContaining({
        action: 'view',
        resource: 'groups',
        groupId: 'group-1',
      })
    );
    expect(mutation('pql_filter', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'filter-1',
        user_id: 'user-1',
        group_id: 'group-1',
        created_at: 1_700_000_000_999,
        updated_at: 1_700_000_000_999,
      })
    );

    globals.restore();
  });

  it('stamps user ownership on follows and checks it before unfollowing', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_001_000 });
    const { userSharedMutators, requireAuthenticatedMock, requireOwnerMock } =
      await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();

    await userSharedMutators.follow.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'follow-1', followee_id: 'user-2' },
    });
    queueRunResults({ id: 'follow-1', follower_id: 'user-1' });
    await userSharedMutators.unfollow.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'follow-1' },
    });

    expect(requireAuthenticatedMock).toHaveBeenCalledWith(
      tx,
      createCtx(),
      expect.objectContaining({ action: 'create', resource: 'follows' })
    );
    expect(mutation('follow', 'insert')).toHaveBeenCalledWith({
      id: 'follow-1',
      followee_id: 'user-2',
      follower_id: 'user-1',
      created_at: 1_700_000_001_000,
    });
    expect(requireOwnerMock).toHaveBeenCalledWith(
      tx,
      createCtx(),
      'user-1',
      expect.objectContaining({ action: 'delete', resource: 'follows' })
    );
    expect(mutation('follow', 'delete')).toHaveBeenCalledWith({
      id: 'follow-1',
    });
    globals.restore();
  });

  it('skips the ownership lookup for optimistic client unfollows', async () => {
    const { userSharedMutators, requireOwnerMock } = await loadMutatorContext();
    const { tx, mutation } = createTxHarness({ location: 'client' });

    await userSharedMutators.unfollow.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'follow-1' },
    });

    expect(tx.run).not.toHaveBeenCalled();
    expect(requireOwnerMock).not.toHaveBeenCalled();
    expect(mutation('follow', 'delete')).toHaveBeenCalledWith({
      id: 'follow-1',
    });
  });

  it('covers the complete AI skill and tool ownership lifecycle', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_001_100 });
    const { aiSharedMutators, requireAuthenticatedMock, requireOwnerMock } =
      await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();

    await aiSharedMutators.createTool.fn({
      tx,
      ctx: createCtx(),
      args: {
        id: 'tool-1',
        name: 'Search',
        description: 'Search',
        type: 'http',
        config: {},
      },
    });
    queueRunResults(
      { id: 'skill-1', user_id: 'user-1' },
      { id: 'skill-1', user_id: 'user-1' },
      { id: 'tool-1', user_id: 'user-1' }
    );
    await aiSharedMutators.updateSkill.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'skill-1', name: 'Updated' },
    });
    await aiSharedMutators.deleteSkill.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'skill-1' },
    });
    await aiSharedMutators.updateTool.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'tool-1', enabled: false },
    });
    expect(requireAuthenticatedMock).toHaveBeenCalledWith(
      tx,
      createCtx(),
      expect.objectContaining({ action: 'create', resource: 'aiTools' })
    );
    expect(mutation('ai_tool', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tool-1',
        enabled: true,
        user_id: 'user-1',
        created_at: 1_700_000_001_100,
      })
    );
    expect(requireOwnerMock).toHaveBeenCalledTimes(3);
    expect(mutation('ai_skill', 'update')).toHaveBeenCalledWith({
      id: 'skill-1',
      name: 'Updated',
      updated_at: 1_700_000_001_100,
    });
    expect(mutation('ai_skill', 'delete')).toHaveBeenCalledWith({
      id: 'skill-1',
    });
    expect(mutation('ai_tool', 'update')).toHaveBeenCalledWith({
      id: 'tool-1',
      enabled: false,
      updated_at: 1_700_000_001_100,
    });
    globals.restore();
  });

  it('skips AI ownership lookups only for optimistic client updates', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_001_200 });
    const { aiSharedMutators, requireOwnerMock } = await loadMutatorContext();
    const { tx, mutation } = createTxHarness({ location: 'client' });

    await aiSharedMutators.updateSkill.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'skill-1', enabled: false },
    });
    await aiSharedMutators.updateTool.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'tool-1', enabled: false },
    });
    await aiSharedMutators.deleteSkill.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'skill-1' },
    });

    expect(tx.run).not.toHaveBeenCalled();
    expect(requireOwnerMock).not.toHaveBeenCalled();
    expect(mutation('ai_skill', 'update')).toHaveBeenCalledOnce();
    expect(mutation('ai_tool', 'update')).toHaveBeenCalledOnce();
    expect(mutation('ai_skill', 'delete')).toHaveBeenCalledOnce();
    globals.restore();
  });

  it('covers calendar subscription create, update and delete contracts', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_001_300 });
    const { calendarSubscriptionSharedMutators, requireAuthenticatedMock, requireOwnerMock } =
      await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();

    await calendarSubscriptionSharedMutators.subscribe.fn({
      tx,
      ctx: createCtx(),
      args: {
        id: 'subscription-1',
        target_type: 'group',
        target_group_id: 'group-1',
        target_user_id: null,
        is_visible: true,
        color: null,
      },
    });
    queueRunResults(
      { id: 'subscription-1', user_id: 'user-1' },
      { id: 'subscription-1', user_id: 'user-1' }
    );
    await calendarSubscriptionSharedMutators.update.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'subscription-1', color: '#123456' },
    });
    await calendarSubscriptionSharedMutators.unsubscribe.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'subscription-1' },
    });

    expect(requireAuthenticatedMock).toHaveBeenCalledOnce();
    expect(requireOwnerMock).toHaveBeenCalledTimes(2);
    expect(mutation('calendar_subscription', 'insert')).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        created_at: 1_700_000_001_300,
      })
    );
    expect(mutation('calendar_subscription', 'update')).toHaveBeenCalledWith({
      id: 'subscription-1',
      color: '#123456',
    });
    expect(mutation('calendar_subscription', 'delete')).toHaveBeenCalledWith({
      id: 'subscription-1',
    });
    globals.restore();
  });

  it('covers PQL update and delete ownership contracts', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_001_400 });
    const { pqlSharedMutators, requireOwnerMock } = await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();
    queueRunResults({ id: 'filter-1', user_id: 'user-1' }, { id: 'filter-1', user_id: 'user-1' });

    await pqlSharedMutators.update.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'filter-1', label: 'Updated' },
    });
    await pqlSharedMutators.delete.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'filter-1' },
    });

    expect(requireOwnerMock).toHaveBeenCalledTimes(2);
    expect(mutation('pql_filter', 'update')).toHaveBeenCalledWith({
      id: 'filter-1',
      label: 'Updated',
      updated_at: 1_700_000_001_400,
    });
    expect(mutation('pql_filter', 'delete')).toHaveBeenCalledWith({
      id: 'filter-1',
    });
    globals.restore();
  });

  it('recovers preference creation after a parallel unique-key race', async () => {
    const globals = installDeterministicGlobals({ now: 1_700_000_001_500 });
    const { preferenceSharedMutators } = await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();
    queueRunResults(undefined, {
      id: 'preference-existing',
      user_id: 'user-1',
    });
    mutation('user_preference', 'insert').mockRejectedValueOnce(
      new Error('user_preference_user_id_key user_preference_user_id_key')
    );

    await preferenceSharedMutators.create.fn({
      tx,
      ctx: createCtx(),
      args: { id: 'preference-new', locale: 'de', theme: 'dark' },
    });

    expect(mutation('user_preference', 'update')).toHaveBeenCalledWith({
      id: 'preference-existing',
      locale: 'de',
      theme: 'dark',
      updated_at: 1_700_000_001_500,
    });
    globals.restore();
  });

  it('rejects unavailable group appearance themes before updating preferences', async () => {
    const { preferenceSharedMutators } = await loadMutatorContext();
    const { tx, queueRunResults, mutation } = createTxHarness();
    queueRunResults(
      { id: 'preference-1', user_id: 'user-1' },
      {
        id: 'theme-1',
        kind: 'group',
        group_id: 'group-1',
        current_revision_id: 'revision-1',
      },
      undefined
    );

    await expect(
      preferenceSharedMutators.update.fn({
        tx,
        ctx: createCtx(),
        args: { id: 'preference-1', appearance_theme_id: 'theme-1' },
      })
    ).rejects.toThrow('Appearance theme is not published');
    expect(mutation('user_preference', 'update')).not.toHaveBeenCalled();
  });
});

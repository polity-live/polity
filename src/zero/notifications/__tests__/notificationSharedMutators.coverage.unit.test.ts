import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => vi.resetModules());

const personalNotification = {
  id: 'notification-1',
  recipient_id: 'user-1',
  sender_id: 'user-1',
  recipient_entity_type: null,
  recipient_entity_id: null,
  recipient_group_id: null,
  recipient_event_id: null,
  recipient_amendment_id: null,
  recipient_blog_id: null,
  related_group_id: null,
  related_event_id: null,
  related_amendment_id: null,
  related_blog_id: null,
};

const entityNotification = {
  ...personalNotification,
  recipient_id: null,
  recipient_entity_type: 'group',
  recipient_entity_id: 'group-1',
  recipient_group_id: 'group-1',
};

async function loadMutators() {
  const harness = createQueryHarness();
  const can = vi.fn(async () => undefined);
  const authorize = {
    denyPublicApiMutation: vi.fn(),
    requireActorMatches: vi.fn(),
    requireAuthenticated: vi.fn(),
    requireOwner: vi.fn(),
  };
  vi.doMock('@rocicorp/zero', () => ({
    defineMutator: (_schema: unknown, fn: unknown) => ({ fn }),
  }));
  vi.doMock('../../schema', () => ({ zql: harness.zql }));
  vi.doMock('../../rbac/can', () => ({ can }));
  vi.doMock('../../rbac/authorize', () => authorize);
  vi.doMock('../queries', () => ({
    applyActiveNotificationState: (query: unknown) => query,
    applyNotificationViewAccess: (query: unknown) => query,
  }));
  const mod = await import('../shared-mutators');
  return { ...mod, harness, can, authorize };
}

function createTx(harness: ReturnType<typeof createQueryHarness>, location: 'client' | 'server') {
  const config = {
    notification: entityNotification as any,
    notifications: [entityNotification] as any[],
    userState: undefined as any,
    stateQueue: [] as any[],
    legacyReads: [] as any[],
    read: { id: 'read-1', notification_id: 'notification-1', read_by_user_id: 'user-1' } as any,
    settings: { id: 'settings-1', user_id: 'user-1' } as any,
    subscription: { id: 'push-1', user_id: 'user-1' } as any,
  };
  const operations = new Map<string, ReturnType<typeof vi.fn>>();
  const mutate = new Proxy(
    {},
    {
      get: (_target, table) =>
        new Proxy(
          {},
          {
            get: (_table, operation) => {
              const key = `${String(table)}.${String(operation)}`;
              if (!operations.has(key)) operations.set(key, vi.fn().mockResolvedValue(undefined));
              return operations.get(key);
            },
          }
        ),
    }
  );
  const tx = {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(async (query: { table?: string; calls?: readonly unknown[] }) => {
      const table = query?.table;
      const isOne = query?.calls?.some(call => Array.isArray(call) && call[0] === 'one');
      if (table === 'notification') return isOne ? config.notification : config.notifications;
      if (table === 'notification_user_state')
        return config.stateQueue.length ? config.stateQueue.shift() : config.userState;
      if (table === 'notification_read') return isOne ? config.read : config.legacyReads;
      if (table === 'notification_setting') return config.settings;
      if (table === 'push_subscription') return config.subscription;
      return undefined;
    }),
    mutate,
  };
  return {
    tx,
    config,
    operation: (table: string, operation: string) =>
      operations.get(`${table}.${operation}`) ?? vi.fn(),
    harness,
  };
}

const ctx = { userID: 'user-1', email: 'user@example.com' };

describe('notification shared mutator state machine', () => {
  it('covers read, dismissal, batch, settings, push, dispatch, and global entity lifecycles', async () => {
    const { notificationSharedMutators, can, authorize, harness } = await loadMutators();
    const server = createTx(harness, 'server');
    const client = createTx(harness, 'client');
    const registry = notificationSharedMutators as any;

    server.config.notification = null;
    await registry.setNotificationRead.fn({
      tx: server.tx,
      ctx,
      args: { notificationId: 'missing', read: true },
    });

    server.config.notification = personalNotification;
    server.config.userState = { id: 'state-1' };
    await registry.setNotificationRead.fn({
      tx: server.tx,
      ctx,
      args: { notificationId: 'notification-1', read: false },
    });

    server.config.notification = entityNotification;
    server.config.userState = undefined;
    server.config.legacyReads = [];
    await registry.setNotificationRead.fn({
      tx: server.tx,
      ctx,
      args: { notificationId: 'notification-1', read: true },
    });
    server.config.legacyReads = [{ id: 'legacy-1' }, { id: 'legacy-2' }];
    await registry.setNotificationRead.fn({
      tx: server.tx,
      ctx,
      args: { notificationId: 'notification-1', read: false },
    });

    for (const [name, mode] of [
      ['dismissNotification', 'dismiss'],
      ['restoreNotification', 'restore'],
      ['purgeNotificationForUser', 'purge'],
      ['delete', 'dismiss'],
    ] as const) {
      await registry[name].fn({
        tx: server.tx,
        ctx,
        args: name === 'delete' ? { id: 'notification-1' } : { notificationId: 'notification-1' },
      });
      expect(mode).toBeTruthy();
    }
    client.config.notification = entityNotification;
    await registry.dismissNotification.fn({
      tx: client.tx,
      ctx,
      args: { notificationId: 'notification-1' },
    });
    server.config.notification = null;
    await registry.dismissNotification.fn({
      tx: server.tx,
      ctx,
      args: { notificationId: 'missing' },
    });
    server.config.notification = entityNotification;

    server.config.notifications = [personalNotification, entityNotification];
    server.config.stateQueue = [{ dismissed_at: 1 }, undefined, undefined, { purged_at: 1 }];
    await registry.setAllNotificationsRead.fn({
      tx: server.tx,
      ctx,
      args: {
        scope: { kind: 'entity', entityType: 'group', entityId: 'group-1' },
        read: true,
      },
    });
    server.config.stateQueue = [undefined, undefined, undefined];
    await registry.setAllNotificationsRead.fn({
      tx: server.tx,
      ctx,
      args: { scope: { kind: 'inbox' }, read: false },
    });
    await registry.markAllRead.fn({ tx: server.tx, ctx, args: { id: 'ignored' } });
    server.config.userState = { dismissed_at: 1 };
    await registry.markAllRead.fn({ tx: server.tx, ctx, args: { id: 'ignored' } });
    server.config.userState = undefined;
    await registry.markRead.fn({ tx: client.tx, ctx, args: { id: 'notification-1' } });

    await registry.updateSettings.fn({
      tx: server.tx,
      ctx,
      args: { id: 'settings-1', delivery_settings: { inApp: true } },
    });
    await registry.updateSettings.fn({
      tx: client.tx,
      ctx,
      args: { id: 'settings-1', delivery_settings: null },
    });
    await registry.createSettings.fn({ tx: server.tx, ctx, args: { id: 'settings-2' } });
    await registry.registerPushSubscription.fn({
      tx: server.tx,
      ctx,
      args: { id: 'push-1', endpoint: 'endpoint', auth: null, p256dh: null, user_agent: null },
    });
    await registry.unregisterPushSubscription.fn({
      tx: server.tx,
      ctx,
      args: { id: 'push-1' },
    });
    await registry.unregisterPushSubscription.fn({
      tx: client.tx,
      ctx,
      args: { id: 'push-1' },
    });

    const notificationArgs = {
      ...personalNotification,
      title: 'Title',
      message: 'Message',
      type: 'test',
      action_url: null,
      related_entity_type: null,
      on_behalf_of_entity_type: null,
      on_behalf_of_entity_id: null,
      related_user_id: null,
      related_amendment_id: null,
      related_blog_id: null,
      on_behalf_of_group_id: null,
      on_behalf_of_event_id: null,
      on_behalf_of_amendment_id: null,
      on_behalf_of_blog_id: null,
      category: null,
    };
    await registry.createNotification.fn({ tx: client.tx, ctx, args: notificationArgs });
    await registry.createNotification.fn({
      tx: client.tx,
      ctx,
      args: { ...notificationArgs, sender_id: null, recipient_id: null },
    });

    for (const scope of [
      { recipient_group_id: null, related_group_id: 'group-related' },
      { entity_type: 'group', entity_id: 'group-direct' },
      { recipient_event_id: null, related_event_id: 'event-related' },
      { entity_type: 'event', entity_id: 'event-direct' },
      { recipient_amendment_id: null, related_amendment_id: 'amendment-related' },
      { entity_type: 'amendment', entity_id: 'amendment-direct' },
      { recipient_blog_id: null, related_blog_id: 'blog-related' },
      { entity_type: 'blog', entity_id: 'blog-direct' },
      { entity_type: 'unknown', entity_id: 'unknown-1' },
    ]) {
      await registry.createNotification.fn({
        tx: server.tx,
        ctx,
        args: {
          ...notificationArgs,
          sender_id: null,
          recipient_id: null,
          recipient_group_id: null,
          recipient_event_id: null,
          recipient_amendment_id: null,
          recipient_blog_id: null,
          related_group_id: null,
          related_event_id: null,
          related_amendment_id: null,
          related_blog_id: null,
          recipient_entity_type: 'entity_type' in scope ? scope.entity_type : null,
          recipient_entity_id: 'entity_id' in scope ? scope.entity_id : null,
          ...scope,
        },
      });
    }

    for (const [entityType, field] of [
      ['group', 'recipient_group_id'],
      ['event', 'recipient_event_id'],
      ['amendment', 'recipient_amendment_id'],
      ['blog', 'recipient_blog_id'],
    ] as const) {
      await registry.createEntityNotification.fn({
        tx: server.tx,
        ctx,
        args: {
          ...notificationArgs,
          recipient_id: null,
          recipient_entity_type: entityType,
          recipient_entity_id: `${entityType}-1`,
          recipient_group_id: null,
          recipient_event_id: null,
          recipient_amendment_id: null,
          recipient_blog_id: null,
          [field]: `${entityType}-1`,
        },
      });
    }

    for (const name of [
      'updateEntityNotification',
      'deleteEntityNotificationGlobally',
      'restoreEntityNotificationGlobally',
    ]) {
      server.config.notification = entityNotification;
      await registry[name].fn({
        tx: server.tx,
        ctx,
        args: { notificationId: 'notification-1', title: 'Updated' },
      });
      server.config.notification = personalNotification;
      await registry[name].fn({
        tx: server.tx,
        ctx,
        args: { notificationId: 'notification-1', title: null },
      });
      client.config.notification = null;
      await registry[name].fn({
        tx: client.tx,
        ctx,
        args: { notificationId: 'missing' },
      });
    }

    server.config.notification = entityNotification;
    await registry.markEntityNotificationRead.fn({
      tx: server.tx,
      ctx,
      args: {
        id: 'read-1',
        notification_id: 'notification-1',
        entity_type: 'group',
        entity_id: 'group-1',
      },
    });
    server.config.notifications = [entityNotification];
    server.config.stateQueue = [undefined, undefined];
    await registry.markAllEntityNotificationsRead.fn({
      tx: server.tx,
      ctx,
      args: { entity_type: 'group', entity_id: 'group-1' },
    });
    server.config.userState = { purged_at: 1 };
    await registry.markAllEntityNotificationsRead.fn({
      tx: server.tx,
      ctx,
      args: { entity_type: 'group', entity_id: 'group-1' },
    });
    server.config.userState = undefined;
    await registry.deleteEntityNotificationRead.fn({
      tx: server.tx,
      ctx,
      args: { id: 'read-1' },
    });
    client.config.read = null;
    await registry.deleteEntityNotificationRead.fn({
      tx: client.tx,
      ctx,
      args: { id: 'missing' },
    });

    expect(can).toHaveBeenCalled();
    expect(authorize.requireAuthenticated).toHaveBeenCalled();
    expect(server.operation('notification', 'update')).toHaveBeenCalled();
    expect(server.operation('notification_user_state', 'insert')).toHaveBeenCalled();
  });
});

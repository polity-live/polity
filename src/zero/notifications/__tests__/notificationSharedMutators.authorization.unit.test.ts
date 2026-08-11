import { describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { notificationSharedMutators } from '../shared-mutators';

type NotificationMutatorInput = Parameters<
  typeof notificationSharedMutators.createNotification.fn
>[0];
type NotificationMutatorTx = NotificationMutatorInput['tx'];
type NotificationMutatorCtx = NotificationMutatorInput['ctx'];

function createTx(location: NotificationMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      notification: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      notification_user_state: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      notification_read: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): NotificationMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

const notificationArgs = {
  id: 'notification-1',
  recipient_id: 'user-2',
  sender_id: 'user-1',
  title: 'Title',
  message: 'Message',
  type: 'test',
  action_url: null,
  related_entity_type: null,
  on_behalf_of_entity_type: null,
  on_behalf_of_entity_id: null,
  recipient_entity_type: null,
  recipient_entity_id: null,
  related_user_id: null,
  related_group_id: null,
  related_amendment_id: null,
  related_event_id: null,
  related_blog_id: null,
  on_behalf_of_group_id: null,
  on_behalf_of_event_id: null,
  on_behalf_of_amendment_id: null,
  on_behalf_of_blog_id: null,
  recipient_group_id: null,
  recipient_event_id: null,
  recipient_amendment_id: null,
  recipient_blog_id: null,
  category: null,
};

describe('notificationSharedMutators authorization', () => {
  it('rejects direct notification creation on the server', async () => {
    const tx = createTx('server');

    await expect(
      notificationSharedMutators.createNotification.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: notificationArgs,
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.notification.insert).not.toHaveBeenCalled();
  });

  it('keeps direct notification creation optimistic on the client', async () => {
    const tx = createTx('client');

    await expect(
      notificationSharedMutators.createNotification.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: notificationArgs,
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.notification.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'notification-1',
        sender_id: 'user-1',
        is_read: false,
      })
    );
  });

  it('rejects state changes for another personal recipient', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({ ...notificationArgs, recipient_id: 'user-2' });

    await expect(
      notificationSharedMutators.setNotificationRead.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { notificationId: notificationArgs.id, read: true },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.notification_user_state.insert).not.toHaveBeenCalled();
  });

  it('writes state only with the authenticated personal recipient id', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ ...notificationArgs, recipient_id: 'user-1' })
      .mockResolvedValueOnce(undefined);

    await notificationSharedMutators.setNotificationRead.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { notificationId: notificationArgs.id, read: true },
    });

    expect(tx.mutate.notification_user_state.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_id: notificationArgs.id,
        user_id: 'user-1',
        read_at: expect.any(Number),
      })
    );
  });

  it('allows the group owner to soft-delete an entity notification globally', async () => {
    const tx = createTx('server');
    const entityNotification = {
      ...notificationArgs,
      recipient_id: null,
      recipient_entity_type: 'group',
      recipient_entity_id: 'group-1',
      recipient_group_id: 'group-1',
    };
    tx.run
      .mockResolvedValueOnce(entityNotification)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'group-1' }]);

    await notificationSharedMutators.deleteEntityNotificationGlobally.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { notificationId: entityNotification.id },
    });

    expect(tx.mutate.notification.update).toHaveBeenCalledWith({
      id: entityNotification.id,
      deleted_at: expect.any(Number),
      deleted_by_user_id: 'user-1',
      updated_at: expect.any(Number),
    });
  });

  it('rejects global deletion when manageNotifications is unavailable', async () => {
    const tx = createTx('server');
    const entityNotification = {
      ...notificationArgs,
      recipient_id: null,
      recipient_entity_type: 'group',
      recipient_entity_id: 'group-1',
      recipient_group_id: 'group-1',
    };
    tx.run
      .mockResolvedValueOnce(entityNotification)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      notificationSharedMutators.deleteEntityNotificationGlobally.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { notificationId: entityNotification.id },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.notification.update).not.toHaveBeenCalled();
  });
});

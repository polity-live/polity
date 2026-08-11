import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createConversationFull: vi.fn(),
  sendMessage: vi.fn(),
  updateConversation: vi.fn(),
  sendAssistantMessage: vi.fn(),
  createConversation: vi.fn(),
  fireNotification: vi.fn(),
  userName: vi.fn(),
}));
vi.mock('../../mutators', () => ({
  mutators: {
    messages: {
      createConversationFull: { fn: mocks.createConversationFull },
      sendMessage: { fn: mocks.sendMessage },
      updateConversation: { fn: mocks.updateConversation },
      sendAssistantMessage: { fn: mocks.sendAssistantMessage },
      createConversation: { fn: mocks.createConversation },
    },
  },
}));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fireNotification }));
vi.mock('../../server-helpers', () => ({ userName: mocks.userName }));

import { messageServerMutators } from '../server-mutators';

const ctx = { userID: 'viewer', email: 'viewer@example.test' };
const baseConversation = {
  id: 'conversation',
  type: 'direct',
  status: 'pending',
  assistant_for_user_id: null,
};

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.userName.mockResolvedValue('Viewer');
  mocks.fireNotification.mockResolvedValue(undefined);
});

describe('message server mutator remaining branches', () => {
  it('validates assistant conversation ownership and delegates valid creates', async () => {
    await expect(
      messageServerMutators.createConversation.fn({
        tx: {} as never,
        ctx,
        args: { id: 'one', assistant_for_user_id: 'other' } as any,
      })
    ).rejects.toThrow('current user');
    await messageServerMutators.createConversation.fn({
      tx: {} as never,
      ctx,
      args: { id: 'two', assistant_for_user_id: 'viewer' } as any,
    });
    await messageServerMutators.createConversation.fn({
      tx: {} as never,
      ctx,
      args: { id: 'three', assistant_for_user_id: null } as any,
    });
    expect(mocks.createConversation).toHaveBeenCalledTimes(2);
  });

  it('skips request notifications for every non-request conversation variant', async () => {
    for (const conversation of [
      { ...baseConversation, type: 'group' },
      { ...baseConversation, status: 'accepted' },
      { ...baseConversation, assistant_for_user_id: 'viewer' },
    ]) {
      await messageServerMutators.createConversationFull.fn({
        tx: {} as never,
        ctx,
        args: { conversation, participants: [] } as any,
      });
    }
    expect(mocks.fireNotification).not.toHaveBeenCalled();
  });

  it('skips direct-message notifications for missing, pending and assistant conversations', async () => {
    for (const row of [
      null,
      { status: 'pending', assistant_for_user_id: null },
      { status: 'accepted', assistant_for_user_id: 'viewer' },
    ]) {
      const tx = { run: vi.fn().mockResolvedValue(row) };
      await messageServerMutators.sendMessage.fn({
        tx: tx as never,
        ctx,
        args: { id: 'message', conversation_id: 'conversation' } as any,
      });
    }
    expect(mocks.fireNotification).not.toHaveBeenCalled();
  });

  it('skips acceptance notifications for every invalid transition condition', async () => {
    const rows = [
      undefined,
      { type: 'group', status: 'pending', requested_by_id: 'requester' },
      { type: 'direct', status: 'accepted', requested_by_id: 'requester' },
      { type: 'direct', status: 'pending', requested_by_id: null },
      { type: 'direct', status: 'pending', requested_by_id: 'viewer' },
    ];
    for (const previous of rows) {
      const tx = { run: vi.fn().mockResolvedValue(previous) };
      await messageServerMutators.updateConversation.fn({
        tx: tx as never,
        ctx,
        args: {
          id: 'conversation',
          status: previous?.requested_by_id === 'requester' ? 'pending' : 'accepted',
        } as any,
      });
    }
    expect(mocks.fireNotification).not.toHaveBeenCalled();
  });

  it('rejects absent and foreign assistant chats and sends in the owned chat', async () => {
    for (const conversation of [null, { assistant_for_user_id: 'other' }]) {
      await expect(
        messageServerMutators.sendAssistantMessage.fn({
          tx: { run: vi.fn().mockResolvedValue(conversation) } as never,
          ctx,
          args: { conversation_id: 'conversation' } as any,
        })
      ).rejects.toThrow('Assistant replies');
    }
    await messageServerMutators.sendAssistantMessage.fn({
      tx: { run: vi.fn().mockResolvedValue({ assistant_for_user_id: 'viewer' }) } as never,
      ctx,
      args: { conversation_id: 'conversation' } as any,
    });
    expect(mocks.sendAssistantMessage).toHaveBeenCalledTimes(1);
  });
});

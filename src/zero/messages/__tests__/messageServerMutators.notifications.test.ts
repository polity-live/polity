import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createConversationFull: vi.fn(),
  sendMessage: vi.fn(),
  updateConversation: vi.fn(),
  sendAssistantMessage: vi.fn(),
  createConversation: vi.fn(),
  fireNotification: vi.fn().mockResolvedValue(undefined),
  userName: vi.fn().mockResolvedValue('Alice Example'),
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

const ctx = { userID: 'sender-1', email: 'sender@example.com' };

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockClear());
  mocks.fireNotification.mockResolvedValue(undefined);
  mocks.userName.mockResolvedValue('Alice Example');
});

describe('messageServerMutators notifications', () => {
  it('notifies the other participant about a direct conversation request', async () => {
    await messageServerMutators.createConversationFull.fn({
      tx: { run: vi.fn() } as never,
      ctx,
      args: {
        conversation: {
          id: 'conversation-1',
          type: 'direct',
          status: 'pending',
          group_id: null,
          event_id: null,
          name: null,
          pinned: false,
          last_message_at: 0,
          assistant_for_user_id: null,
        },
        participants: [
          {
            id: 'participant-1',
            conversation_id: 'conversation-1',
            user_id: 'sender-1',
            joined_at: 1,
            last_read_at: 0,
            left_at: null,
          },
          {
            id: 'participant-2',
            conversation_id: 'conversation-1',
            user_id: 'recipient-1',
            joined_at: 1,
            last_read_at: 0,
            left_at: null,
          },
        ],
      },
    });

    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyConversationRequest', {
      conversationId: 'conversation-1',
      senderId: 'sender-1',
      senderName: 'Alice Example',
      recipientUserId: 'recipient-1',
    });
  });

  it('notifies active non-sender participants about an accepted conversation message', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'conversation-1',
          status: 'accepted',
          assistant_for_user_id: null,
        })
        .mockResolvedValueOnce([
          { user_id: 'sender-1', left_at: null },
          { user_id: 'recipient-1', left_at: null },
          { user_id: 'left-user', left_at: 123 },
        ]),
    };

    await messageServerMutators.sendMessage.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'message-1',
        conversation_id: 'conversation-1',
        content: 'Hello',
        context_json: '[]',
        deleted_at: null,
      },
    });

    expect(mocks.fireNotification).toHaveBeenCalledTimes(1);
    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyDirectMessage', {
      senderId: 'sender-1',
      senderName: 'Alice Example',
      recipientUserId: 'recipient-1',
      conversationId: 'conversation-1',
    });
  });

  it('notifies the requester only on the pending-to-accepted transition', async () => {
    const tx = {
      run: vi.fn().mockResolvedValue({
        id: 'conversation-1',
        type: 'direct',
        status: 'pending',
        requested_by_id: 'requester-1',
      }),
    };

    await messageServerMutators.updateConversation.fn({
      tx: tx as never,
      ctx,
      args: { id: 'conversation-1', status: 'accepted' },
    });

    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyConversationAccepted', {
      senderId: 'sender-1',
      senderName: 'Alice Example',
      recipientUserId: 'requester-1',
      conversationId: 'conversation-1',
    });
  });
});

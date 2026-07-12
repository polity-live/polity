import { describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { messageSharedMutators } from '../shared-mutators';

type MessageMutatorInput = Parameters<typeof messageSharedMutators.sendAssistantMessage.fn>[0];
type MessageMutatorTx = MessageMutatorInput['tx'];
type MessageMutatorCtx = MessageMutatorInput['ctx'];

function createTx(location: MessageMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      message: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      conversation: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      conversation_participant: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): MessageMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

const assistantMessageArgs = {
  id: 'message-1',
  conversation_id: 'conversation-1',
  content: 'Hello',
  context_json: null,
  deleted_at: 0,
};

describe('messageSharedMutators authorization', () => {
  it('rejects assistant messages for another user on the server', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValue({ id: 'conversation-1', assistant_for_user_id: 'user-2' });

    await expect(
      messageSharedMutators.sendAssistantMessage.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: assistantMessageArgs,
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.message.insert).not.toHaveBeenCalled();
  });

  it('keeps assistant messages optimistic on the client', async () => {
    const tx = createTx('client');

    await expect(
      messageSharedMutators.sendAssistantMessage.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: assistantMessageArgs,
      })
    ).resolves.toBeUndefined();

    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.message.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'message-1',
        conversation_id: 'conversation-1',
      })
    );
  });

  it('creates a full conversation graph in one optimistic mutator', async () => {
    const tx = createTx('client');

    await expect(
      messageSharedMutators.createConversationFull.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          conversation: {
            id: 'conversation-1',
            type: 'direct',
            status: 'accepted',
            group_id: null,
            event_id: null,
            name: 'Chat',
            pinned: false,
            last_message_at: 123,
            assistant_for_user_id: 'user-1',
          },
          participants: [
            {
              id: 'participant-1',
              conversation_id: 'conversation-1',
              user_id: 'user-1',
              joined_at: 123,
              last_read_at: 0,
              left_at: 0,
            },
            {
              id: 'participant-2',
              conversation_id: 'conversation-1',
              user_id: 'assistant-1',
              joined_at: 123,
              last_read_at: 123,
              left_at: 0,
            },
          ],
          assistantMessage: {
            id: 'message-1',
            conversation_id: 'conversation-1',
            content: 'Welcome',
            context_json: '[]',
            deleted_at: 0,
          },
        },
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.conversation.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conversation-1' })
    );
    expect(tx.mutate.conversation_participant.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.message.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'message-1', conversation_id: 'conversation-1' })
    );
  });

  it('deletes a full conversation graph in one optimistic mutator', async () => {
    const tx = createTx('client');

    await expect(
      messageSharedMutators.deleteConversationFull.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'conversation-1',
          messageIds: ['message-1', 'message-2'],
          participantIds: ['participant-1'],
        },
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.message.delete).toHaveBeenCalledTimes(2);
    expect(tx.mutate.conversation_participant.delete).toHaveBeenCalledWith({
      id: 'participant-1',
    });
    expect(tx.mutate.conversation.delete).toHaveBeenCalledWith({ id: 'conversation-1' });
  });

  it('allows an incoming recipient to delete the full conversation after one upfront check', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'conversation-1',
        requested_by_id: 'user-2',
        assistant_for_user_id: null,
        group_id: null,
        event_id: null,
      })
      .mockResolvedValueOnce({
        id: 'conversation-1',
        requested_by_id: 'user-2',
        assistant_for_user_id: null,
        group_id: null,
        event_id: null,
      })
      .mockResolvedValueOnce({
        id: 'participant-1',
        conversation_id: 'conversation-1',
        user_id: 'user-1',
        left_at: null,
      })
      .mockResolvedValueOnce({
        id: 'participant-1',
        conversation_id: 'conversation-1',
        user_id: 'user-1',
      })
      .mockResolvedValueOnce({
        id: 'participant-2',
        conversation_id: 'conversation-1',
        user_id: 'user-2',
      });

    await expect(
      messageSharedMutators.deleteConversationFull.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'conversation-1',
          participantIds: ['participant-1', 'participant-2'],
        },
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.conversation_participant.delete).toHaveBeenCalledTimes(2);
    expect(tx.mutate.conversation.delete).toHaveBeenCalledWith({ id: 'conversation-1' });
  });

  it('allows the requester to cancel a full conversation request', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'conversation-1',
        requested_by_id: 'user-1',
        assistant_for_user_id: null,
        group_id: null,
        event_id: null,
      })
      .mockResolvedValueOnce({
        id: 'participant-1',
        conversation_id: 'conversation-1',
        user_id: 'user-1',
      });

    await expect(
      messageSharedMutators.deleteConversationFull.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'conversation-1',
          participantIds: ['participant-1'],
        },
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.conversation.delete).toHaveBeenCalledWith({ id: 'conversation-1' });
  });

  it('rejects child ids from another conversation before deleting anything', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'conversation-1',
        requested_by_id: 'user-1',
        assistant_for_user_id: null,
        group_id: null,
        event_id: null,
      })
      .mockResolvedValueOnce({
        id: 'message-foreign',
        conversation_id: 'conversation-2',
      });

    await expect(
      messageSharedMutators.deleteConversationFull.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'conversation-1',
          messageIds: ['message-foreign'],
          participantIds: ['participant-1'],
        },
      })
    ).rejects.toThrow('Message does not belong to this conversation.');

    expect(tx.mutate.message.delete).not.toHaveBeenCalled();
    expect(tx.mutate.conversation_participant.delete).not.toHaveBeenCalled();
    expect(tx.mutate.conversation.delete).not.toHaveBeenCalled();
  });
});

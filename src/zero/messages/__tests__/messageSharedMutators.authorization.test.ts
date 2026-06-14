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
      },
      conversation: {
        update: vi.fn(),
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
});

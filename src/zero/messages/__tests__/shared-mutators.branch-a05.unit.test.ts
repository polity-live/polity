import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock('@rocicorp/zero', () => ({
  defineMutator: (_schema: unknown, fn: unknown) => ({ fn }),
}));

vi.mock('../../rbac/can', () => ({ can: (...args: any[]) => mocks.can(...args) }));

vi.mock('../../rbac/authorize', () => ({
  requireAuthenticated: (...args: any[]) => mocks.requireAuthenticated(...args),
  requireOwner: (...args: any[]) => mocks.requireOwner(...args),
}));

const query = vi.hoisted(() => {
  const value: any = {};
  value.where = vi.fn(() => value);
  value.one = vi.fn(() => value);
  return value;
});

vi.mock('../../schema', () => ({
  zql: {
    conversation: query,
    conversation_participant: query,
    message: query,
  },
}));

import { messageSharedMutators } from '../shared-mutators';

function tx(location: 'client' | 'server' = 'server') {
  return {
    location,
    run: vi.fn(),
    mutate: {
      conversation: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      conversation_participant: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      message: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
  } as any;
}

const ctx = { userID: 'user-1', email: 'user@test' } as any;

async function invoke(name: keyof typeof messageSharedMutators, value: any, args: any) {
  return (messageSharedMutators[name].fn as any)({ tx: value, ctx, args });
}

describe('message shared mutators branch coverage', () => {
  beforeEach(() => {
    mocks.can.mockReset().mockResolvedValue(undefined);
    mocks.requireAuthenticated.mockReset();
    mocks.requireOwner.mockReset();
    query.where.mockClear();
    query.one.mockClear();
    vi.spyOn(Date, 'now').mockReturnValue(1234);
  });

  it('creates conversations with and without each scoped authorization', async () => {
    const server = tx();
    await invoke('createConversation', server, {
      id: 'full',
      assistant_for_user_id: 'user-1',
      group_id: 'group-1',
      event_id: 'event-1',
    });
    expect(mocks.requireAuthenticated).toHaveBeenCalled();
    expect(mocks.requireOwner).toHaveBeenCalledWith(
      server,
      ctx,
      'user-1',
      expect.objectContaining({ action: 'create' })
    );
    expect(mocks.can).toHaveBeenCalledTimes(2);
    expect(server.mutate.conversation.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'full', requested_by_id: 'user-1', created_at: 1234 })
    );

    const minimal = tx('client');
    await invoke('createConversation', minimal, {
      id: 'minimal',
      assistant_for_user_id: null,
      group_id: null,
      event_id: null,
    });
    expect(minimal.mutate.conversation.insert).toHaveBeenCalled();
  });

  it('creates full graphs for empty and populated optional children', async () => {
    const populated = tx('client');
    await invoke('createConversationFull', populated, {
      conversation: { id: 'conversation', group_id: null, event_id: null },
      participants: [{ id: 'participant', conversation_id: 'conversation' }],
      assistantMessage: { id: 'assistant', conversation_id: 'conversation' },
    });
    expect(populated.mutate.conversation_participant.insert).toHaveBeenCalled();
    expect(populated.mutate.message.insert).toHaveBeenCalled();

    const empty = tx('client');
    await invoke('createConversationFull', empty, {
      conversation: { id: 'empty', group_id: null, event_id: null },
      participants: [],
      assistantMessage: null,
    });
    expect(empty.mutate.conversation_participant.insert).not.toHaveBeenCalled();
    expect(empty.mutate.message.insert).not.toHaveBeenCalled();
  });

  it('authorizes message participants on client, assistant, active, missing, and left paths', async () => {
    const client = tx('client');
    await invoke('sendMessage', client, { id: 'm-client', conversation_id: 'c' });
    expect(client.run).not.toHaveBeenCalled();

    const assistant = tx();
    assistant.run.mockResolvedValueOnce({ assistant_for_user_id: 'user-1' });
    await invoke('sendMessage', assistant, { id: 'm-assistant', conversation_id: 'c' });
    expect(assistant.run).toHaveBeenCalledTimes(1);

    const active = tx();
    active.run
      .mockResolvedValueOnce({ assistant_for_user_id: null })
      .mockResolvedValueOnce({ user_id: 'user-1', left_at: null });
    await invoke('sendMessage', active, { id: 'm-active', conversation_id: 'c' });
    expect(active.mutate.message.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: 'user-1', is_read: false, updated_at: 1234 })
    );
    expect(active.mutate.conversation.update).toHaveBeenCalledWith({
      id: 'c',
      last_message_at: 1234,
    });

    for (const rows of [
      [null],
      [{ assistant_for_user_id: null }, null],
      [{ assistant_for_user_id: null }, { user_id: 'user-1', left_at: 12 }],
    ]) {
      const denied = tx();
      denied.run.mockResolvedValueOnce(rows[0]).mockResolvedValueOnce(rows[1]);
      await expect(
        invoke('sendMessage', denied, { id: 'm-denied', conversation_id: 'c' })
      ).rejects.toThrow();
    }
  });

  it('sends assistant messages and marks reads on client and server optional-owner paths', async () => {
    const client = tx('client');
    await invoke('sendAssistantMessage', client, { id: 'assistant', conversation_id: 'c' });
    await invoke('markRead', client, { id: 'participant', last_read_at: 9 });
    expect(client.run).not.toHaveBeenCalled();
    expect(client.mutate.message.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: 'a12a0000-0000-4000-a000-000000000001' })
    );

    const server = tx();
    server.run
      .mockResolvedValueOnce({ assistant_for_user_id: 'user-1' })
      .mockResolvedValueOnce({ user_id: 'user-1' });
    await invoke('sendAssistantMessage', server, { id: 'assistant', conversation_id: 'c' });
    await invoke('markRead', server, { id: 'participant', last_read_at: 9 });
    expect(mocks.requireOwner).toHaveBeenCalledWith(server, ctx, 'user-1', expect.any(Object));

    const missing = tx();
    missing.run.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await invoke('sendAssistantMessage', missing, { id: 'missing', conversation_id: 'c' });
    await invoke('markRead', missing, { id: 'missing', last_read_at: 0 });
    expect(mocks.requireOwner).toHaveBeenCalledWith(missing, ctx, undefined, expect.any(Object));
  });

  it('manages requester, assistant, group, event, participant, missing, and client conversations', async () => {
    const scenarios = [
      { conversation: { requested_by_id: 'user-1' }, expectedCan: false },
      {
        conversation: { requested_by_id: 'other', assistant_for_user_id: 'user-1' },
        expectedCan: false,
      },
      { conversation: { requested_by_id: 'other', group_id: 'group' }, expectedCan: true },
      { conversation: { requested_by_id: 'other', event_id: 'event' }, expectedCan: true },
    ];
    for (const scenario of scenarios) {
      mocks.can.mockClear();
      const server = tx();
      server.run.mockResolvedValueOnce(scenario.conversation);
      await invoke('updateConversation', server, { id: 'c', name: 'updated' });
      expect(mocks.can.mock.calls.length > 0).toBe(scenario.expectedCan);
    }

    const participant = tx();
    participant.run
      .mockResolvedValueOnce({ requested_by_id: 'other', group_id: null, event_id: null })
      .mockResolvedValueOnce({ assistant_for_user_id: null })
      .mockResolvedValueOnce({ user_id: 'user-1', left_at: null });
    await invoke('deleteConversation', participant, { id: 'c' });
    expect(participant.mutate.conversation.delete).toHaveBeenCalledWith({ id: 'c' });

    const missing = tx();
    missing.run.mockResolvedValueOnce(null);
    await expect(invoke('updateConversation', missing, { id: 'c' })).rejects.toThrow(
      'Conversation not found'
    );

    const client = tx('client');
    await invoke('addParticipant', client, { id: 'p', conversation_id: 'c' });
    expect(client.mutate.conversation_participant.insert).toHaveBeenCalled();
  });

  it('authorizes message mutation for client, sender, manager, and missing records', async () => {
    const client = tx('client');
    await invoke('updateMessage', client, { id: 'm', content: 'updated' });
    await invoke('deleteMessage', client, { id: 'm' });
    expect(client.mutate.message.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm', updated_at: 1234 })
    );

    const sender = tx();
    sender.run.mockResolvedValueOnce({ sender_id: 'user-1', conversation_id: 'c' });
    await invoke('deleteMessage', sender, { id: 'm' });
    expect(sender.mutate.message.delete).toHaveBeenCalledWith({ id: 'm' });

    const manager = tx();
    manager.run
      .mockResolvedValueOnce({ sender_id: 'other', conversation_id: 'c' })
      .mockResolvedValueOnce({ requested_by_id: 'user-1' });
    await invoke('updateMessage', manager, { id: 'm', content: 'managed' });

    const missing = tx();
    missing.run.mockResolvedValueOnce(null);
    await expect(invoke('deleteMessage', missing, { id: 'missing' })).rejects.toThrow(
      'Message not found'
    );
  });

  it('validates and deletes complete graphs on client and server', async () => {
    const client = tx('client');
    await invoke('deleteConversationFull', client, {
      id: 'c',
      messageIds: null,
      participantIds: undefined,
    });
    expect(client.mutate.conversation.delete).toHaveBeenCalledWith({ id: 'c' });

    const server = tx();
    server.run
      .mockResolvedValueOnce({ requested_by_id: 'user-1' })
      .mockResolvedValueOnce({ id: 'm', conversation_id: 'c' })
      .mockResolvedValueOnce({ id: 'p', conversation_id: 'c' });
    await invoke('deleteConversationFull', server, {
      id: 'c',
      messageIds: ['m'],
      participantIds: ['p'],
    });
    expect(server.mutate.message.delete).toHaveBeenCalledWith({ id: 'm' });
    expect(server.mutate.conversation_participant.delete).toHaveBeenCalledWith({ id: 'p' });

    const emptyServer = tx();
    emptyServer.run.mockResolvedValueOnce({ requested_by_id: 'user-1' });
    await invoke('deleteConversationFull', emptyServer, {
      id: 'c',
      messageIds: undefined,
      participantIds: null,
    });
    expect(emptyServer.mutate.conversation.delete).toHaveBeenCalledWith({ id: 'c' });

    for (const record of [null, { id: 'm', conversation_id: 'foreign' }]) {
      const invalid = tx();
      invalid.run
        .mockResolvedValueOnce({ requested_by_id: 'user-1' })
        .mockResolvedValueOnce(record);
      await expect(
        invoke('deleteConversationFull', invalid, {
          id: 'c',
          messageIds: ['m'],
          participantIds: [],
        })
      ).rejects.toThrow('Message does not belong');
    }

    for (const record of [null, { id: 'p', conversation_id: 'foreign' }]) {
      const invalid = tx();
      invalid.run
        .mockResolvedValueOnce({ requested_by_id: 'user-1' })
        .mockResolvedValueOnce(record);
      await expect(
        invoke('deleteConversationFull', invalid, {
          id: 'c',
          messageIds: [],
          participantIds: ['p'],
        })
      ).rejects.toThrow('Conversation participant does not belong');
    }
  });

  it('removes participants for client, self, managed other, and missing rows', async () => {
    const client = tx('client');
    await invoke('removeParticipant', client, { id: 'p' });
    expect(client.run).not.toHaveBeenCalled();

    const self = tx();
    self.run.mockResolvedValueOnce({ id: 'p', user_id: 'user-1', conversation_id: 'c' });
    await invoke('removeParticipant', self, { id: 'p' });
    expect(self.run).toHaveBeenCalledTimes(1);

    const other = tx();
    other.run
      .mockResolvedValueOnce({ id: 'p', user_id: 'other', conversation_id: 'c' })
      .mockResolvedValueOnce({ requested_by_id: 'user-1' });
    await invoke('removeParticipant', other, { id: 'p' });
    expect(other.mutate.conversation_participant.delete).toHaveBeenCalled();

    const missing = tx();
    missing.run.mockResolvedValueOnce(null);
    await expect(invoke('removeParticipant', missing, { id: 'p' })).rejects.toThrow(
      'Conversation participant not found'
    );
  });
});

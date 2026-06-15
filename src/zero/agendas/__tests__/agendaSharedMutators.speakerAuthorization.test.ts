import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { agendaSharedMutators } from '../shared-mutators';

type AddSpeakerMutatorInput = Parameters<typeof agendaSharedMutators.addSpeaker.fn>[0];
type AddSpeakerMutatorTx = AddSpeakerMutatorInput['tx'];
type AddSpeakerMutatorCtx = AddSpeakerMutatorInput['ctx'];

function createTx(location: AddSpeakerMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      action_right: {
        insert: vi.fn(),
      },
      speaker_list: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(userID = 'user-1'): AddSpeakerMutatorCtx {
  return {
    userID,
    email: `${userID}@example.com`,
  };
}

function createSpeakerArgs(userId = 'user-1') {
  return {
    id: `speaker-${userId}`,
    title: 'Speaker',
    time: 3,
    completed: false,
    order_index: 1,
    user_id: userId,
    agenda_item_id: 'agenda-item-1',
    start_time: 0,
    end_time: 0,
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('agendaSharedMutators.addSpeaker authorization', () => {
  it('allows users with speak rights to add themselves', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({ id: 'agenda-item-1', event_id: 'event-1' })
      .mockResolvedValueOnce([]);
    canMock.mockResolvedValueOnce(undefined);

    await agendaSharedMutators.addSpeaker.fn({
      tx: tx as never,
      ctx,
      args: createSpeakerArgs(ctx.userID),
    });

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'speak',
      resource: 'events',
      eventId: 'event-1',
    });
    expect(tx.mutate.speaker_list.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ctx.userID, agenda_item_id: 'agenda-item-1' })
    );
  });

  it('repairs missing speak rights on standard event roles while adding a speaker', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({ id: 'agenda-item-1', event_id: 'event-1' })
      .mockResolvedValueOnce([
        {
          id: 'role-voter',
          name: 'Voter',
          scope: 'event',
          assignee_kind: 'participant',
          action_rights: [],
        },
      ]);
    canMock.mockResolvedValueOnce(undefined);

    await agendaSharedMutators.addSpeaker.fn({
      tx: tx as never,
      ctx,
      args: createSpeakerArgs(ctx.userID),
    });

    expect(tx.mutate.action_right.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'events',
        action: 'speak',
        role_id: 'role-voter',
        event_id: 'event-1',
      })
    );
  });

  it('allows existing voter-style roles to self-add during the speak-right repair window', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({ id: 'agenda-item-1', event_id: 'event-1' })
      .mockResolvedValueOnce([]);
    canMock
      .mockRejectedValueOnce(new PermissionError('speak', 'events', 'event:event-1'))
      .mockRejectedValueOnce(new PermissionError('manage_speakers', 'events', 'event:event-1'))
      .mockResolvedValueOnce(undefined);

    await agendaSharedMutators.addSpeaker.fn({
      tx: tx as never,
      ctx,
      args: createSpeakerArgs(ctx.userID),
    });

    expect(canMock).toHaveBeenNthCalledWith(3, tx, ctx, {
      action: 'active_voting',
      resource: 'events',
      eventId: 'event-1',
    });
    expect(tx.mutate.speaker_list.insert).toHaveBeenCalled();
  });

  it('rejects self-adds without speak, voting, or speaker-management rights', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({ id: 'agenda-item-1', event_id: 'event-1' })
      .mockResolvedValueOnce([]);
    canMock.mockRejectedValue(new PermissionError('speak', 'events', 'event:event-1'));

    await expect(
      agendaSharedMutators.addSpeaker.fn({
        tx: tx as never,
        ctx,
        args: createSpeakerArgs(ctx.userID),
      })
    ).rejects.toBeInstanceOf(PermissionError);

    expect(tx.mutate.speaker_list.insert).not.toHaveBeenCalled();
  });

  it('requires manage_speakers to add another user', async () => {
    const tx = createTx('server');
    const ctx = createCtx('manager-1');

    tx.run
      .mockResolvedValueOnce({ id: 'agenda-item-1', event_id: 'event-1' })
      .mockResolvedValueOnce([]);
    canMock.mockResolvedValueOnce(undefined);

    await agendaSharedMutators.addSpeaker.fn({
      tx: tx as never,
      ctx,
      args: createSpeakerArgs('user-2'),
    });

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage_speakers',
      resource: 'events',
      eventId: 'event-1',
    });
    expect(tx.mutate.speaker_list.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-2', agenda_item_id: 'agenda-item-1' })
    );
  });
});

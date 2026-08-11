import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '../../rbac/errors';

const canMock = vi.hoisted(() => vi.fn());
vi.mock('../../rbac/can', () => ({ can: (...args: unknown[]) => canMock(...args) }));

import { agendaSharedMutators } from '../shared-mutators';

function createTx(results: unknown[] = [], location: 'client' | 'server' = 'server') {
  const queue = [...results];
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(async () => queue.shift()),
    mutate: {
      agenda_item: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      action_right: { insert: vi.fn() },
      speaker_list: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      agenda_item_change_request: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
  };
}

const ctx = { userID: 'user-1', email: 'user-1@example.com' };
const agendaArgs = {
  id: 'agenda-1',
  event_id: 'event-1',
  amendment_id: null,
  title: null,
  description: null,
  type: 'discussion',
  status: 'planned',
  forwarding_status: null,
  order_index: 0,
  duration: 30,
  scheduled_time: null,
  start_time: null,
  end_time: null,
  activated_at: null,
  completed_at: null,
  majority_type: null,
  time_limit: null,
  voting_phase: null,
} as unknown as Parameters<typeof agendaSharedMutators.createAgendaItem.fn>[0]['args'];
const speakerArgs = {
  id: 'speaker-1',
  agenda_item_id: 'agenda-1',
  user_id: 'user-2',
  title: null,
  order_index: 0,
  time: null,
  completed: false,
  start_time: null,
  end_time: null,
} as unknown as Parameters<typeof agendaSharedMutators.addSpeaker.fn>[0]['args'];

beforeEach(() => {
  vi.clearAllMocks();
  canMock.mockResolvedValue(undefined);
});

describe('agenda shared mutator branch contracts', () => {
  it('handles client, event, amendment, missing-parent, and missing-item access', async () => {
    const client = createTx([], 'client');
    await agendaSharedMutators.createAgendaItem.fn({ tx: client as never, ctx, args: agendaArgs });
    expect(client.run).not.toHaveBeenCalled();

    const event = createTx();
    await agendaSharedMutators.createAgendaItem.fn({ tx: event as never, ctx, args: agendaArgs });
    expect(canMock).toHaveBeenCalledWith(event, ctx, {
      action: 'create',
      resource: 'agendaItems',
      eventId: 'event-1',
    });

    const amendment = createTx();
    await agendaSharedMutators.createAgendaItem.fn({
      tx: amendment as never,
      ctx,
      args: { ...agendaArgs, event_id: null, amendment_id: 'amendment-1' },
    });
    expect(canMock).toHaveBeenCalledWith(amendment, ctx, {
      action: 'update',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });

    await expect(
      agendaSharedMutators.createAgendaItem.fn({
        tx: createTx() as never,
        ctx,
        args: { ...agendaArgs, event_id: null, amendment_id: null },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    await expect(
      agendaSharedMutators.updateAgendaItem.fn({
        tx: createTx([null]) as never,
        ctx,
        args: { id: 'missing', title: 'Missing' },
      })
    ).rejects.toThrow('Agenda item not found');
  });

  it('repairs only eligible roles without an existing speak right', async () => {
    const tx = createTx([
      { id: 'agenda-1', event_id: 'event-1' },
      [
        { id: 'other', name: 'Viewer', assignee_kind: 'participant', action_rights: [] },
        { id: 'unnamed', name: null, assignee_kind: 'participant', action_rights: [] },
        { id: 'guest', name: 'Organizer', assignee_kind: 'guest', action_rights: [] },
        { id: 'voter', name: 'Voter', assignee_kind: 'participant', action_rights: null },
        {
          id: 'participant',
          name: 'Participant',
          assignee_kind: 'participant',
          action_rights: [
            { resource: 'events', action: 'view' },
            { resource: 'groups', action: 'speak' },
          ],
        },
        {
          id: 'organizer',
          name: 'Organizer',
          assignee_kind: 'participant',
          action_rights: [{ resource: 'events', action: 'speak' }],
        },
      ],
      { id: 'event-1', gender_quota_enabled: false },
    ]);
    await agendaSharedMutators.addSpeaker.fn({ tx: tx as never, ctx, args: speakerArgs });
    expect(tx.mutate.action_right.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.action_right.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'voter' })
    );
    expect(tx.mutate.action_right.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'participant' })
    );
  });

  it('keeps client speaker adds optimistic and rejects missing-event and unexpected permission errors', async () => {
    const client = createTx([], 'client');
    await agendaSharedMutators.addSpeaker.fn({ tx: client as never, ctx, args: speakerArgs });
    expect(client.mutate.speaker_list.insert).toHaveBeenCalled();
    expect(client.run).not.toHaveBeenCalled();

    await expect(
      agendaSharedMutators.addSpeaker.fn({
        tx: createTx([{ id: 'agenda-1', event_id: null }]) as never,
        ctx,
        args: { ...speakerArgs, user_id: ctx.userID },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const unexpected = createTx([{ id: 'agenda-1', event_id: 'event-1' }, []]);
    canMock.mockRejectedValueOnce(new Error('permission backend unavailable'));
    await expect(
      agendaSharedMutators.addSpeaker.fn({
        tx: unexpected as never,
        ctx,
        args: { ...speakerArgs, user_id: ctx.userID },
      })
    ).rejects.toThrow('permission backend unavailable');
  });

  it('applies the gender quota when the speaker user record is missing', async () => {
    const tx = createTx([
      { id: 'agenda-1', event_id: 'event-1' },
      [],
      { id: 'event-1', gender_quota_enabled: true },
      null,
      [],
    ]);
    await expect(
      agendaSharedMutators.addSpeaker.fn({
        tx: tx as never,
        ctx,
        args: { ...speakerArgs, user_id: ctx.userID },
      })
    ).rejects.toThrow();
  });

  it('covers speaker removal and update authorization paths', async () => {
    const client = createTx([], 'client');
    await agendaSharedMutators.removeSpeaker.fn({
      tx: client as never,
      ctx,
      args: { id: 'speaker-1' },
    });
    await agendaSharedMutators.updateSpeaker.fn({
      tx: client as never,
      ctx,
      args: { id: 'speaker-1', completed: true },
    });

    await expect(
      agendaSharedMutators.removeSpeaker.fn({
        tx: createTx([null]) as never,
        ctx,
        args: { id: 'missing' },
      })
    ).rejects.toThrow('Speaker list entry not found');

    await expect(
      agendaSharedMutators.removeSpeaker.fn({
        tx: createTx([
          { id: 'speaker-1', agenda_item_id: 'agenda-1', user_id: 'user-2' },
          { id: 'agenda-1', event_id: null },
        ]) as never,
        ctx,
        args: { id: 'speaker-1' },
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const self = createTx([
      { id: 'speaker-1', agenda_item_id: 'agenda-1', user_id: ctx.userID },
      { id: 'agenda-1', event_id: 'event-1' },
    ]);
    await agendaSharedMutators.removeSpeaker.fn({
      tx: self as never,
      ctx,
      args: { id: 'speaker-1' },
    });
    expect(canMock).not.toHaveBeenCalled();

    const update = createTx([
      { id: 'speaker-1', agenda_item_id: 'agenda-1', user_id: 'user-2' },
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'agenda-1', event_id: 'event-1' },
    ]);
    await agendaSharedMutators.updateSpeaker.fn({
      tx: update as never,
      ctx,
      args: { id: 'speaker-1', completed: true },
    });
    expect(canMock).toHaveBeenCalledWith(update, ctx, {
      action: 'manage_speakers',
      resource: 'events',
      eventId: 'event-1',
    });

    const amendmentUpdate = createTx([
      { id: 'speaker-1', agenda_item_id: 'agenda-1', user_id: 'user-2' },
      { id: 'agenda-1', event_id: null, amendment_id: 'amendment-1' },
      { id: 'agenda-1', event_id: null, amendment_id: 'amendment-1' },
    ]);
    await agendaSharedMutators.updateSpeaker.fn({
      tx: amendmentUpdate as never,
      ctx,
      args: { id: 'speaker-1', completed: true },
    });
    expect(canMock).toHaveBeenCalledWith(amendmentUpdate, ctx, {
      action: 'update',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });

    const other = createTx([
      { id: 'speaker-1', agenda_item_id: 'agenda-1', user_id: 'user-2' },
      { id: 'agenda-1', event_id: 'event-1' },
    ]);
    await agendaSharedMutators.removeSpeaker.fn({
      tx: other as never,
      ctx,
      args: { id: 'speaker-1' },
    });
    expect(canMock).toHaveBeenCalledWith(other, ctx, {
      action: 'manage_speakers',
      resource: 'events',
      eventId: 'event-1',
    });
  });

  it('executes the remaining agenda and server-override facades', async () => {
    const client = createTx([], 'client');
    await agendaSharedMutators.createFull.fn({
      tx: client as never,
      ctx,
      args: { agenda_items: [agendaArgs], roles: [], elections: [], votes: [] },
    });
    await agendaSharedMutators.updateAgendaItem.fn({
      tx: client as never,
      ctx,
      args: { id: 'agenda-1', title: 'Updated' },
    });
    await agendaSharedMutators.reorderAgendaItems.fn({
      tx: client as never,
      ctx,
      args: { items: [{ id: 'agenda-1', order_index: 2 }] },
    });
    await agendaSharedMutators.deleteAgendaItem.fn({
      tx: client as never,
      ctx,
      args: { id: 'agenda-1' },
    });
    await agendaSharedMutators.createAgendaItemChangeRequest.fn({
      tx: client as never,
      ctx,
      args: {
        id: 'link-1',
        agenda_item_id: 'agenda-1',
        change_request_id: null,
        vote_id: null,
        order_index: 0,
        step_kind: 'closing',
        process_branch_id: null,
        is_closing_vote: true,
        status: 'pending',
        blocked_reason: null,
        result_status: null,
        obsolete_reason: null,
      },
    });
    await agendaSharedMutators.initializeChangeRequestVoting.fn({
      tx: client as never,
      ctx,
      args: { amendment_id: 'amendment-1', agenda_item_id: 'agenda-1' },
    });
    await agendaSharedMutators.ensureEventSuggestionChangeRequestVotes.fn({
      tx: client as never,
      ctx,
      args: { amendment_id: 'amendment-1', agenda_item_id: 'agenda-1' },
    });
    await agendaSharedMutators.processCRVoteResult.fn({
      tx: client as never,
      ctx,
      args: { agenda_item_change_request_id: 'link-1', vote_result: 'passed' },
    });

    expect(client.mutate.agenda_item.insert).toHaveBeenCalled();
    expect(client.mutate.agenda_item.update).toHaveBeenCalled();
    expect(client.mutate.agenda_item.delete).toHaveBeenCalled();
    expect(client.mutate.agenda_item_change_request.insert).toHaveBeenCalled();
  });

  it('covers client and server change-request row guards', async () => {
    const client = createTx([], 'client');
    await agendaSharedMutators.updateAgendaItemChangeRequest.fn({
      tx: client as never,
      ctx,
      args: { id: 'link-1', status: 'completed' },
    });
    await agendaSharedMutators.reorderAgendaItemChangeRequests.fn({
      tx: client as never,
      ctx,
      args: { items: [{ id: 'link-1', order_index: 1 }] },
    });
    await agendaSharedMutators.deleteAgendaItemChangeRequest.fn({
      tx: client as never,
      ctx,
      args: { id: 'link-1' },
    });

    await expect(
      agendaSharedMutators.updateAgendaItemChangeRequest.fn({
        tx: createTx([null]) as never,
        ctx,
        args: { id: 'missing', status: 'completed' },
      })
    ).rejects.toThrow('not found');
    await expect(
      agendaSharedMutators.reorderAgendaItemChangeRequests.fn({
        tx: createTx([null]) as never,
        ctx,
        args: { items: [{ id: 'missing', order_index: 1 }] },
      })
    ).rejects.toThrow('not found');
    await expect(
      agendaSharedMutators.deleteAgendaItemChangeRequest.fn({
        tx: createTx([null]) as never,
        ctx,
        args: { id: 'missing' },
      })
    ).rejects.toThrow('not found');

    for (const [name, invoke] of [
      [
        'update',
        (tx: ReturnType<typeof createTx>) =>
          agendaSharedMutators.updateAgendaItemChangeRequest.fn({
            tx: tx as never,
            ctx,
            args: { id: 'link-1', status: 'completed' },
          }),
      ],
      [
        'reorder',
        (tx: ReturnType<typeof createTx>) =>
          agendaSharedMutators.reorderAgendaItemChangeRequests.fn({
            tx: tx as never,
            ctx,
            args: { items: [{ id: 'link-1', order_index: 1 }] },
          }),
      ],
      [
        'delete',
        (tx: ReturnType<typeof createTx>) =>
          agendaSharedMutators.deleteAgendaItemChangeRequest.fn({
            tx: tx as never,
            ctx,
            args: { id: 'link-1' },
          }),
      ],
    ] as const) {
      const server = createTx([
        { id: 'link-1', agenda_item_id: 'agenda-1' },
        { id: 'agenda-1', event_id: 'event-1' },
      ]);
      await invoke(server);
      expect(canMock, name).toHaveBeenCalled();
    }
  });
});

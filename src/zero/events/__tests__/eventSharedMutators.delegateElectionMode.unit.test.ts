import { beforeEach, describe, expect, it, vi } from 'vitest';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { eventSharedMutators } from '../shared-mutators';

type EventCreateMutatorInput = Parameters<typeof eventSharedMutators.create.fn>[0];
type EventCreateMutatorTx = EventCreateMutatorInput['tx'];
type EventCreateMutatorCtx = EventCreateMutatorInput['ctx'];

function createTx(location: EventCreateMutatorTx['location'] = 'server') {
  const table = () => ({ insert: vi.fn(), update: vi.fn(), delete: vi.fn() });
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn().mockResolvedValue(undefined),
    mutate: {
      event: table(),
      event_participant: table(),
      event_participant_role: table(),
      role: table(),
      action_right: table(),
    },
  };
}

function createCtx(): EventCreateMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('eventSharedMutators delegate election mode defaults', () => {
  it('writes a non-null delegate election mode when creating an event', async () => {
    const tx = createTx('server');

    await eventSharedMutators.create.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'event-1',
        title: 'Open Event',
        visibility: 'public',
        group_id: null,
      },
    });

    expect(tx.mutate.event.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        title: 'Open Event',
        visibility: 'public',
        delegate_election_mode: 'list',
      })
    );
  });

  it('keeps delegate election mode non-null when updating an event', async () => {
    const tx = createTx('server');

    tx.run.mockResolvedValue({
      id: 'event-1',
      delegate_election_mode: null,
    });

    await eventSharedMutators.update.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'event-1',
      },
    });

    expect(tx.mutate.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        delegate_election_mode: 'list',
      })
    );
  });
});

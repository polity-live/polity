import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({ can: mocks.can }));
vi.mock('../../voting-password/server-mutators', () => ({
  verifyPassword: mocks.verifyPassword,
}));

import { accreditationServerMutators } from '../server-mutators';
import { accreditationSharedMutators } from '../shared-mutators';

function createTx(rows: unknown[]) {
  const queue = [...rows];
  return {
    location: 'server',
    run: vi.fn(async () => queue.shift()),
    mutate: {
      accreditation: { insert: vi.fn(), update: vi.fn() },
      accreditation_audit: { insert: vi.fn() },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.can.mockResolvedValue(undefined);
});

describe('accreditation workflow', () => {
  it('creates a pending self-request only for an active event participant', async () => {
    const tx = createTx([
      { id: 'agenda-1', event_id: 'event-1', type: 'accreditation' },
      { id: 'participant-1', event_id: 'event-1', user_id: 'user-1', status: 'active' },
      { password_hash: 'hash' },
      null,
    ]);

    await accreditationServerMutators.requestAccreditation.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: { event_id: 'event-1', agenda_item_id: 'agenda-1', password: '1234' },
    });

    expect(tx.mutate.accreditation.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', status: 'pending', confirmed_at: null })
    );
    expect(tx.mutate.accreditation_audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: null, to_status: 'pending', actor_id: 'user-1' })
    );
  });

  it('allows a rejected user to reapply while preserving audit history', async () => {
    const existing = {
      id: 'accreditation-1',
      event_id: 'event-1',
      user_id: 'user-1',
      status: 'rejected',
    };
    const tx = createTx([
      { id: 'agenda-1', event_id: 'event-1', type: 'accreditation' },
      { id: 'participant-1' },
      { password_hash: 'hash' },
      existing,
    ]);

    await accreditationServerMutators.requestAccreditation.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: { event_id: 'event-1', agenda_item_id: 'agenda-1', password: '1234' },
    });

    expect(tx.mutate.accreditation.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'accreditation-1', status: 'pending' })
    );
    expect(tx.mutate.accreditation_audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: 'rejected', to_status: 'pending' })
    );
  });

  it('requires manage_participants to approve a pending request', async () => {
    const tx = createTx([
      { id: 'accreditation-1', event_id: 'event-1', user_id: 'user-1', status: 'pending' },
    ]);

    await accreditationServerMutators.approveAccreditation.fn({
      tx: tx as never,
      ctx: { userID: 'organizer-1' } as never,
      args: { accreditation_id: 'accreditation-1' },
    });

    expect(mocks.can).toHaveBeenCalledWith(
      tx,
      { userID: 'organizer-1' },
      { action: 'manage_participants', resource: 'events', eventId: 'event-1' }
    );
    expect(tx.mutate.accreditation.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', decided_by: 'organizer-1' })
    );
  });

  it.each([
    [null, 'agenda item'],
    [{ id: 'agenda-1', event_id: 'other', type: 'accreditation' }, 'agenda event'],
    [{ id: 'agenda-1', event_id: 'event-1', type: 'discussion' }, 'agenda type'],
  ])('rejects an invalid accreditation %s (%s)', async (agendaItem, _label) => {
    const tx = createTx([agendaItem, { id: 'participant-1' }, { password_hash: 'hash' }, null]);

    await expect(
      accreditationServerMutators.requestAccreditation.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: { event_id: 'event-1', agenda_item_id: 'agenda-1', password: '1234' },
      })
    ).rejects.toThrow('does not belong');
  });

  it('rejects inactive participants, missing passwords, invalid passwords, and approved repeats', async () => {
    const args = { event_id: 'event-1', agenda_item_id: 'agenda-1', password: '1234' };
    const agendaItem = { id: 'agenda-1', event_id: 'event-1', type: 'accreditation' };

    await expect(
      accreditationServerMutators.requestAccreditation.fn({
        tx: createTx([agendaItem, null, { password_hash: 'hash' }, null]) as never,
        ctx: { userID: 'user-1' } as never,
        args,
      })
    ).rejects.toThrow('Only active');
    await expect(
      accreditationServerMutators.requestAccreditation.fn({
        tx: createTx([agendaItem, { id: 'participant-1' }, null, null]) as never,
        ctx: { userID: 'user-1' } as never,
        args,
      })
    ).rejects.toThrow();

    mocks.verifyPassword.mockResolvedValueOnce(false);
    await expect(
      accreditationServerMutators.requestAccreditation.fn({
        tx: createTx([
          agendaItem,
          { id: 'participant-1' },
          { password_hash: 'hash' },
          null,
        ]) as never,
        ctx: { userID: 'user-1' } as never,
        args,
      })
    ).rejects.toThrow();

    await expect(
      accreditationServerMutators.requestAccreditation.fn({
        tx: createTx([
          agendaItem,
          { id: 'participant-1' },
          { password_hash: 'hash' },
          { id: 'accreditation-1', status: 'approved' },
        ]) as never,
        ctx: { userID: 'user-1' } as never,
        args,
      })
    ).rejects.toThrow('Already accredited');
  });

  it('rejects missing and invalid decision transitions', async () => {
    await expect(
      accreditationServerMutators.approveAccreditation.fn({
        tx: createTx([null]) as never,
        ctx: { userID: 'organizer-1' } as never,
        args: { accreditation_id: 'missing' },
      })
    ).rejects.toThrow('not found');

    await expect(
      accreditationServerMutators.approveAccreditation.fn({
        tx: createTx([
          { id: 'accreditation-1', event_id: 'event-1', user_id: 'user-1', status: 'approved' },
        ]) as never,
        ctx: { userID: 'organizer-1' } as never,
        args: { accreditation_id: 'accreditation-1' },
      })
    ).rejects.toThrow('must be pending');
  });

  it('rejects and revokes without assigning a confirmed timestamp', async () => {
    const rejected = createTx([
      { id: 'accreditation-1', event_id: 'event-1', user_id: 'user-1', status: 'pending' },
    ]);
    await accreditationServerMutators.rejectAccreditation.fn({
      tx: rejected as never,
      ctx: { userID: 'organizer-1' } as never,
      args: { accreditation_id: 'accreditation-1', reason: 'Incomplete' },
    });
    expect(rejected.mutate.accreditation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        confirmed_at: null,
        decision_reason: 'Incomplete',
      })
    );

    const revoked = createTx([
      { id: 'accreditation-1', event_id: 'event-1', user_id: 'user-1', status: 'approved' },
    ]);
    await accreditationServerMutators.revokeAccreditation.fn({
      tx: revoked as never,
      ctx: { userID: 'organizer-1' } as never,
      args: { accreditation_id: 'accreditation-1' },
    });
    expect(revoked.mutate.accreditation.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'revoked', confirmed_at: null, decision_reason: null })
    );
  });

  it('allows only client-side deletion compatibility calls', async () => {
    await expect(
      accreditationSharedMutators.deleteAccreditation.fn({
        tx: { location: 'client' } as never,
        ctx: { userID: 'user-1' } as never,
        args: { id: 'accreditation-1' },
      })
    ).resolves.toBeUndefined();
    await expect(
      accreditationSharedMutators.deleteAccreditation.fn({
        tx: { location: 'server' } as never,
        ctx: { userID: 'user-1' } as never,
        args: { id: 'accreditation-1' },
      })
    ).rejects.toThrow('append-only audit history');
  });
});

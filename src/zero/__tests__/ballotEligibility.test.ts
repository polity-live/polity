import { describe, expect, it, vi } from 'vitest';
import { snapshotElectionElectorate, snapshotVoteElectorate } from '../ballot-eligibility';

const activeRight = (eventId = 'event-1') => ({
  participant_roles: [
    {
      role: {
        action_rights: [{ action: 'active_voting', resource: 'events', event_id: eventId }],
      },
    },
  ],
});

function txWithRows(rows: unknown[]) {
  const queue = [...rows];
  return {
    location: 'server',
    run: vi.fn(async () => queue.shift()),
    mutate: {
      voter: { insert: vi.fn() },
      elector: { insert: vi.fn() },
      vote: { update: vi.fn() },
      election: { update: vi.fn() },
    },
  };
}

describe('ballot electorate snapshots', () => {
  it('intersects active voting rights with approved accreditation and freezes channels', async () => {
    const tx = txWithRows([
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
      [],
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'event-1', attendance_mode: 'hybrid', accreditation_required: true },
      [
        { user_id: 'approved', ...activeRight() },
        { user_id: 'not-approved', ...activeRight() },
        { user_id: 'no-right', participant_roles: [] },
      ],
      [{ user_id: 'approved', status: 'approved' }],
      [
        {
          connected_user_id: 'approved',
          participation_channel: 'offline',
          attendance_status: 'confirmed',
        },
        {
          connected_user_id: null,
          participation_channel: 'offline',
          attendance_status: 'confirmed',
        },
      ],
    ]);

    await snapshotVoteElectorate(tx as never, 'vote-1');

    expect(tx.mutate.voter.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.voter.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'approved', participation_channel: 'offline' })
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vote-1', offline_electorate_size: 2 })
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vote-1', electorate_snapshotted_at: expect.any(Number) })
    );
  });

  it('uses the same eligibility rules for elections without requiring accreditation by default', async () => {
    const tx = txWithRows([
      { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
      [],
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'event-1', attendance_mode: 'online', accreditation_required: false },
      [
        { user_id: 'eligible', ...activeRight() },
        { user_id: 'no-right', participant_roles: [] },
      ],
      [],
    ]);

    await snapshotElectionElectorate(tx as never, 'election-1');

    expect(tx.mutate.elector.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.elector.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'eligible', participation_channel: 'online' })
    );
  });

  it('never recomputes an existing snapshot', async () => {
    const tx = txWithRows([
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 123 },
    ]);
    await snapshotVoteElectorate(tx as never, 'vote-1');
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
  });
});

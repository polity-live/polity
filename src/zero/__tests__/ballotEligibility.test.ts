import { describe, expect, it, vi } from 'vitest';
import {
  assertCurrentOnlineBallotEligibility,
  snapshotElectionElectorate,
  snapshotVoteElectorate,
} from '../ballot-eligibility';

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

  it('ignores stale offline assignments when snapshotting an online event', async () => {
    const tx = txWithRows([
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
      [],
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'event-1', attendance_mode: 'online', accreditation_required: false },
      [{ user_id: 'eligible', ...activeRight() }],
      [
        {
          connected_user_id: 'eligible',
          participation_channel: 'offline',
          attendance_status: 'confirmed',
        },
      ],
    ]);

    await snapshotVoteElectorate(tx as never, 'vote-1');

    expect(tx.mutate.voter.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'eligible', participation_channel: 'online' })
    );
    expect(tx.mutate.vote.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vote-1', offline_electorate_size: 0 })
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

  it('rejects ballots that are not connected to a live event', async () => {
    const noAgenda = txWithRows([]);
    await expect(
      assertCurrentOnlineBallotEligibility(noAgenda as never, null, 'user-1')
    ).rejects.toThrow('Ballot is not linked to an event agenda item.');

    const noEventId = txWithRows([{ id: 'agenda-1', event_id: null }]);
    await expect(
      assertCurrentOnlineBallotEligibility(noEventId as never, 'agenda-1', 'user-1')
    ).rejects.toThrow('Ballot is not linked to an event.');

    const missingEvent = txWithRows([{ id: 'agenda-1', event_id: 'event-1' }, undefined]);
    await expect(
      assertCurrentOnlineBallotEligibility(missingEvent as never, 'agenda-1', 'user-1')
    ).rejects.toThrow('Event not found.');
  });

  it('accepts eligible online users and rejects ineligible or forced-offline users', async () => {
    const rows = (participants: unknown[], offlineRows: unknown[] = []) => [
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'event-1', attendance_mode: 'hybrid', accreditation_required: false },
      participants,
      offlineRows,
    ];
    const online = txWithRows(rows([{ user_id: 'online', ...activeRight() }]));
    await expect(
      assertCurrentOnlineBallotEligibility(online as never, 'agenda-1', 'online')
    ).resolves.toEqual({
      event: expect.objectContaining({ id: 'event-1' }),
      participationChannel: 'online',
    });

    const ineligible = txWithRows(
      rows([
        { user_id: 'missing-roles' },
        { user_id: 'null-role', participant_roles: [{ role: null }] },
        {
          user_id: 'wrong-action',
          participant_roles: [
            {
              role: {
                action_rights: [
                  { action: 'read', resource: 'events', event_id: 'event-1' },
                  { action: 'active_voting', resource: 'groups', event_id: 'event-1' },
                  { action: 'active_voting', resource: 'events', event_id: 'other-event' },
                ],
              },
            },
          ],
        },
      ])
    );
    await expect(
      assertCurrentOnlineBallotEligibility(ineligible as never, 'agenda-1', 'missing-roles')
    ).rejects.toThrow('You are not currently eligible to vote in this event.');

    const offline = txWithRows(
      rows(
        [{ user_id: 'offline', ...activeRight() }],
        [{ connected_user_id: 'offline', participation_channel: 'offline' }]
      )
    );
    await expect(
      assertCurrentOnlineBallotEligibility(offline as never, 'agenda-1', 'offline')
    ).rejects.toThrow('This vote must be entered via the offline tally flow');
  });

  it('rejects missing ballots and skips electorate reconstruction when rows already exist', async () => {
    await expect(
      snapshotVoteElectorate(txWithRows([undefined]) as never, 'missing')
    ).rejects.toThrow('Vote not found.');
    await expect(
      snapshotElectionElectorate(txWithRows([undefined]) as never, 'missing')
    ).rejects.toThrow('Election not found.');

    const vote = txWithRows([
      { id: 'vote-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
      [{ id: 'existing-voter' }],
    ]);
    await snapshotVoteElectorate(vote as never, 'vote-1');
    expect(vote.run).toHaveBeenCalledTimes(2);
    expect(vote.mutate.voter.insert).not.toHaveBeenCalled();
    expect(vote.mutate.vote.update).toHaveBeenCalledTimes(1);

    const frozenElection = txWithRows([
      { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: 42 },
    ]);
    await snapshotElectionElectorate(frozenElection as never, 'election-1');
    expect(frozenElection.run).toHaveBeenCalledTimes(1);
    expect(frozenElection.mutate.elector.insert).not.toHaveBeenCalled();

    const existingElection = txWithRows([
      { id: 'election-2', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
      [{ id: 'existing-elector' }],
    ]);
    await snapshotElectionElectorate(existingElection as never, 'election-2');
    expect(existingElection.run).toHaveBeenCalledTimes(2);
    expect(existingElection.mutate.elector.insert).not.toHaveBeenCalled();
    expect(existingElection.mutate.election.update).toHaveBeenCalledTimes(1);
  });

  it('counts connected and unconnected offline electorate members for elections', async () => {
    const tx = txWithRows([
      { id: 'election-1', agenda_item_id: 'agenda-1', electorate_snapshotted_at: null },
      [],
      { id: 'agenda-1', event_id: 'event-1' },
      { id: 'event-1', attendance_mode: 'offline', accreditation_required: false },
      [{ user_id: 'connected', ...activeRight() }],
      [
        { connected_user_id: 'connected', participation_channel: 'offline' },
        { connected_user_id: null, participation_channel: 'offline' },
      ],
    ]);

    await snapshotElectionElectorate(tx as never, 'election-1');
    expect(tx.mutate.elector.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'connected', participation_channel: 'offline' })
    );
    expect(tx.mutate.election.update).toHaveBeenCalledWith(
      expect.objectContaining({ offline_electorate_size: 2 })
    );
  });
});

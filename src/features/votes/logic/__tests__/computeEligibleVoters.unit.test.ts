import { describe, expect, it } from 'vitest';

import {
  computeEligibleFinalVoterCount,
  computeEligibleVoters,
  countConfirmedOfflineAttendees,
  getHybridOfflineOverrideUserIds,
  participantHasActiveVotingRight,
} from '../computeEligibleVoters';

const activeVotingRight = { action: 'active_voting', resource: 'events' };
const passiveVotingRight = { action: 'passive_voting', resource: 'events' };

function participant({
  userId,
  status = 'active',
  rights = [activeVotingRight],
  useParticipantRoles = true,
}: {
  userId: string;
  status?: string;
  rights?: readonly { action: string; resource: string }[];
  useParticipantRoles?: boolean;
}) {
  const role = { action_rights: rights };

  return {
    id: `participant-${userId}`,
    user_id: userId,
    status,
    user: { id: userId, name: userId },
    ...(useParticipantRoles ? { participant_roles: [{ role }] } : { roles: [role] }),
  };
}

describe('computeEligibleFinalVoterCount', () => {
  it('handles absent collections and filters hybrid override rows', () => {
    expect(computeEligibleFinalVoterCount({ participants: null })).toBe(0);
    expect(getHybridOfflineOverrideUserIds(null)).toEqual(new Set());
    expect(
      getHybridOfflineOverrideUserIds([
        { id: 'missing-user', participation_channel: 'offline' },
        { id: 'online', connected_user_id: 'online', participation_channel: 'online' },
        { id: 'offline', connected_user_id: 'offline', participation_channel: 'offline' },
      ])
    ).toEqual(new Set(['offline']));
  });

  it('counts only confirmed offline people and distinguishes local identities', () => {
    expect(
      countConfirmedOfflineAttendees([
        { id: 'pending', attendance_status: 'pending', participation_channel: 'offline' },
        { id: 'online', attendance_status: 'confirmed', participation_channel: 'online' },
        { id: 'person', attendance_status: 'confirmed', participation_channel: 'offline' },
        {
          id: 'connected',
          connected_user_id: 'user-1',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
      ])
    ).toBe(2);
  });

  it('counts active event participants with active voting rights', () => {
    expect(
      computeEligibleFinalVoterCount({
        participants: [
          participant({ userId: 'alice' }),
          participant({ userId: 'bob', useParticipantRoles: false }),
          participant({ userId: 'viewer', rights: [passiveVotingRight] }),
          participant({ userId: 'invited', status: 'invited' }),
        ],
        offlineParticipants: [],
      })
    ).toBe(2);
  });

  it('uses scalar user ids and rejects rows with no user identity', () => {
    const role = { action_rights: [activeVotingRight] };
    expect(
      computeEligibleFinalVoterCount({
        participants: [
          { status: 'active', user_id: 'scalar-user', user: null, role },
          { status: 'active', user: null, role },
        ],
      })
    ).toBe(1);
  });

  it('excludes forced-offline users from online eligibility and counts confirmed offline attendees', () => {
    expect(
      computeEligibleFinalVoterCount({
        participants: [
          participant({ userId: 'online' }),
          participant({ userId: 'offline-confirmed' }),
          participant({ userId: 'offline-pending' }),
        ],
        offlineParticipants: [
          {
            id: 'offline-confirmed-row',
            connected_user_id: 'offline-confirmed',
            attendance_status: 'confirmed',
            participation_channel: 'offline',
          },
          {
            id: 'offline-pending-row',
            connected_user_id: 'offline-pending',
            attendance_status: 'pending',
            participation_channel: 'offline',
          },
          {
            id: 'offline-person',
            connected_user_id: null,
            attendance_status: 'confirmed',
            participation_channel: 'offline',
          },
        ],
      })
    ).toBe(3);
  });
});

describe('computeEligibleVoters', () => {
  it('finds voting rights across direct, plural, and linked roles', () => {
    expect(participantHasActiveVotingRight({ role: { action_rights: [activeVotingRight] } })).toBe(
      true
    );
    expect(
      participantHasActiveVotingRight({ roles: [{ action_rights: [activeVotingRight] }] })
    ).toBe(true);
    expect(
      participantHasActiveVotingRight({
        participant_roles: [{ role: null }, { role: { action_rights: [activeVotingRight] } }],
      })
    ).toBe(true);
    expect(participantHasActiveVotingRight({ roles: [{ action_rights: null }] })).toBe(false);
    expect(
      participantHasActiveVotingRight({
        role: { action_rights: [{ action: 'active_voting', resource: 'groups' }] },
      })
    ).toBe(false);
  });

  it('supports participant_roles role links when building voter rows', () => {
    expect(computeEligibleVoters([participant({ userId: 'alice' })], new Set(['alice']))).toEqual([
      { id: 'alice', name: 'alice', hasVoted: true },
    ]);
  });

  it('builds names from explicit, split, blank, and absent user fields', () => {
    const make = (id: string, user: Record<string, unknown>) => ({
      status: 'active',
      user_id: id,
      user: { id, ...user },
      role: { action_rights: [activeVotingRight] },
    });

    expect(
      computeEligibleVoters(
        [
          make('named', { name: 'Display' }),
          make('split', { first_name: 'Ada', last_name: 'Lovelace' }),
          make('blank', { first_name: null, last_name: null }),
          { role: { action_rights: [activeVotingRight] }, user: null },
        ],
        new Set(['split'])
      )
    ).toEqual([
      { id: 'named', name: 'Display', hasVoted: false },
      { id: 'split', name: 'Ada Lovelace', hasVoted: true },
      { id: 'blank', name: undefined, hasVoted: false },
    ]);
  });
});

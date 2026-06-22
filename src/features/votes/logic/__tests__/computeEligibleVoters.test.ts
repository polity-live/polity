import { describe, expect, it } from 'vitest';

import { computeEligibleFinalVoterCount, computeEligibleVoters } from '../computeEligibleVoters';

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
  it('supports participant_roles role links when building voter rows', () => {
    expect(computeEligibleVoters([participant({ userId: 'alice' })], new Set(['alice']))).toEqual([
      { id: 'alice', name: 'alice', hasVoted: true },
    ]);
  });
});

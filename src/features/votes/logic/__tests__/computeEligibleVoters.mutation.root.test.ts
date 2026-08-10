import { describe, expect, it } from 'vitest';

import {
  ACTIVE_EVENT_PARTICIPANT_STATUSES,
  computeEligibleFinalVoterCount,
  countConfirmedOfflineAttendees,
  participantHasActiveVotingRight,
} from '../computeEligibleVoters';

const activeVotingRight = { action: 'active_voting', resource: 'events' };
const passiveVotingRight = { action: 'passive_voting', resource: 'events' };

describe('eligible voter mutation contracts', () => {
  it('keeps the complete active participant status decision table exact', () => {
    expect([...ACTIVE_EVENT_PARTICIPANT_STATUSES]).toEqual([
      'active',
      'confirmed',
      'member',
      'admin',
    ]);
    expect(ACTIVE_EVENT_PARTICIPANT_STATUSES.has('invited')).toBe(false);
  });

  it('uses existential voting rights across both roles and rights', () => {
    expect(
      participantHasActiveVotingRight({
        roles: [{ action_rights: [passiveVotingRight] }, { action_rights: [activeVotingRight] }],
      })
    ).toBe(true);
    expect(
      participantHasActiveVotingRight({
        role: { action_rights: [passiveVotingRight, activeVotingRight] },
      })
    ).toBe(true);
    expect(participantHasActiveVotingRight({ participant_roles: null })).toBe(false);
  });

  it('distinguishes every connected and local offline identity', () => {
    expect(
      countConfirmedOfflineAttendees([
        {
          id: 'local-a',
          connected_user_id: 'user-a',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
        {
          id: 'local-b',
          connected_user_id: 'user-b',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
        {
          id: 'local-a',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
        {
          id: 'local-b',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
      ])
    ).toBe(4);
  });

  it('rejects missing and unknown statuses while accepting every active status', () => {
    const role = { action_rights: [activeVotingRight] };
    const participants = [
      ...[...ACTIVE_EVENT_PARTICIPANT_STATUSES].map(status => ({
        status,
        user_id: status,
        role,
      })),
      { status: undefined, user_id: 'missing', role },
      { status: 'invited', user_id: 'invited', role },
    ];

    expect(computeEligibleFinalVoterCount({ participants })).toBe(4);
    expect(computeEligibleFinalVoterCount({ participants: undefined })).toBe(0);
  });
});

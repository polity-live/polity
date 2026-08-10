import { fc, test } from '@fast-check/vitest';
import { expect } from 'vitest';

import {
  computeEligibleFinalVoterCount,
  countConfirmedOfflineAttendees,
} from '../computeEligibleVoters';

const identifier = fc.integer({ min: 0, max: 30 }).map(String);

test.prop([
  fc.array(
    fc.record({
      id: identifier,
      connected_user_id: fc.option(identifier, { nil: null }),
      attendance_status: fc.constantFrom('confirmed', 'invited', 'declined'),
      participation_channel: fc.constantFrom('offline', 'online'),
    }),
    { maxLength: 100 }
  ),
])('confirmed offline attendees are deduplicated by their real identity', participants => {
  const expected = new Set(
    participants
      .filter(
        participant =>
          participant.attendance_status === 'confirmed' &&
          participant.participation_channel === 'offline'
      )
      .map(participant =>
        participant.connected_user_id
          ? `user:${participant.connected_user_id}`
          : `offline:${participant.id}`
      )
  ).size;
  expect(countConfirmedOfflineAttendees(participants)).toBe(expected);
});

test.prop([fc.uniqueArray(identifier, { maxLength: 50 })])(
  'hybrid users forced offline are never counted as online voters as well',
  userIds => {
    const votingRight = {
      action_rights: [{ action: 'active_voting', resource: 'events' }],
    };
    const participants = userIds.map(user_id => ({
      status: 'active',
      user_id,
      user: { id: user_id },
      role: votingRight,
    }));
    const offlineParticipants = userIds.map(id => ({
      id: `offline-${id}`,
      connected_user_id: id,
      attendance_status: 'confirmed',
      participation_channel: 'offline',
    }));

    expect(computeEligibleFinalVoterCount({ participants, offlineParticipants })).toBe(
      userIds.length
    );
  }
);

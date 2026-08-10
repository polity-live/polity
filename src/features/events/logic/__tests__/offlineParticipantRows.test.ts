import { describe, expect, it } from 'vitest';

import { buildOfflineRosterRowsForEvent } from '../offlineParticipantRows';

const activeParticipant = {
  id: 'participant-1',
  user_id: 'user-1',
  user: {
    id: 'user-1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.test',
  },
};

function connectedOfflineParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'offline-meta-1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    source_type: 'event_extra',
    reason_not_signed_up: null,
    connected_user_id: 'user-1',
    connected_user: {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.test',
    },
    attendance_status: 'listed',
    participation_channel: 'offline',
    ...overrides,
  };
}

describe('buildOfflineRosterRowsForEvent', () => {
  it('makes active users confirmable in offline events when no attendance row exists', () => {
    const model = buildOfflineRosterRowsForEvent({
      attendanceMode: 'offline',
      activeParticipants: [activeParticipant],
      offlineParticipants: [],
    });

    expect(model.allRows).toHaveLength(1);
    expect(model.allRows[0]).toMatchObject({
      kind: 'active',
      attendanceStatus: 'listed',
      participationChannel: 'offline',
      canConfirmParticipation: true,
      canWithdrawParticipation: false,
    });
  });

  it('makes confirmed active offline users withdrawable through the merged attendance row', () => {
    const model = buildOfflineRosterRowsForEvent({
      attendanceMode: 'offline',
      activeParticipants: [activeParticipant],
      offlineParticipants: [connectedOfflineParticipant({ attendance_status: 'confirmed' })],
    });

    expect(model.allRows).toHaveLength(1);
    expect(model.offlineRows).toHaveLength(0);
    expect(model.allRows[0]).toMatchObject({
      kind: 'active',
      attendanceParticipantId: 'offline-meta-1',
      attendanceStatus: 'confirmed',
      participationChannel: 'offline',
      canConfirmParticipation: false,
      canWithdrawParticipation: true,
    });
  });

  it('treats hybrid active online users as automatically confirmed and not offline confirmable', () => {
    const model = buildOfflineRosterRowsForEvent({
      attendanceMode: 'hybrid',
      activeParticipants: [activeParticipant],
      offlineParticipants: [],
    });

    expect(model.allRows[0]).toMatchObject({
      attendanceStatus: 'confirmed',
      participationChannel: 'online',
      canConfirmParticipation: false,
      canWithdrawParticipation: false,
    });
  });

  it('counts hybrid offline overrides only when they are confirmed and offline', () => {
    const listedOffline = buildOfflineRosterRowsForEvent({
      attendanceMode: 'hybrid',
      activeParticipants: [activeParticipant],
      offlineParticipants: [connectedOfflineParticipant({ attendance_status: 'listed' })],
    });
    const confirmedOffline = buildOfflineRosterRowsForEvent({
      attendanceMode: 'hybrid',
      activeParticipants: [activeParticipant],
      offlineParticipants: [connectedOfflineParticipant({ attendance_status: 'confirmed' })],
    });

    const countConfirmedOffline = (rows: typeof listedOffline.allRows) =>
      rows.filter(
        row => row.attendanceStatus === 'confirmed' && row.participationChannel === 'offline'
      ).length;

    expect(countConfirmedOffline(listedOffline.allRows)).toBe(0);
    expect(countConfirmedOffline(confirmedOffline.allRows)).toBe(1);
  });

  it('keeps connected metadata rows out of the offline row list when the active user is present', () => {
    const model = buildOfflineRosterRowsForEvent({
      attendanceMode: 'hybrid',
      activeParticipants: [activeParticipant],
      offlineParticipants: [
        connectedOfflineParticipant({ attendance_status: 'confirmed' }),
        {
          id: 'offline-extra-1',
          first_name: 'Grace',
          last_name: 'Hopper',
          source_type: 'event_extra',
          reason_not_signed_up: null,
          connected_user_id: null,
          connected_user: null,
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
      ],
    });

    expect(model.activeRows).toHaveLength(1);
    expect(model.offlineRows).toHaveLength(1);
    expect(model.allRows.map(row => row.id)).toEqual(['active:participant-1', 'offline-extra-1']);
  });

  it('normalizes sparse active identities, provenance groups, roles, and online attendance', () => {
    const model = buildOfflineRosterRowsForEvent({
      attendanceMode: 'online',
      activeParticipants: [
        {
          id: 'user-object',
          user_id: null,
          user: { id: 'user-2', first_name: null, last_name: null },
          roles: null,
          partGroup: { id: 'part-1', name: 42 },
          baseGroup: { id: '', name: 'Invalid' },
        },
        {
          id: 'no-user',
          user_id: null,
          user: null,
          roles: [],
          partGroup: null,
          baseGroup: 'invalid',
        },
      ],
      offlineParticipants: [],
      showParticipantComposition: true,
      showBaseGroupColumn: true,
    });
    expect(model.activeRows[0]).toMatchObject({
      firstName: '',
      lastName: '',
      partGroup: { id: 'part-1', name: null },
      baseGroup: null,
      attendanceStatus: null,
      participationChannel: null,
      roles: null,
    });
    expect(model.activeRows[1]).toMatchObject({ partGroup: null, baseGroup: null });
  });

  it('uses hybrid online overrides, duplicate connected rows, and every offline row capability', () => {
    const model = buildOfflineRosterRowsForEvent({
      attendanceMode: 'hybrid',
      activeParticipants: [activeParticipant],
      offlineParticipants: [
        connectedOfflineParticipant({
          id: 'online-override',
          participation_channel: 'online',
          attendance_status: 'listed',
        }),
        connectedOfflineParticipant({ id: 'duplicate', attendance_status: 'confirmed' }),
        {
          id: 'group-member',
          first_name: 'Group',
          last_name: 'Member',
          source_type: 'group_member',
          attendance_status: 'listed',
          participation_channel: 'online',
          connected_user_id: 'inactive-user',
          connected_user: { id: 'inactive-user', first_name: 'Inactive' },
          group_offline_member: { group: { id: 'source-group', name: 'Source Group' } },
        },
        {
          id: 'event-extra',
          first_name: 'Extra',
          last_name: 'Person',
          source_type: 'event_extra',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
          connected_user_id: null,
          connected_user: null,
          group_offline_member: { group: { id: null, name: 'Invalid' } },
        },
      ],
      eventBaseGroupReference: { id: 'base-group', name: 'Base Group' },
      showParticipantComposition: false,
      showBaseGroupColumn: true,
    });
    expect(model.activeRows[0]).toMatchObject({
      attendanceStatus: 'confirmed',
      participationChannel: 'online',
      canToggleChannel: true,
    });
    expect(model.offlineRows).toEqual([
      expect.objectContaining({
        id: 'group-member',
        readOnlyIdentity: true,
        canConnect: false,
        canEdit: false,
        canDelete: false,
        canConfirmParticipation: true,
        canWithdrawParticipation: false,
        canToggleChannel: true,
        participationChannel: 'online',
        partGroup: { id: 'source-group', name: 'Source Group' },
      }),
      expect.objectContaining({
        id: 'event-extra',
        readOnlyIdentity: false,
        canConnect: true,
        canEdit: true,
        canDelete: true,
        canConfirmParticipation: false,
        canWithdrawParticipation: true,
        canToggleChannel: false,
        participationChannel: 'offline',
        partGroup: { id: 'base-group', name: 'Base Group' },
      }),
    ]);
  });
});

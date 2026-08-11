import { describe, expect, it } from 'vitest';

import { buildCompositionOfflineRosterRows } from '../GroupMembershipsContentContainer';

describe('GroupMembershipsContentContainer offline composition rows', () => {
  it('renders rows from materialized offline memberships instead of source roster rows', () => {
    const rows = buildCompositionOfflineRosterRows(
      [
        {
          id: 'h2-offline-membership-b3',
          group_offline_member_id: 'offline-b3-user',
          group_offline_member: {
            id: 'offline-b3-user',
            first_name: 'B3',
            last_name: 'Member',
            reason_not_signed_up: 'not signed up yet',
            connected_user: null,
          },
          user: {
            id: null,
            first_name: 'B3',
            last_name: 'Member',
            handle: null,
            avatar: null,
            email: null,
          },
          roles: [{ id: 'member-role', name: 'Member' }],
          partGroup: { id: 'B3', name: 'B3' },
          baseGroup: { id: 'B3', name: 'B3' },
        } as any,
      ],
      true
    );

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'offline-b3-user',
        effectiveMembershipId: 'h2-offline-membership-b3',
        firstName: 'B3',
        lastName: 'Member',
        partGroup: { id: 'B3', name: 'B3' },
        baseGroup: { id: 'B3', name: 'B3' },
        canViewRights: true,
        canManageRoles: true,
        readOnlyIdentity: true,
      }),
    ]);
  });
});

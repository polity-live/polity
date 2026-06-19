import { describe, expect, it } from 'vitest';
import {
  augmentMembershipsWithCurrentRoleHolders,
  getMembershipAssignedRoles,
  getMembershipDisplayRoles,
} from '../membershipDisplayRoles';

describe('membershipDisplayRoles', () => {
  it('deduplicates direct and elected roles while preserving direct roles for mutations', () => {
    const chair = { id: 'role-chair', name: 'Chair', sort_order: 20 };
    const treasurer = { id: 'role-treasurer', name: 'Treasurer', sort_order: 10 };
    const membership = {
      id: 'membership-1',
      roles: [treasurer],
      role: treasurer,
      elected_roles: [chair, treasurer],
    };

    expect(getMembershipAssignedRoles(membership)).toEqual([treasurer]);
    expect(getMembershipDisplayRoles(membership)).toEqual([chair, treasurer]);
  });

  it('projects only current elected group-role holders into memberships', () => {
    const memberships = [
      {
        id: 'membership-1',
        user_id: 'user-1',
        user: { id: 'user-1' },
        roles: [],
        role: null,
      },
      {
        id: 'membership-2',
        user_id: 'user-2',
        user: { id: 'user-2' },
        roles: [],
        role: null,
      },
    ];
    const chair = {
      id: 'role-chair',
      name: 'Chair',
      scope: 'group',
      assignment_mode: 'elected',
      holder_history: [
        { user_id: 'user-1', end_date: null },
        { user_id: 'user-2', end_date: 1_781_866_000_000 },
      ],
    };
    const appointed = {
      id: 'role-appointed',
      name: 'Appointed',
      scope: 'group',
      assignment_mode: 'assigned',
      holder_history: [{ user_id: 'user-1', end_date: null }],
    };

    const augmented = augmentMembershipsWithCurrentRoleHolders(memberships, [chair, appointed]);

    expect(augmented[0].elected_roles).toEqual([chair]);
    expect(augmented[1].elected_roles).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  augmentMembershipsWithCurrentRoleHolders,
  getMembershipAssignedRoles,
  getMembershipDisplayRoles,
  getMembershipRoleSummary,
  hasElectedDisplayRole,
  sortGroupRoles,
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

  it('sorts equal-priority and missing-priority roles by nullable names', () => {
    const unnamed = { id: 'unnamed', name: null, sort_order: null };
    const alpha = { id: 'alpha', name: 'Alpha', sort_order: null };
    const beta = { id: 'beta', name: 'Beta', sort_order: null };

    expect(sortGroupRoles([beta, unnamed, alpha])).toEqual([unnamed, alpha, beta]);
    expect(
      sortGroupRoles([
        { id: 'low', name: 'Low', sort_order: 1 },
        { id: 'high', name: 'High', sort_order: 2 },
      ]).map(role => role.id)
    ).toEqual(['high', 'low']);
  });

  it('falls back from the role collection to the legacy singular role', () => {
    const legacyRole = { id: 'legacy', name: 'Legacy' };

    expect(
      getMembershipAssignedRoles({ id: 'legacy-membership', roles: [], role: legacyRole })
    ).toEqual([legacyRole]);
    expect(getMembershipAssignedRoles({ id: 'empty-membership', roles: [], role: null })).toEqual(
      []
    );
  });

  it('detects elected display roles without conflating directly assigned roles', () => {
    const role = { id: 'chair', name: 'Chair' };
    const membership = { id: 'membership', roles: [role], elected_roles: [role] };

    expect(hasElectedDisplayRole(membership, 'chair')).toBe(true);
    expect(hasElectedDisplayRole(membership, 'other')).toBe(false);
    expect(hasElectedDisplayRole({ id: 'direct-only', roles: [role] }, 'chair')).toBe(false);
  });

  it('returns memberships unchanged when no current elected group holder exists', () => {
    const memberships = [{ id: 'membership', user_id: 'user-1', roles: [] }];
    const roles = [
      {
        id: 'wrong-assignment',
        assignment_mode: 'assigned',
        scope: 'group',
        holders: [{ user_id: 'user-1', end_date: null }],
      },
      {
        id: 'wrong-scope',
        assignment_mode: 'elected',
        scope: 'event',
        holders: [{ user_id: 'user-1', end_date: null }],
      },
      {
        id: 'no-current-holder',
        assignment_mode: 'elected',
        scope: 'group',
        holder_history: [
          { user_id: null, end_date: null },
          { user_id: 'user-1', end_date: 1 },
        ],
      },
      {
        id: 'no-history',
        assignment_mode: 'elected',
        scope: 'group',
      },
    ];

    expect(augmentMembershipsWithCurrentRoleHolders(memberships, roles)).toEqual(memberships);
  });

  it('reads legacy holders, user-id fallbacks, and existing elected roles', () => {
    const existing = { id: 'existing', name: 'Existing', sort_order: 1 };
    const chair = {
      id: 'chair',
      name: 'Chair',
      sort_order: 2,
      assignment_mode: 'elected',
      scope: 'group',
      holders: [{ user_id: 'user-1', end_date: null }],
    };
    const memberships = [
      { id: 'one', user_id: 'user-1', roles: [], elected_roles: [existing, chair] },
      { id: 'missing-id', roles: [] },
      { id: 'unmatched', user_id: 'user-2', roles: [] },
    ];

    const result = augmentMembershipsWithCurrentRoleHolders(memberships, [chair]);

    expect(result[0]?.elected_roles?.map(role => role.id)).toEqual(['chair', 'existing']);
    expect(result[1]).toBe(memberships[1]);
    expect(result[2]).toBe(memberships[2]);
  });

  it('formats assigned and elected role summaries with stable fallbacks', () => {
    expect(
      getMembershipRoleSummary({
        id: 'membership',
        roles: [
          { id: 'named', name: 'Chair', sort_order: 2 },
          { id: 'unnamed', name: null, sort_order: 1 },
        ],
      })
    ).toBe('Chair, Role');
    expect(getMembershipRoleSummary({ id: 'membership', roles: [] })).toBe('Member');
  });
});

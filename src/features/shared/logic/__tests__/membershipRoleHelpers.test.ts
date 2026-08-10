import { describe, expect, it } from 'vitest';

import {
  getMembershipRoleNames,
  getMembershipRoles,
  getPrimaryMembershipRole,
} from '../membershipRoleHelpers';
import type { MembershipWithRoleLinks } from '../membershipRoleHelpers';

describe('membershipRoleHelpers', () => {
  it('returns empty roles and no primary role for absent membership data', () => {
    expect(getMembershipRoles(undefined)).toEqual([]);
    expect(getPrimaryMembershipRole(undefined)).toBeNull();
  });

  it('reads direct amendment and blog role relations', () => {
    expect(
      getMembershipRoleNames({
        role: { id: 'role-collaborator', name: 'Collaborator' },
      })
    ).toEqual(['Collaborator']);
  });

  it('reads group membership role links', () => {
    expect(
      getMembershipRoleNames({
        membership_roles: [{ role: { id: 'role-member', name: 'Member' } }],
      })
    ).toEqual(['Member']);
  });

  it('reads event participant role links', () => {
    expect(
      getMembershipRoleNames({
        participant_roles: [{ role: { id: 'role-organizer', name: 'Organizer' } }],
      })
    ).toEqual(['Organizer']);
  });

  it('sorts multiple roles by descending sort order', () => {
    expect(
      getMembershipRoles({
        roles: [
          { id: 'role-voter', name: 'Voting rights', sort_order: 10 },
          { id: 'role-chair', name: 'Chair', sort_order: 30 },
          { id: 'role-observer', name: 'Observer', sort_order: 20 },
        ],
      }).map(role => role.name)
    ).toEqual(['Chair', 'Observer', 'Voting rights']);
  });

  it('sorts missing priorities last and ignores empty links and role names', () => {
    const membership: MembershipWithRoleLinks = {
      membership_roles: [
        { role: null },
        { role: { id: 'named', name: '  Member  ', sort_order: 2 } },
        { role: { id: 'blank', name: '   ' } },
      ],
      participant_roles: null,
    };

    expect(getMembershipRoleNames(membership)).toEqual(['Member']);
    expect(getPrimaryMembershipRole(membership)?.id).toBe('named');
    expect(
      getMembershipRoles({
        roles: [
          { id: 'first', name: 'First' },
          { id: 'second', name: 'Second' },
        ],
      }).map(role => role.id)
    ).toEqual(['first', 'second']);
  });

  it('does not treat status values as roles', () => {
    const membership = { status: 'member', role: null };

    expect(getMembershipRoleNames(membership)).toEqual([]);
  });
});

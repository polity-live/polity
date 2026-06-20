import { describe, expect, it } from 'vitest';

import { getMembershipRoleNames, getMembershipRoles } from '../membershipRoleHelpers';

describe('membershipRoleHelpers', () => {
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

  it('does not treat status values as roles', () => {
    const membership = { status: 'member', role: null };

    expect(getMembershipRoleNames(membership)).toEqual([]);
  });
});

import { expect, it } from 'vitest';
import { getGroupDatasetRights } from '../groupDatasetRights';

it('keeps group dataset access restricted to owners, active members and authorized guests', () => {
  expect(getGroupDatasetRights(null, 'user')).toEqual({
    canViewDatasets: false,
    canManageDatasets: false,
  });
  expect(getGroupDatasetRights({ owner_id: 'user' }, 'user')).toEqual({
    canViewDatasets: true,
    canManageDatasets: true,
  });
  expect(
    getGroupDatasetRights({ memberships: [{ user_id: 'user', status: 'active' }] }, 'user')
  ).toEqual({ canViewDatasets: true, canManageDatasets: false });
  expect(
    getGroupDatasetRights({ memberships: [{ user_id: 'user', status: 'invited' }] }, 'user')
      .canViewDatasets
  ).toBe(false);
  const access = {
    user_id: 'user',
    status: 'active',
    guest_roles: [{ role: { action_rights: [{ resource: 'groupDatasets', action: 'view' }] } }],
  };
  expect(getGroupDatasetRights({ guest_accesses: [access] }, 'user')).toEqual({
    canViewDatasets: true,
    canManageDatasets: false,
  });
  access.guest_roles[0].role.action_rights[0].action = 'manage';
  expect(getGroupDatasetRights({ guest_accesses: [access] }, 'user')).toEqual({
    canViewDatasets: true,
    canManageDatasets: true,
  });
  expect(
    getGroupDatasetRights({ guest_accesses: [{ ...access, status: 'expired' }] }, 'user')
      .canViewDatasets
  ).toBe(false);
});

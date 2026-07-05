import { describe, expect, it } from 'vitest';

import { getAmendmentPermissionFlags } from '../amendmentPermissions';

function amendmentWithRole(action: string) {
  return {
    id: 'amendment-1',
    created_by_id: 'author-1',
    collaborators: [
      {
        id: 'collab-1',
        status: 'active',
        user: { id: 'user-1' },
        role: {
          id: 'role-1',
          name: 'Role',
          action_rights: [
            {
              id: 'right-1',
              resource: 'amendments',
              action,
              amendment_id: 'amendment-1',
            },
          ],
        },
      },
    ],
  };
}

describe('getAmendmentPermissionFlags', () => {
  it('allows the owner to change amendment mode', () => {
    const flags = getAmendmentPermissionFlags(
      { id: 'amendment-1', created_by_id: 'author-1' },
      'author-1'
    );

    expect(flags.canChangeMode).toBe(true);
  });

  it('allows collaborators with update rights to change amendment mode', () => {
    const flags = getAmendmentPermissionFlags(amendmentWithRole('update'), 'user-1');

    expect(flags.canChangeMode).toBe(true);
    expect(flags.canManageChangeRequestVotes).toBe(false);
  });

  it('allows collaborators with manage rights to change amendment mode', () => {
    const flags = getAmendmentPermissionFlags(amendmentWithRole('manage'), 'user-1');

    expect(flags.canChangeMode).toBe(true);
    expect(flags.canManageChangeRequestVotes).toBe(true);
  });

  it('blocks collaborators with only view rights from changing amendment mode', () => {
    const flags = getAmendmentPermissionFlags(amendmentWithRole('view'), 'user-1');

    expect(flags.canChangeMode).toBe(false);
    expect(flags.canManageChangeRequestVotes).toBe(false);
  });
});

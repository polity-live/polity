import { describe, expect, it } from 'vitest';

import {
  getAmendmentPermissionFlags,
  getAmendmentRoleCollaborators,
  isActiveAmendmentCollaborator,
  mapRoleActionRights,
} from '../amendmentPermissions';

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
  it('fails closed without an amendment or user', () => {
    expect(getAmendmentPermissionFlags(null, 'user-1')).toEqual({
      canChangeMode: false,
      canVoteOnChangeRequests: false,
      canManageChangeRequestVotes: false,
    });
    expect(getAmendmentPermissionFlags({ id: 'amendment-1' })).toEqual({
      canChangeMode: false,
      canVoteOnChangeRequests: false,
      canManageChangeRequestVotes: false,
    });
  });

  it('normalizes collaborator relations and active statuses', () => {
    const preferred = [{ id: 'preferred' }];
    expect(
      getAmendmentRoleCollaborators({
        amendmentRoleCollaborators: preferred,
        collaborators: [{ id: 'legacy' }],
      })
    ).toBe(preferred);
    expect(getAmendmentRoleCollaborators({ collaborators: [{ id: 'legacy' }] })).toEqual([
      { id: 'legacy' },
    ]);
    expect(getAmendmentRoleCollaborators({ collaborators: 'invalid' })).toEqual([]);
    expect(getAmendmentRoleCollaborators(undefined)).toEqual([]);
    expect(isActiveAmendmentCollaborator({ status: 'collaborator' })).toBe(true);
    expect(isActiveAmendmentCollaborator({ status: null })).toBe(false);
  });

  it('maps only complete rights with ids and optional resource scopes', () => {
    expect(mapRoleActionRights(undefined)).toEqual([]);
    expect(
      mapRoleActionRights([
        { resource: 'amendments' },
        { action: 'update' },
        {
          resource: 'amendments',
          action: 'update',
          group_id: 1,
          event_id: 2,
          amendment_id: 3,
          blog_id: 4,
        },
        {
          id: 'right-without-scope',
          resource: 'amendments',
          action: 'vote',
        },
      ])
    ).toEqual([
      {
        id: 'amendments:update',
        resource: 'amendments',
        action: 'update',
        group: { id: '1' },
        event: { id: '2' },
        amendment: { id: '3' },
        blog: { id: '4' },
      },
      {
        id: 'right-without-scope',
        resource: 'amendments',
        action: 'vote',
        group: undefined,
        event: undefined,
        amendment: undefined,
        blog: undefined,
      },
    ]);
  });

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

  it('ignores inactive and user-less collaborators and permits explicit voting rights', () => {
    const amendment = amendmentWithRole('vote');
    amendment.collaborators.push(
      { id: 'inactive', status: 'invited', user: { id: 'user-2' } } as never,
      { id: 'userless', status: 'active' } as never
    );

    expect(getAmendmentPermissionFlags(amendment, 'user-1').canVoteOnChangeRequests).toBe(true);
    expect(getAmendmentPermissionFlags(amendment, 'user-2').canVoteOnChangeRequests).toBe(false);
  });

  it('resolves ownership from hydrated creator and user fallbacks', () => {
    expect(
      getAmendmentPermissionFlags({ id: 'amendment-1', created_by: { id: 'creator' } }, 'creator')
        .canChangeMode
    ).toBe(true);
    expect(
      getAmendmentPermissionFlags({ id: 'amendment-1', user: { id: 'owner' } }, 'owner')
        .canChangeMode
    ).toBe(true);
  });

  it('builds owner-less group-scoped permissions and optional collaborator roles', () => {
    const amendment = {
      id: 'amendment-1',
      group_id: 'group-1',
      amendmentRoleCollaborators: [
        { id: 'without-role', status: 'active', user: { id: 'user-1' } },
        {
          id: 'minimal-role',
          status: 'active',
          user: { id: 'user-2' },
          role: { id: 'role-2', name: null, description: 'Description' },
        },
      ],
    };

    expect(getAmendmentPermissionFlags(amendment, 'unrelated')).toEqual({
      canChangeMode: false,
      canVoteOnChangeRequests: false,
      canManageChangeRequestVotes: false,
    });
  });
});

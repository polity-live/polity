import { describe, expect, it, vi } from 'vitest';

import {
  checkPermission,
  hasActiveVotingRight,
  hasPassiveVotingRight,
  isAmendmentAuthor,
  isAmendmentCollaborator,
  isBlogger,
  isEventParticipant,
  isGroupMember,
  isSelf,
} from '../check';
import type {
  ActionRight,
  Amendment,
  BloggerRelation,
  GuestAccess,
  Membership,
  Participation,
  Role,
} from '../types';

const ACTOR = 'actor-m06';
const GROUP = 'group-m06';
const EVENT = 'event-m06';
const BLOG = 'blog-m06';
const AMENDMENT = 'amendment-m06';

function role(scope: Role['scope'], actionRights?: ActionRight[]): Role {
  return {
    id: `${scope}-role`,
    name: 'Role',
    scope,
    [scope]: { id: { group: GROUP, event: EVENT, blog: BLOG, amendment: AMENDMENT }[scope] },
    actionRights,
  };
}

function groupRight(overrides: Partial<ActionRight> = {}): ActionRight {
  return {
    id: 'group-right',
    resource: 'groups',
    action: 'manage',
    group: { id: GROUP },
    ...overrides,
  };
}

function eventRight(overrides: Partial<ActionRight> = {}): ActionRight {
  return {
    id: 'event-right',
    resource: 'events',
    action: 'manage',
    event: { id: EVENT },
    ...overrides,
  };
}

function blogRight(overrides: Partial<ActionRight> = {}): ActionRight {
  return {
    id: 'blog-right',
    resource: 'blogs',
    action: 'manage',
    blog: { id: BLOG },
    ...overrides,
  };
}

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'membership',
    group: { id: GROUP },
    status: 'active',
    roles: [role('group', [groupRight()])],
    ...overrides,
  };
}

function guest(overrides: Partial<GuestAccess> = {}): GuestAccess {
  return membership({ id: 'guest', ...overrides });
}

function participation(overrides: Partial<Participation> = {}): Participation {
  return {
    id: 'participation',
    event: { id: EVENT },
    status: 'active',
    roles: [role('event', [eventRight()])],
    ...overrides,
  };
}

function blogger(overrides: Partial<BloggerRelation> = {}): BloggerRelation {
  return {
    id: 'blogger',
    blog: { id: BLOG },
    status: 'member',
    role: role('blog', [blogRight()]),
    ...overrides,
  };
}

function permission(
  data: Parameters<typeof checkPermission>[0],
  scope: Parameters<typeof checkPermission>[1],
  action: Parameters<typeof checkPermission>[2] = 'update',
  resource: Parameters<typeof checkPermission>[3] = 'groups'
) {
  return checkPermission(data, scope, action, resource);
}

describe('check RBAC mutation decision table', () => {
  it('keeps identity and group ownership fail-closed', () => {
    expect([
      isSelf(undefined, undefined),
      isSelf(undefined, ACTOR),
      isSelf(ACTOR, undefined),
      isSelf('', ''),
      isSelf(ACTOR, 'other'),
      isSelf(ACTOR, ACTOR),
    ]).toEqual([false, false, false, false, false, true]);

    expect(permission({ userId: '' }, { groupId: GROUP }, 'delete')).toBe(false);
    expect(permission({ userId: '', ownedGroupIds: [GROUP] }, { groupId: GROUP }, 'delete')).toBe(
      false
    );
    expect(
      permission({ userId: ACTOR, ownedGroupIds: ['other', GROUP] }, { groupId: GROUP }, 'delete')
    ).toBe(true);
    expect(
      permission({ userId: ACTOR, ownedGroupIds: ['other'] }, { groupId: GROUP }, 'delete')
    ).toBe(false);
  });

  it('re-evaluates every active status set under static mutation isolation', async () => {
    vi.resetModules();
    const access = await import('../check');

    for (const status of [undefined, 'active', 'member', 'admin']) {
      expect(access.isGroupMember([membership({ status })], GROUP)).toBe(true);
    }
    expect(access.isGroupMember([membership({ status: 'invited' })], GROUP)).toBe(false);

    for (const status of ['active', 'confirmed', 'member', 'admin']) {
      expect(access.isEventParticipant([participation({ status })], EVENT)).toBe(true);
    }
    expect(access.isEventParticipant([participation({ status: 'invited' })], EVENT)).toBe(false);

    for (const status of ['active', 'collaborator', 'member', 'admin']) {
      expect(
        access.isAmendmentCollaborator(
          {
            id: AMENDMENT,
            amendmentRoleCollaborators: [{ id: `c-${status}`, user: { id: ACTOR }, status }],
          },
          ACTOR
        )
      ).toBe(true);
    }
    expect(
      access.isAmendmentCollaborator(
        {
          id: AMENDMENT,
          amendmentRoleCollaborators: [{ id: 'invited', user: { id: ACTOR }, status: 'invited' }],
        },
        ACTOR
      )
    ).toBe(false);

    expect(
      access.checkPermission(
        { userId: ACTOR, guestAccesses: [guest({ status: 'active' })] },
        { groupId: GROUP },
        'manage',
        'groups'
      )
    ).toBe(true);
    expect(
      access.checkPermission(
        { userId: ACTOR, guestAccesses: [guest({ status: 'member' })] },
        { groupId: GROUP },
        'manage',
        'groups'
      )
    ).toBe(false);
  });

  it('uses any matching group membership, role, and action right', () => {
    const valid = membership({
      roles: [
        role('group', [{ ...groupRight(), resource: 'events' }]),
        role('group', [{ ...groupRight(), group: undefined }, groupRight({ action: 'manage' })]),
      ],
    });
    expect(
      permission(
        {
          userId: ACTOR,
          memberships: [membership({ group: undefined }), valid],
        },
        { groupId: GROUP }
      )
    ).toBe(true);
    expect(
      isGroupMember(
        [membership({ group: { id: 'other' } }), membership({ status: 'active' })],
        GROUP
      )
    ).toBe(true);

    for (const denied of [
      membership({ group: undefined }),
      membership({ group: { id: 'other' } }),
      membership({ status: 'invited' }),
      membership({ roles: undefined }),
      membership({ roles: [role('group')] }),
      membership({ roles: [role('group', [{ ...groupRight(), resource: 'events' }])] }),
      membership({ roles: [role('group', [groupRight({ action: 'vote' })])] }),
      membership({ roles: [role('group', [groupRight({ group: undefined })])] }),
      membership({ roles: [role('group', [groupRight({ group: { id: 'other' } })])] }),
    ]) {
      expect(permission({ userId: ACTOR, memberships: [denied] }, { groupId: GROUP })).toBe(false);
    }
  });

  it('uses any matching event participation, role, and action right', () => {
    const valid = participation({
      roles: [
        role('event', [{ ...eventRight(), resource: 'groups' }]),
        role('event', [{ ...eventRight(), event: undefined }, eventRight()]),
      ],
    });
    expect(
      permission(
        { userId: ACTOR, participations: [participation({ event: undefined }), valid] },
        { eventId: EVENT },
        'update',
        'events'
      )
    ).toBe(true);
    expect(
      isEventParticipant(
        [participation({ event: { id: 'other' } }), participation({ status: 'active' })],
        EVENT
      )
    ).toBe(true);

    for (const denied of [
      participation({ event: undefined }),
      participation({ event: { id: 'other' } }),
      participation({ status: 'invited' }),
      participation({ roles: undefined }),
      participation({ roles: [role('event')] }),
      participation({ roles: [role('event', [{ ...eventRight(), resource: 'groups' }])] }),
      participation({ roles: [role('event', [eventRight({ action: 'comment' })])] }),
      participation({ roles: [role('event', [eventRight({ event: undefined })])] }),
      participation({ roles: [role('event', [eventRight({ event: { id: 'other' } })])] }),
    ]) {
      expect(
        permission(
          { userId: ACTOR, participations: [denied] },
          { eventId: EVENT },
          'update',
          'events'
        )
      ).toBe(false);
    }
  });

  it('uses any matching blogger relation and scoped blog right', () => {
    const valid = blogger({
      role: role('blog', [
        { ...blogRight(), resource: 'groups' },
        { ...blogRight(), blog: undefined },
        blogRight(),
      ]),
    });
    expect(
      permission(
        { userId: ACTOR, bloggerRelations: [blogger({ blog: undefined }), valid] },
        { blogId: BLOG },
        'update',
        'blogs'
      )
    ).toBe(true);

    expect(isBlogger(undefined, BLOG)).toBe(false);
    expect(isBlogger([blogger({ blog: undefined }), blogger()], BLOG)).toBe(true);
    for (const denied of [
      blogger({ blog: undefined }),
      blogger({ blog: { id: 'other' } }),
      blogger({ role: undefined }),
      blogger({ role: role('blog') }),
      blogger({ role: role('blog', [{ ...blogRight(), resource: 'groups' }]) }),
      blogger({ role: role('blog', [blogRight({ action: 'vote' })]) }),
      blogger({ role: role('blog', [blogRight({ blog: undefined })]) }),
    ]) {
      expect(
        permission(
          { userId: ACTOR, bloggerRelations: [denied] },
          { blogId: BLOG },
          'update',
          'blogs'
        )
      ).toBe(false);
    }
  });

  it('distinguishes author relations and collaborator collection shapes', () => {
    expect(isAmendmentAuthor(undefined, ACTOR)).toBe(false);
    expect(isAmendmentAuthor({ id: AMENDMENT, user: { id: ACTOR } }, ACTOR)).toBe(true);
    expect(
      isAmendmentAuthor({ id: AMENDMENT, owner: { id: 'other' }, user: { id: ACTOR } }, ACTOR)
    ).toBe(false);
    expect(isAmendmentAuthor({ id: AMENDMENT, owner: { id: ACTOR } }, ACTOR)).toBe(true);

    expect(
      isAmendmentCollaborator(
        {
          id: AMENDMENT,
          amendmentRoleCollaborators: [
            { id: 'missing-user' },
            { id: 'other', user: { id: 'other' }, status: 'active' },
            { id: 'active', user: { id: ACTOR }, status: 'active' },
          ],
        },
        ACTOR
      )
    ).toBe(true);
    expect(
      isAmendmentCollaborator(
        {
          id: AMENDMENT,
          collaborators: [
            { id: 'other', user: { id: 'other' }, status: 'active' },
            { id: 'pending', user: { id: ACTOR }, status: 'invited' },
          ],
        },
        ACTOR
      )
    ).toBe(false);
    expect(isAmendmentAuthor({ id: AMENDMENT, user: { id: 'other' } }, ACTOR)).toBe(false);
    expect(
      isAmendmentCollaborator(
        {
          id: AMENDMENT,
          collaborators: [
            { id: 'missing-user' },
            { id: 'pending', user: { id: ACTOR }, status: 'invited' },
            { id: 'active', user: { id: ACTOR }, status: 'active' },
          ],
        },
        ACTOR
      )
    ).toBe(true);
  });

  it('evaluates normalized collaborator rights with inheritance and exact scope', () => {
    const amendment = (rights?: ActionRight[]): Amendment => ({
      id: AMENDMENT,
      amendmentRoleCollaborators: [
        { id: 'missing-user' },
        { id: 'pending', user: { id: ACTOR }, status: 'invited', role: role('amendment', rights) },
        { id: 'active', user: { id: ACTOR }, status: 'active', role: role('amendment', rights) },
      ],
    });
    const valid = {
      id: 'valid',
      resource: 'amendments',
      action: 'manage',
      amendment: { id: AMENDMENT },
    } as ActionRight;

    expect(
      permission(
        { userId: ACTOR, amendment: amendment([{ ...valid, resource: 'groups' }, valid]) },
        {},
        'update',
        'amendments'
      )
    ).toBe(true);
    expect(
      permission(
        { userId: ACTOR },
        { amendment: amendment([{ ...valid, amendment: undefined }]) },
        'update',
        'amendments'
      )
    ).toBe(false);

    for (const right of [
      { ...valid, resource: 'groups' as const },
      { ...valid, action: 'vote' as const },
      { ...valid, amendment: { id: 'other' } },
    ]) {
      expect(
        permission({ userId: ACTOR, amendment: amendment([right]) }, {}, 'update', 'amendments')
      ).toBe(false);
    }
    expect(permission({ userId: ACTOR, amendment: amendment() }, {}, 'update', 'amendments')).toBe(
      false
    );

    const fallback: Amendment = {
      ...amendment(),
      collaborators: [{ id: 'legacy', user: { id: ACTOR }, status: 'active', roleName: 'Editor' }],
      roles: [
        {
          ...role('amendment', [valid]),
          name: 'Editor',
        },
      ],
    };
    expect(permission({ userId: ACTOR, amendment: fallback }, {}, 'update', 'amendments')).toBe(
      true
    );
  });

  it('evaluates raw Zero collaborator role shapes and amendment ids', () => {
    const raw = (rights: unknown[], status = 'active') =>
      ({
        id: AMENDMENT,
        collaborators: [
          {
            id: 'missing-user',
            role: { scope: 'amendment', amendment_id: AMENDMENT, action_rights: rights },
          },
          {
            id: 'pending',
            user: { id: ACTOR },
            status: 'invited',
            role: { scope: 'amendment', amendment_id: AMENDMENT, action_rights: rights },
          },
          {
            id: 'active',
            user: { id: ACTOR },
            status,
            role: { scope: 'amendment', amendment_id: AMENDMENT, action_rights: rights },
          },
        ],
      }) as unknown as Amendment;
    const valid = { resource: 'amendments', action: 'manage', amendment_id: AMENDMENT };

    expect(
      permission(
        { userId: ACTOR, amendment: raw([{ ...valid, resource: 'groups' }, valid]) },
        {},
        'update',
        'amendments'
      )
    ).toBe(true);
    expect(
      permission(
        { userId: ACTOR, amendment: raw([{ resource: 'amendments', action: 'manage' }]) },
        {},
        'update',
        'amendments'
      )
    ).toBe(false);
    for (const right of [
      { ...valid, resource: 'groups' },
      { ...valid, action: 'vote' },
      { ...valid, amendment_id: 'other' },
    ]) {
      expect(
        permission({ userId: ACTOR, amendment: raw([right]) }, {}, 'update', 'amendments')
      ).toBe(false);
    }
    expect(
      permission({ userId: ACTOR, amendment: raw([], 'active') }, {}, 'update', 'amendments')
    ).toBe(false);
  });

  it('evaluates legacy named roles with any matching collaborator, role, and right', () => {
    const valid: ActionRight = {
      id: 'valid',
      resource: 'amendments',
      action: 'manage',
      amendment: { id: AMENDMENT },
    };
    const legacy: Amendment = {
      id: AMENDMENT,
      collaborators: [
        { id: 'missing-user', roleName: 'Editor' },
        { id: 'pending', user: { id: ACTOR }, status: 'invited', roleName: 'Editor' },
        { id: 'active', user: { id: ACTOR }, status: 'active', roleName: 'Editor' },
      ],
      roles: [
        { ...role('amendment'), name: 'Other' },
        {
          ...role('amendment', [
            { ...valid, resource: 'groups' },
            { ...valid, amendment: undefined },
            valid,
          ]),
          name: 'Editor',
        },
      ],
    };
    expect(permission({ userId: ACTOR, amendment: legacy }, {}, 'update', 'amendments')).toBe(true);

    for (const right of [
      { ...valid, resource: 'groups' as const },
      { ...valid, action: 'vote' as const },
      { ...valid, amendment: { id: 'other' } },
    ]) {
      const singleRightLegacy: Amendment = {
        id: AMENDMENT,
        collaborators: [
          { id: 'active', user: { id: ACTOR }, status: 'active', roleName: 'Editor' },
        ],
        roles: [{ ...role('amendment', [right]), name: 'Editor' }],
      };
      expect(
        permission({ userId: ACTOR, amendment: singleRightLegacy }, {}, 'update', 'amendments')
      ).toBe(false);
    }

    expect(
      permission(
        {
          userId: ACTOR,
          amendment: {
            ...legacy,
            collaborators: [
              { id: 'other', user: { id: 'other' }, status: 'active', roleName: 'Editor' },
            ],
          },
        },
        {},
        'update',
        'amendments'
      )
    ).toBe(false);

    for (const amendment of [
      { ...legacy, collaborators: undefined },
      { ...legacy, roles: undefined },
      {
        ...legacy,
        collaborators: [{ id: 'active', user: { id: ACTOR }, status: 'active' }],
      },
      { ...legacy, roles: [{ ...role('amendment'), name: 'Other' }] },
      {
        ...legacy,
        roles: [{ ...role('amendment'), name: 'Editor' }],
      },
    ]) {
      expect(
        permission({ userId: ACTOR, amendment: amendment as Amendment }, {}, 'update', 'amendments')
      ).toBe(false);
    }
  });

  it('routes active and passive voting checks through event permissions', () => {
    const votingParticipation = participation({
      roles: [
        role('event', [
          eventRight({ action: 'active_voting' }),
          eventRight({ action: 'passive_voting' }),
        ]),
      ],
    });
    expect(
      hasActiveVotingRight([participation({ event: undefined }), votingParticipation], EVENT)
    ).toBe(true);
    expect(
      hasPassiveVotingRight([participation({ event: undefined }), votingParticipation], EVENT)
    ).toBe(true);
    expect(hasActiveVotingRight([participation()], EVENT)).toBe(false);
    expect(hasPassiveVotingRight([participation()], EVENT)).toBe(false);
  });
});

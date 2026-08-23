import { describe, expect, it } from 'vitest';

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
  Membership,
  Participation,
  Role,
} from '../types';

const actor = 'actor';
const groupId = 'group';
const eventId = 'event';
const blogId = 'blog';
const amendmentId = 'amendment';

function role(scope: Role['scope'], rights?: ActionRight[]): Role {
  return {
    id: `${scope}-role`,
    name: 'Role',
    scope,
    [scope]: {
      id: { group: groupId, event: eventId, blog: blogId, amendment: amendmentId }[scope],
    },
    actionRights: rights,
  };
}

describe('permission checker decision tables', () => {
  it('covers identity and owner boundaries', () => {
    expect(isSelf(undefined, actor)).toBe(false);
    expect(isSelf(actor, undefined)).toBe(false);
    expect(isSelf(actor, 'other')).toBe(false);
    expect(isSelf(actor, actor)).toBe(true);

    expect(isAmendmentAuthor(undefined, actor)).toBe(false);
    expect(isAmendmentAuthor({ id: amendmentId }, actor)).toBe(false);
    expect(isAmendmentAuthor({ id: amendmentId, user: { id: actor } }, actor)).toBe(true);
    expect(isAmendmentAuthor({ id: amendmentId, owner: { id: 'other' } }, actor)).toBe(false);
    expect(isAmendmentAuthor({ id: amendmentId, owner: { id: actor } }, actor)).toBe(true);

    expect(checkPermission({ userId: '' }, {}, 'view', 'groups')).toBe(false);
    expect(
      checkPermission({ userId: actor, ownedGroupIds: [groupId] }, { groupId }, 'delete', 'groups')
    ).toBe(true);
    expect(
      checkPermission({ userId: actor, ownedGroupIds: ['other'] }, { groupId }, 'delete', 'groups')
    ).toBe(false);
  });

  it('filters group membership and guest access statuses', () => {
    expect(isGroupMember(undefined, groupId)).toBe(false);
    expect(isGroupMember([{ id: 'missing-group' }], groupId)).toBe(false);
    expect(
      isGroupMember([{ id: 'wrong-group', group: { id: 'other' }, status: 'active' }], groupId)
    ).toBe(false);
    expect(
      isGroupMember([{ id: 'pending', group: { id: groupId }, status: 'requested' }], groupId)
    ).toBe(false);
    expect(isGroupMember([{ id: 'legacy', group: { id: groupId } }], groupId)).toBe(true);

    const validRight: ActionRight = {
      id: 'right',
      resource: 'groups',
      action: 'manage',
      group: { id: groupId },
    };
    const membership = (overrides: Partial<Membership> = {}): Membership => ({
      id: 'membership',
      group: { id: groupId },
      status: 'active',
      roles: [role('group', [validRight])],
      ...overrides,
    });

    for (const denied of [
      membership({ group: { id: 'other' } }),
      membership({ status: 'invited' }),
      membership({ roles: undefined }),
      membership({ roles: [role('group')] }),
      membership({
        roles: [role('group', [{ ...validRight, resource: 'events' }])],
      }),
      membership({
        roles: [role('group', [{ ...validRight, action: 'vote' }])],
      }),
      membership({
        roles: [role('group', [{ ...validRight, group: { id: 'other' } }])],
      }),
    ]) {
      expect(
        checkPermission({ userId: actor, memberships: [denied] }, { groupId }, 'update', 'groups')
      ).toBe(false);
    }

    expect(
      checkPermission(
        { userId: actor, memberships: [membership()] },
        { groupId },
        'update',
        'groups'
      )
    ).toBe(true);
    expect(
      checkPermission(
        {
          userId: actor,
          guestAccesses: [membership({ id: 'guest', status: 'active' })],
        },
        { groupId },
        'manage',
        'groups'
      )
    ).toBe(true);
    expect(
      checkPermission(
        {
          userId: actor,
          guestAccesses: [membership({ id: 'guest', status: 'member' })],
        },
        { groupId },
        'manage',
        'groups'
      )
    ).toBe(false);
  });

  it('filters event participation and event-scoped rights', () => {
    expect(isEventParticipant(undefined, eventId)).toBe(false);
    expect(isEventParticipant([{ id: 'missing-event' }], eventId)).toBe(false);
    expect(isEventParticipant([{ id: 'wrong-event', event: { id: 'other' } }], eventId)).toBe(
      false
    );
    expect(
      isEventParticipant([{ id: 'pending', event: { id: eventId }, status: 'invited' }], eventId)
    ).toBe(false);
    expect(isEventParticipant([{ id: 'legacy', event: { id: eventId } }], eventId)).toBe(false);

    const validRight: ActionRight = {
      id: 'right',
      resource: 'events',
      action: 'manage',
      event: { id: eventId },
    };
    const participation = (overrides: Partial<Participation> = {}): Participation => ({
      id: 'participation',
      event: { id: eventId },
      status: 'confirmed',
      roles: [role('event', [validRight])],
      ...overrides,
    });

    for (const denied of [
      participation({ event: { id: 'other' } }),
      participation({ status: 'requested' }),
      participation({ roles: undefined }),
      participation({ roles: [role('event')] }),
      participation({ roles: [role('event', [{ ...validRight, resource: 'groups' }])] }),
      participation({ roles: [role('event', [{ ...validRight, action: 'comment' }])] }),
      participation({
        roles: [role('event', [{ ...validRight, event: { id: 'other' } }])],
      }),
    ]) {
      expect(
        checkPermission(
          { userId: actor, participations: [denied] },
          { eventId },
          'update',
          'events'
        )
      ).toBe(false);
    }

    expect(
      checkPermission(
        { userId: actor, participations: [participation()] },
        { eventId },
        'update',
        'events'
      )
    ).toBe(true);
    expect(
      checkPermission(
        {
          userId: actor,
          participations: [
            participation({
              roles: [
                role('event', [
                  {
                    id: 'active-voting',
                    resource: 'events',
                    action: 'active_voting',
                    event: { id: eventId },
                  },
                  {
                    id: 'passive-voting',
                    resource: 'events',
                    action: 'passive_voting',
                    event: { id: eventId },
                  },
                ]),
              ],
            }),
          ],
        },
        { eventId },
        'active_voting',
        'events'
      )
    ).toBe(true);
    expect(hasActiveVotingRight(undefined, eventId)).toBe(false);
    expect(hasPassiveVotingRight(undefined, eventId)).toBe(false);
    expect(hasActiveVotingRight([participation()], eventId)).toBe(false);
    expect(
      hasActiveVotingRight(
        [
          participation({
            roles: [
              role('event', [
                {
                  id: 'active',
                  resource: 'events',
                  action: 'active_voting',
                  event: { id: eventId },
                },
              ]),
            ],
          }),
        ],
        eventId
      )
    ).toBe(true);
    expect(
      hasPassiveVotingRight(
        [
          participation({
            roles: [
              role('event', [
                {
                  id: 'passive',
                  resource: 'events',
                  action: 'passive_voting',
                  event: { id: eventId },
                },
              ]),
            ],
          }),
        ],
        eventId
      )
    ).toBe(true);
  });

  it('filters blogger relations and blog-scoped rights', () => {
    expect(isBlogger(undefined, blogId)).toBe(false);
    expect(isBlogger([{ id: 'missing-blog' }], blogId)).toBe(false);
    expect(isBlogger([{ id: 'blogger', blog: { id: blogId }, status: 'member' }], blogId)).toBe(
      true
    );
    expect(checkPermission({ userId: actor }, { blogId }, 'view', 'blogs')).toBe(false);

    const validRight: ActionRight = {
      id: 'right',
      resource: 'blogs',
      action: 'manage',
      blog: { id: blogId },
    };
    const relation = (overrides: Partial<BloggerRelation> = {}): BloggerRelation => ({
      id: 'blogger',
      blog: { id: blogId },
      status: 'member',
      role: role('blog', [validRight]),
      ...overrides,
    });

    for (const denied of [
      relation({ blog: { id: 'other' } }),
      relation({ role: undefined }),
      relation({ role: role('blog') }),
      relation({ role: role('blog', [{ ...validRight, resource: 'groups' }]) }),
      relation({ role: role('blog', [{ ...validRight, action: 'vote' }]) }),
      relation({ role: role('blog', [{ ...validRight, blog: { id: 'other' } }]) }),
    ]) {
      expect(
        checkPermission(
          { userId: actor, bloggerRelations: [denied] },
          { blogId },
          'update',
          'blogs'
        )
      ).toBe(false);
    }
    expect(
      checkPermission(
        { userId: actor, bloggerRelations: [relation()] },
        { blogId },
        'update',
        'blogs'
      )
    ).toBe(true);
  });

  it('filters collaborator identity and active statuses for both data shapes', () => {
    expect(isAmendmentCollaborator(undefined, actor)).toBe(false);
    expect(
      isAmendmentCollaborator({ id: amendmentId, amendmentRoleCollaborators: [] }, actor)
    ).toBe(false);
    expect(
      isAmendmentCollaborator(
        {
          id: amendmentId,
          amendmentRoleCollaborators: [
            { id: 'missing-user' },
            { id: 'other', user: { id: 'other' }, status: 'active' },
            { id: 'pending', user: { id: actor }, status: 'invited' },
          ],
        },
        actor
      )
    ).toBe(false);
    expect(
      isAmendmentCollaborator(
        {
          id: amendmentId,
          amendmentRoleCollaborators: [{ id: 'active', user: { id: actor }, status: 'active' }],
        },
        actor
      )
    ).toBe(true);
    expect(isAmendmentCollaborator({ id: amendmentId }, actor)).toBe(false);
    expect(
      isAmendmentCollaborator(
        {
          id: amendmentId,
          collaborators: [
            { id: 'other', user: { id: 'other' }, status: 'active' },
            { id: 'pending', user: { id: actor }, status: 'requested' },
            { id: 'active', user: { id: actor }, status: 'member' },
          ],
        },
        actor
      )
    ).toBe(true);
  });

  it('evaluates normalized amendment role rights and their scope boundaries', () => {
    const normalizedAmendment = (rightOverrides: Partial<ActionRight> = {}): Amendment => ({
      id: amendmentId,
      amendmentRoleCollaborators: [
        {
          id: 'collaborator',
          user: { id: actor },
          status: 'active',
          role: role('amendment', [
            {
              id: 'right',
              resource: 'amendments',
              action: 'manage',
              amendment: { id: amendmentId },
              ...rightOverrides,
            },
          ]),
        },
      ],
    });
    for (const amendment of [
      normalizedAmendment({ resource: 'groups' }),
      normalizedAmendment({ action: 'vote' }),
      normalizedAmendment({ amendment: { id: 'other' } }),
    ]) {
      expect(checkPermission({ userId: actor, amendment }, {}, 'update', 'amendments')).toBe(false);
    }
    expect(
      checkPermission(
        { userId: actor, amendment: normalizedAmendment() },
        {},
        'update',
        'amendments'
      )
    ).toBe(true);
    expect(
      checkPermission(
        { userId: actor },
        { amendment: normalizedAmendment({ amendment: undefined }) },
        'update',
        'amendments'
      )
    ).toBe(false);
  });

  it('evaluates raw Zero collaborator roles and action-right field shapes', () => {
    const rawAmendment = (right: Record<string, unknown>) =>
      ({
        id: amendmentId,
        collaborators: [
          { id: 'without-role', user: { id: actor }, status: 'active' },
          { id: 'other', user: { id: 'other' }, status: 'active', role: {} },
          { id: 'pending', user: { id: actor }, status: 'invited', role: {} },
          {
            id: 'collaborator',
            user: { id: actor },
            status: 'active',
            role: { scope: 'amendment', amendment_id: amendmentId, action_rights: [right] },
          },
        ],
      }) as unknown as Amendment;

    for (const right of [
      { resource: 'groups', action: 'manage', amendment_id: amendmentId },
      { resource: 'amendments', action: 'vote', amendment_id: amendmentId },
      { resource: 'amendments', action: 'manage', amendment_id: 'other' },
    ]) {
      expect(
        checkPermission(
          { userId: actor, amendment: rawAmendment(right) },
          {},
          'update',
          'amendments'
        )
      ).toBe(false);
    }
    expect(
      checkPermission(
        {
          userId: actor,
          amendment: rawAmendment({
            resource: 'amendments',
            action: 'manage',
            amendment_id: amendmentId,
          }),
        },
        {},
        'update',
        'amendments'
      )
    ).toBe(true);
    expect(
      checkPermission(
        {
          userId: actor,
          amendment: rawAmendment({
            resource: 'amendments',
            action: 'manage',
            amendment: { id: amendmentId },
          }),
        },
        {},
        'update',
        'amendments'
      )
    ).toBe(true);
  });

  it('evaluates legacy role-name collaborators', () => {
    const legacyAmendment = (overrides: Partial<Amendment> = {}): Amendment => ({
      id: amendmentId,
      collaborators: [
        { id: 'collaborator', user: { id: actor }, roleName: 'Editor', status: 'active' },
      ],
      roles: [
        role('amendment', [
          {
            id: 'right',
            resource: 'amendments',
            action: 'manage',
            amendment: { id: amendmentId },
          },
        ]),
      ].map(item => ({ ...item, name: 'Editor' })),
      ...overrides,
    });

    expect(
      checkPermission({ userId: actor, amendment: { id: amendmentId } }, {}, 'update', 'amendments')
    ).toBe(false);
    expect(
      checkPermission(
        { userId: actor, amendment: legacyAmendment({ roles: undefined }) },
        {},
        'update',
        'amendments'
      )
    ).toBe(false);
    expect(
      checkPermission(
        {
          userId: actor,
          amendment: legacyAmendment({
            collaborators: [{ id: 'collaborator', user: { id: actor } }],
          }),
        },
        {},
        'update',
        'amendments'
      )
    ).toBe(false);
    expect(
      checkPermission(
        {
          userId: actor,
          amendment: legacyAmendment({ roles: [{ ...role('amendment'), name: 'Other' }] }),
        },
        {},
        'update',
        'amendments'
      )
    ).toBe(false);
    expect(
      checkPermission({ userId: actor, amendment: legacyAmendment() }, {}, 'update', 'amendments')
    ).toBe(true);
  });
});

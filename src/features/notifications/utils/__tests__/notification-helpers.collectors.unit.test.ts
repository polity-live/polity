import { describe, expect, it } from 'vitest';

import {
  collectAmendmentCollaboratorManagerRecipientIds,
  collectEventParticipantManagerRecipientIds,
  collectEventParticipantRecipientIds,
  collectGroupMemberRecipientIds,
  collectGroupMembershipManagerRecipientIds,
  collectProcessTaskEventManagerRecipientIds,
  collectRelationshipManagerRecipientIds,
} from '../notification-helpers';

const right = (resource: string, action: string, group_id?: string) => ({
  resource,
  action,
  group_id,
});
const role = (...action_rights: ReturnType<typeof right>[]) => ({ action_rights });
const link = (resource: string, action: string, groupId?: string) => ({
  role: role(right(resource, action, groupId)),
});

describe('notification recipient collectors', () => {
  it('collects relationship managers while filtering sender, inactive, empty, and unrelated roles', () => {
    const group = {
      owner_id: 'owner',
      memberships: [
        {
          user_id: 'member-manager',
          status: 'active',
          membership_roles: [link('groupRelationships', 'manage')],
        },
        {
          user_id: 'sender',
          status: 'member',
          membership_roles: [link('groupRelationships', 'manage')],
        },
        {
          user_id: 'wrong-right',
          status: 'admin',
          membership_roles: [link('groupRelationships', 'view'), link('groups', 'manage')],
        },
        {
          user_id: 'inactive',
          status: 'requested',
          membership_roles: [link('groupRelationships', 'manage')],
        },
        { user_id: null, status: 'active', membership_roles: [{ role: null }] },
        { user_id: 'without-roles', status: 'active', membership_roles: null },
        { user_id: 'missing-status', status: null, membership_roles: [] },
      ],
      guest_accesses: [
        {
          user_id: 'guest-manager',
          status: 'active',
          guest_roles: [link('groupRelationships', 'manage')],
        },
        {
          user_id: 'inactive-guest',
          status: 'requested',
          guest_roles: [link('groupRelationships', 'manage')],
        },
        { user_id: 'guest-viewer', status: 'active', guest_roles: [link('groups', 'view')] },
        { user_id: null, status: 'active', guest_roles: null },
        { user_id: 'missing-guest-status', status: null, guest_roles: [] },
      ],
    };

    expect(collectRelationshipManagerRecipientIds(group, 'sender').sort()).toEqual([
      'guest-manager',
      'member-manager',
      'owner',
    ]);
    expect(collectRelationshipManagerRecipientIds(null)).toEqual([]);
    expect(collectRelationshipManagerRecipientIds({ owner_id: 'same' }, 'same')).toEqual([]);
  });

  it('collects group membership managers for both supported resources and actions', () => {
    const group = {
      owner_id: 'owner',
      memberships: [
        { user_id: 'group-manage', status: 'active', membership_roles: [link('groups', 'manage')] },
        {
          user_id: 'membership-manage',
          status: 'member',
          membership_roles: [link('groupMemberships', 'manage_members')],
        },
        {
          user_id: 'wrong-action',
          status: 'admin',
          membership_roles: [link('groups', 'view')],
        },
        { user_id: 'inactive', status: '', membership_roles: [link('groups', 'manage')] },
        { user_id: 'missing-status', status: null, membership_roles: [] },
      ],
      guest_accesses: [
        {
          user_id: 'guest-manager',
          status: 'active',
          guest_roles: [link('groupMemberships', 'manage')],
        },
        { user_id: 'guest-wrong', status: 'active', guest_roles: [{ role: {} }] },
        { user_id: 'guest-inactive', status: null, guest_roles: [link('groups', 'manage')] },
      ],
    };
    expect(collectGroupMembershipManagerRecipientIds(group).sort()).toEqual([
      'group-manage',
      'guest-manager',
      'membership-manage',
      'owner',
    ]);
    expect(collectGroupMembershipManagerRecipientIds(undefined)).toEqual([]);
  });

  it('collects event and amendment managers across active and rejected records', () => {
    const event = {
      creator_id: 'creator',
      participants: [
        {
          user_id: 'event-manager',
          status: 'confirmed',
          participant_roles: [link('events', 'manage_participants')],
        },
        {
          user_id: 'event-admin',
          status: 'admin',
          participant_roles: [link('events', 'manage')],
        },
        {
          user_id: 'event-viewer',
          status: 'active',
          participant_roles: [link('events', 'view')],
        },
        {
          user_id: 'inactive',
          status: 'requested',
          participant_roles: [link('events', 'manage')],
        },
        { user_id: null, status: 'member', participant_roles: null },
        { user_id: 'missing-status', status: null, participant_roles: [] },
        { user_id: 'without-rights', status: 'active', participant_roles: [{ role: {} }] },
      ],
    };
    expect(collectEventParticipantManagerRecipientIds(event, 'creator').sort()).toEqual([
      'event-admin',
      'event-manager',
    ]);
    expect(collectEventParticipantManagerRecipientIds(null)).toEqual([]);

    const amendment = {
      created_by_id: 'owner',
      collaborators: [
        {
          user_id: 'manager',
          status: 'collaborator',
          role: role(right('amendments', 'manage')),
        },
        { user_id: 'viewer', status: 'member', role: role(right('amendments', 'view')) },
        { user_id: 'inactive', status: 'invited', role: role(right('amendments', 'manage')) },
        { user_id: null, status: 'active', role: null },
        { user_id: 'missing-status', status: null, role: null },
      ],
    };
    expect(collectAmendmentCollaboratorManagerRecipientIds(amendment).sort()).toEqual([
      'manager',
      'owner',
    ]);
    expect(collectAmendmentCollaboratorManagerRecipientIds(undefined)).toEqual([]);
  });

  it('collects process-task event managers only for the target group', () => {
    const group = {
      owner_id: 'sender',
      memberships: [
        {
          user_id: 'manage',
          status: 'active',
          membership_roles: [link('events', 'manage', 'group-1')],
        },
        {
          user_id: 'votes',
          status: 'member',
          membership_roles: [link('events', 'manage_votes', 'group-1')],
        },
        {
          user_id: 'other-group',
          status: 'admin',
          membership_roles: [link('events', 'manage', 'group-2')],
        },
        {
          user_id: 'wrong-resource',
          status: 'active',
          membership_roles: [link('groups', 'manage', 'group-1')],
        },
        { user_id: 'inactive', status: 'requested', membership_roles: [] },
        { user_id: 'missing-status', status: null, membership_roles: [] },
        { user_id: 'without-rights', status: 'active', membership_roles: [{ role: {} }] },
      ],
      guest_accesses: [
        {
          user_id: 'guest',
          status: 'active',
          guest_roles: [link('events', 'manage_votes', 'group-1')],
        },
        { user_id: 'guest-view', status: 'active', guest_roles: [link('events', 'view')] },
        { user_id: 'guest-inactive', status: 'requested', guest_roles: [] },
        { user_id: 'guest-missing-status', status: null, guest_roles: [] },
      ],
    };
    expect(collectProcessTaskEventManagerRecipientIds(group, 'group-1', 'sender').sort()).toEqual([
      'guest',
      'manage',
      'votes',
    ]);
    expect(collectProcessTaskEventManagerRecipientIds(null, 'group-1')).toEqual([]);
  });

  it('collects active participants and group members with deduplication', () => {
    expect(
      collectEventParticipantRecipientIds([
        { user_id: 'active', status: 'active' },
        { user_id: 'active', status: 'confirmed' },
        { user_id: 'admin', status: 'admin' },
        { user_id: 'inactive', status: 'requested' },
        { user_id: null, status: 'member' },
        { user_id: 'missing-status', status: null },
      ]).sort()
    ).toEqual(['active', 'admin']);
    expect(collectEventParticipantRecipientIds(null)).toEqual([]);

    expect(
      collectGroupMemberRecipientIds({
        owner_id: 'owner',
        memberships: [
          { user_id: 'member', status: 'member' },
          { user_id: 'owner', status: 'admin' },
          { user_id: 'inactive', status: 'requested' },
          { user_id: null, status: 'active' },
          { user_id: 'missing-status', status: null },
        ],
      }).sort()
    ).toEqual(['member', 'owner']);
    expect(collectGroupMemberRecipientIds(undefined)).toEqual([]);
    expect(collectGroupMemberRecipientIds({ owner_id: null })).toEqual([]);
  });
});

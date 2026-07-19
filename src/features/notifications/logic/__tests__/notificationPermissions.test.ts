import { describe, expect, it } from 'vitest';

import type { Notification } from '../../types/notification.types';
import { canManageEntityNotification } from '../notificationPermissions';
import { checkPermission } from '@/zero/rbac/check';
import type { PermissionData } from '@/zero/rbac/check';
import type { ActionRight, PermissionEvaluator, Role } from '@/zero/rbac';

const USER_ID = 'user-1';

function evaluator(data: Omit<PermissionData, 'userId'> = {}): PermissionEvaluator {
  const permissionData = { userId: USER_ID, ...data };
  return {
    userId: USER_ID,
    isLoading: false,
    can: (scope, action, resource) => checkPermission(permissionData, scope, action, resource),
  };
}

function role(right: ActionRight): Role {
  return {
    id: 'role-1',
    name: 'Role',
    scope: 'group',
    actionRights: [right],
  };
}

function groupRight(
  action: 'viewNotifications' | 'manageNotifications',
  groupId = 'group-1'
): ActionRight {
  return {
    id: `${action}-${groupId}`,
    resource: 'groupNotifications',
    action,
    group: { id: groupId },
  };
}

function notification(overrides: Record<string, unknown> = {}): Notification {
  return {
    id: 'notification-1',
    recipient_id: null,
    recipient_entity_id: 'group-1',
    recipient_entity_type: 'group',
    recipient_group_id: 'group-1',
    recipient_event_id: null,
    recipient_amendment_id: null,
    recipient_blog_id: null,
    ...overrides,
  } as Notification;
}

describe('canManageEntityNotification', () => {
  it('allows the group owner through the shared permission checker', () => {
    expect(
      canManageEntityNotification(notification(), evaluator({ ownedGroupIds: ['group-1'] }))
    ).toBe(true);
  });

  it('separates view-only and management roles', () => {
    const withRight = (right: ActionRight) =>
      evaluator({
        memberships: [
          {
            id: 'membership-1',
            group: { id: 'group-1' },
            status: 'active',
            roles: [role(right)],
          },
        ],
      });

    expect(
      canManageEntityNotification(notification(), withRight(groupRight('viewNotifications')))
    ).toBe(false);
    expect(
      canManageEntityNotification(notification(), withRight(groupRight('manageNotifications')))
    ).toBe(true);
  });

  it('rejects a management right scoped to another entity', () => {
    expect(
      canManageEntityNotification(
        notification(),
        evaluator({
          memberships: [
            {
              id: 'membership-1',
              group: { id: 'group-1' },
              status: 'active',
              roles: [role(groupRight('manageNotifications', 'group-2'))],
            },
          ],
        })
      )
    ).toBe(false);
  });

  it('rejects inactive memberships even when the role can manage', () => {
    expect(
      canManageEntityNotification(
        notification(),
        evaluator({
          memberships: [
            {
              id: 'membership-1',
              group: { id: 'group-1' },
              status: 'inactive',
              roles: [role(groupRight('manageNotifications'))],
            },
          ],
        })
      )
    ).toBe(false);
  });

  it('allows active group guest access with a scoped management role', () => {
    expect(
      canManageEntityNotification(
        notification(),
        evaluator({
          guestAccesses: [
            {
              id: 'guest-1',
              group: { id: 'group-1' },
              status: 'active',
              roles: [role(groupRight('manageNotifications'))],
            },
          ],
        })
      )
    ).toBe(true);
  });

  it.each([
    {
      entityType: 'event',
      typedField: 'recipient_event_id',
      relationData: {
        participations: [
          {
            id: 'participant-1',
            event: { id: 'entity-1' },
            status: 'active',
            roles: [
              role({
                id: 'event-right',
                resource: 'notifications',
                action: 'manageNotifications',
                event: { id: 'entity-1' },
              }),
            ],
          },
        ],
      },
    },
    {
      entityType: 'blog',
      typedField: 'recipient_blog_id',
      relationData: {
        bloggerRelations: [
          {
            id: 'blogger-1',
            blog: { id: 'entity-1' },
            role: role({
              id: 'blog-right',
              resource: 'notifications',
              action: 'manageNotifications',
              blog: { id: 'entity-1' },
            }),
          },
        ],
      },
    },
  ])(
    'allows a scoped manager for $entityType notifications',
    ({ entityType, typedField, relationData }) => {
      expect(
        canManageEntityNotification(
          notification({
            recipient_entity_id: 'entity-1',
            recipient_entity_type: entityType,
            recipient_group_id: null,
            [typedField]: 'entity-1',
          }),
          evaluator(relationData as Omit<PermissionData, 'userId'>)
        )
      ).toBe(true);
    }
  );

  it('allows an amendment author and maps the notification relation into the shared checker', () => {
    expect(
      canManageEntityNotification(
        notification({
          recipient_entity_id: 'amendment-1',
          recipient_entity_type: 'amendment',
          recipient_group_id: null,
          recipient_amendment_id: 'amendment-1',
          recipient_amendment: {
            id: 'amendment-1',
            created_by_id: USER_ID,
            collaborators: [],
          },
        }),
        evaluator()
      )
    ).toBe(true);
  });

  it('allows an active amendment collaborator with a scoped management role', () => {
    expect(
      canManageEntityNotification(
        notification({
          recipient_entity_id: 'amendment-1',
          recipient_entity_type: 'amendment',
          recipient_group_id: null,
          recipient_amendment_id: 'amendment-1',
          recipient_amendment: {
            id: 'amendment-1',
            created_by_id: 'author-1',
            collaborators: [
              {
                id: 'collaborator-1',
                user_id: USER_ID,
                status: 'active',
                role: {
                  id: 'amendment-role-1',
                  scope: 'amendment',
                  action_rights: [
                    {
                      id: 'amendment-right-1',
                      resource: 'notifications',
                      action: 'manageNotifications',
                      amendment_id: 'amendment-1',
                    },
                  ],
                },
              },
            ],
          },
        }),
        evaluator()
      )
    ).toBe(true);
  });

  it('hides the action for personal, inconsistent and loading rows', () => {
    expect(
      canManageEntityNotification(
        notification({ recipient_id: USER_ID }),
        evaluator({ ownedGroupIds: ['group-1'] })
      )
    ).toBe(false);
    expect(
      canManageEntityNotification(
        notification({ recipient_group_id: 'group-2' }),
        evaluator({ ownedGroupIds: ['group-1'] })
      )
    ).toBe(false);
    expect(
      canManageEntityNotification(notification(), {
        ...evaluator({ ownedGroupIds: ['group-1'] }),
        isLoading: true,
      })
    ).toBe(false);
  });
});

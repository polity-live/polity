import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

const notificationStartSchema = z
  .object({
    created_at: z.number(),
    id: z.string(),
  })
  .nullable();

const ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES = [
  'active',
  'collaborator',
  'member',
  'admin',
];
const ACTIVE_GROUP_NOTIFICATION_STATUSES = ['active', 'member', 'admin'];
const ACTIVE_GROUP_GUEST_NOTIFICATION_STATUSES = ['active'];
const ACTIVE_EVENT_NOTIFICATION_STATUSES = ['active', 'confirmed', 'member', 'admin'];
const NOTIFICATION_VIEW_ACTIONS = ['viewNotifications', 'manageNotifications'];

function roleHasNotificationRight(role: any, resource: 'groupNotifications' | 'notifications') {
  return role.whereExists('action_rights', (right: any) =>
    right.where('resource', resource).where('action', 'IN', NOTIFICATION_VIEW_ACTIONS)
  );
}

function applyGroupNotificationViewAccess(q: any, userID: string) {
  return q.where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', userID),
      exists('memberships', (membership: any) =>
        membership
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_GROUP_NOTIFICATION_STATUSES)
          .whereExists('membership_roles', (membershipRole: any) =>
            membershipRole.whereExists('role', (role: any) =>
              roleHasNotificationRight(role, 'groupNotifications')
            )
          )
      ),
      exists('guest_accesses', (guestAccess: any) =>
        guestAccess
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_GROUP_GUEST_NOTIFICATION_STATUSES)
          .whereExists('guest_roles', (guestRole: any) =>
            guestRole.whereExists('role', (role: any) =>
              roleHasNotificationRight(role, 'groupNotifications')
            )
          )
      )
    )
  );
}

function applyEventNotificationViewAccess(q: any, userID: string) {
  return q.whereExists('participants', (participant: any) =>
    participant
      .where('user_id', userID)
      .where('status', 'IN', ACTIVE_EVENT_NOTIFICATION_STATUSES)
      .whereExists('participant_roles', (participantRole: any) =>
        participantRole.whereExists('role', (role: any) =>
          roleHasNotificationRight(role, 'notifications')
        )
      )
  );
}

function applyAmendmentNotificationViewAccess(q: any, userID: string) {
  return q.where(({ or, cmp, exists }: any) =>
    or(
      cmp('created_by_id', userID),
      exists('collaborators', (collaborator: any) =>
        collaborator
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES)
          .whereExists('role', (role: any) => roleHasNotificationRight(role, 'notifications'))
      )
    )
  );
}

function applyBlogNotificationViewAccess(q: any, userID: string) {
  return q.whereExists('bloggers', (blogger: any) =>
    blogger
      .where('user_id', userID)
      .whereExists('role', (role: any) => roleHasNotificationRight(role, 'notifications'))
  );
}

export function applyNotificationViewAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('recipient_id', userID),
      exists('recipient_group', (group: any) => applyGroupNotificationViewAccess(group, userID)),
      exists('recipient_event', (event: any) => applyEventNotificationViewAccess(event, userID)),
      exists('recipient_amendment', (amendment: any) =>
        applyAmendmentNotificationViewAccess(amendment, userID)
      ),
      exists('recipient_blog', (blog: any) => applyBlogNotificationViewAccess(blog, userID))
    )
  ) as T;
}

type NotificationRecipientEntityType = 'group' | 'event' | 'amendment' | 'blog';
type NotificationBaseQuery = typeof zql.notification;

function isNotificationRecipientEntityType(
  entityType: string
): entityType is NotificationRecipientEntityType {
  return (
    entityType === 'group' ||
    entityType === 'event' ||
    entityType === 'amendment' ||
    entityType === 'blog'
  );
}

function applyTypedNotificationAccess(
  q: NotificationBaseQuery,
  userID: string | undefined,
  entityType: NotificationRecipientEntityType
): NotificationBaseQuery {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as NotificationBaseQuery;
  }

  return query.where(({ or, cmp, exists }: any) => {
    const personalRecipient = cmp('recipient_id', userID);

    switch (entityType) {
      case 'group':
        return or(
          personalRecipient,
          exists('recipient_group', (group: any) => applyGroupNotificationViewAccess(group, userID))
        );
      case 'event':
        return or(
          personalRecipient,
          exists('recipient_event', (event: any) => applyEventNotificationViewAccess(event, userID))
        );
      case 'amendment':
        return or(
          personalRecipient,
          exists('recipient_amendment', (amendment: any) =>
            applyAmendmentNotificationViewAccess(amendment, userID)
          )
        );
      case 'blog':
        return or(
          personalRecipient,
          exists('recipient_blog', (blog: any) => applyBlogNotificationViewAccess(blog, userID))
        );
    }
  }) as NotificationBaseQuery;
}

function withCommonNotificationRelations(q: NotificationBaseQuery, userID: string | undefined) {
  return q
    .related('sender')
    .related('recipient')
    .related('related_user')
    .related('related_group')
    .related('related_event')
    .related('related_amendment')
    .related('related_blog')
    .related('on_behalf_of_group')
    .related('on_behalf_of_event')
    .related('on_behalf_of_amendment')
    .related('on_behalf_of_blog')
    .related('reads', reads => reads.where('read_by_user_id', userID))
    .related('viewer_state', state => state.where('user_id', userID));
}

function buildGroupNotificationQuery(q: NotificationBaseQuery, userID: string | undefined) {
  return withCommonNotificationRelations(
    applyTypedNotificationAccess(q, userID, 'group'),
    userID
  ).related('recipient_group', group =>
    group
      .related('memberships', membership =>
        membership
          .where('user_id', userID)
          .related('membership_roles', membershipRole =>
            membershipRole.related('role', role => role.related('action_rights'))
          )
      )
      .related('guest_accesses', guestAccess =>
        guestAccess
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_GROUP_GUEST_NOTIFICATION_STATUSES)
          .related('guest_roles', guestRole =>
            guestRole.related('role', role => role.related('action_rights'))
          )
      )
  );
}

function buildEventNotificationQuery(q: NotificationBaseQuery, userID: string | undefined) {
  return withCommonNotificationRelations(
    applyTypedNotificationAccess(q, userID, 'event'),
    userID
  ).related('recipient_event', event =>
    event.related('participants', participant =>
      participant
        .where('user_id', userID)
        .related('participant_roles', participantRole =>
          participantRole.related('role', role => role.related('action_rights'))
        )
    )
  );
}

function buildAmendmentNotificationQuery(q: NotificationBaseQuery, userID: string | undefined) {
  return withCommonNotificationRelations(
    applyTypedNotificationAccess(q, userID, 'amendment'),
    userID
  ).related('recipient_amendment', amendment =>
    amendment.related('collaborators', collaborator =>
      collaborator
        .where('user_id', userID)
        .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES)
        .related('role', role => role.related('action_rights'))
    )
  );
}

function buildBlogNotificationQuery(q: NotificationBaseQuery, userID: string | undefined) {
  return withCommonNotificationRelations(
    applyTypedNotificationAccess(q, userID, 'blog'),
    userID
  ).related('recipient_blog', blog =>
    blog.related('bloggers', blogger =>
      blogger.where('user_id', userID).related('role', role => role.related('action_rights'))
    )
  );
}

function buildGenericEntityNotificationQuery(q: NotificationBaseQuery, userID: string | undefined) {
  return withCommonNotificationRelations(applyNotificationViewAccess(q, userID), userID)
    .related('recipient_group', group =>
      group
        .related('memberships', membership =>
          membership
            .where('user_id', userID)
            .related('membership_roles', membershipRole =>
              membershipRole.related('role', role => role.related('action_rights'))
            )
        )
        .related('guest_accesses', guestAccess =>
          guestAccess
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_GROUP_GUEST_NOTIFICATION_STATUSES)
            .related('guest_roles', guestRole =>
              guestRole.related('role', role => role.related('action_rights'))
            )
        )
    )
    .related('recipient_event', event =>
      event.related('participants', participant =>
        participant
          .where('user_id', userID)
          .related('participant_roles', participantRole =>
            participantRole.related('role', role => role.related('action_rights'))
          )
      )
    )
    .related('recipient_amendment', amendment =>
      amendment.related('collaborators', collaborator =>
        collaborator
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES)
          .related('role', role => role.related('action_rights'))
      )
    )
    .related('recipient_blog', blog =>
      blog.related('bloggers', blogger =>
        blogger.where('user_id', userID).related('role', role => role.related('action_rights'))
      )
    );
}

function buildEntityNotificationQuery(
  q: NotificationBaseQuery,
  userID: string | undefined,
  entityType: string
): ReturnType<typeof buildGenericEntityNotificationQuery> {
  if (isNotificationRecipientEntityType(entityType)) {
    switch (entityType) {
      case 'group':
        return buildGroupNotificationQuery(q, userID) as unknown as ReturnType<
          typeof buildGenericEntityNotificationQuery
        >;
      case 'event':
        return buildEventNotificationQuery(q, userID) as unknown as ReturnType<
          typeof buildGenericEntityNotificationQuery
        >;
      case 'amendment':
        return buildAmendmentNotificationQuery(q, userID) as unknown as ReturnType<
          typeof buildGenericEntityNotificationQuery
        >;
      case 'blog':
        return buildBlogNotificationQuery(q, userID) as unknown as ReturnType<
          typeof buildGenericEntityNotificationQuery
        >;
    }
  }

  return buildGenericEntityNotificationQuery(q, userID);
}

export function applyActiveNotificationState<T>(q: T, userID?: string): T {
  const query = q as any;
  if (!userID || userID === 'anon') return query.where('id', '__unauthorized__') as T;
  return query.where(({ or, cmp }: any) =>
    or(cmp('deleted_at', 'IS', null), cmp('deleted_at', 0))
  ) as T;
}

function applyTrashNotificationState<T>(q: T, userID: string | undefined): T {
  const query = q as any;
  if (!userID || userID === 'anon') return query.where('id', '__unauthorized__') as T;
  return query
    .where(({ or, cmp }: any) => or(cmp('deleted_at', 'IS', null), cmp('deleted_at', 0)))
    .whereExists('viewer_state', (state: any) =>
      state
        .where('user_id', userID)
        .where('dismissed_at', '>', 0)
        .where(({ or, cmp }: any) => or(cmp('purged_at', 'IS', null), cmp('purged_at', 0)))
    ) as T;
}

function applyNotificationTabState<T>(q: T, tab: string, userID: string | undefined): T {
  let query: any =
    tab === 'trash'
      ? applyTrashNotificationState(q, userID)
      : applyActiveNotificationState(q, userID);

  if (tab === 'read') {
    query = query.whereExists('viewer_state', (state: any) =>
      state.where('user_id', userID).where('read_at', '>', 0)
    );
  }
  // Missing-state semantics are derived from the loaded viewer_state on the
  // client because Zero issue #3438 prevents a safe anti-existence predicate.
  return query as T;
}

export const notificationQueries = {
  page: defineQuery(
    z.object({
      tab: z.enum(['all', 'unread', 'read', 'personal', 'entity', 'trash']).default('all'),
      query: z.string().default(''),
      entityId: z.string().nullable().default(null),
      entityType: z.string().nullable().default(null),
      limit: virtualPageLimitSchema,
      start: notificationStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { tab, query, entityId, entityType, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any =
        entityId && entityType
          ? buildEntityNotificationQuery(
              zql.notification
                .where('recipient_entity_id', entityId)
                .where('recipient_entity_type', entityType),
              userID,
              entityType
            )
          : buildGenericEntityNotificationQuery(zql.notification, userID);

      q = applyNotificationTabState(q, tab, userID);

      if (tab === 'personal') q = q.where('recipient_id', userID);
      if (tab === 'entity') {
        q = q.where('recipient_entity_type', 'IN', ['group', 'event', 'amendment', 'blog']);
      }

      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        q = q.where(({ or, cmp }: any) =>
          or(
            cmp('title', 'ILIKE', `%${normalizedQuery}%`),
            cmp('message', 'ILIKE', `%${normalizedQuery}%`)
          )
        );
      }

      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  countRows: defineQuery(
    z.object({
      tab: z.enum(['all', 'unread', 'read', 'personal', 'entity', 'trash']).default('all'),
      query: z.string().default(''),
      entityId: z.string().nullable().default(null),
      entityType: z.string().nullable().default(null),
    }),
    ({ args: { tab, query, entityId, entityType }, ctx: { userID } }) => {
      let q = buildGenericEntityNotificationQuery(zql.notification, userID);
      if (entityId && entityType) {
        q = q.where('recipient_entity_id', entityId).where('recipient_entity_type', entityType);
      }
      if (tab === 'personal') q = q.where('recipient_id', userID);
      if (tab === 'entity') {
        q = q.where('recipient_entity_type', 'IN', ['group', 'event', 'amendment', 'blog']);
      }
      q = applyNotificationTabState(q, tab, userID);
      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        q = q.where(({ or, cmp }: any) =>
          or(
            cmp('title', 'ILIKE', `%${normalizedQuery}%`),
            cmp('message', 'ILIKE', `%${normalizedQuery}%`)
          )
        );
      }
      return q.orderBy('created_at', 'desc').orderBy('id', 'desc');
    }
  ),

  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    withCommonNotificationRelations(
      applyActiveNotificationState(
        applyNotificationViewAccess(zql.notification.where('id', id), userID),
        userID
      ),
      userID
    )
      .related('recipient_group')
      .one()
  ),

  byIdIncludingTrash: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      withCommonNotificationRelations(
        applyNotificationTabState(
          applyNotificationViewAccess(zql.notification.where('id', id), userID),
          'trash',
          userID
        ),
        userID
      )
        .related('recipient_group')
        .one()
  ),

  // Notifications for the current user
  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    withCommonNotificationRelations(
      applyActiveNotificationState(
        applyNotificationViewAccess(zql.notification.where('recipient_id', userID), userID),
        userID
      ),
      userID
    )
      .orderBy('created_at', 'desc')
      .limit(500)
  ),

  // Unread notifications for the current user
  unreadCount: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyNotificationTabState(
      applyNotificationViewAccess(zql.notification, userID),
      'unread',
      userID
    )
  ),

  // Notification settings for the current user
  settings: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.notification_setting.where('user_id', userID).one()
  ),

  // Push subscriptions for the current user
  pushSubscriptions: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.push_subscription.where('user_id', userID)
  ),

  // Notifications for a specific entity
  byEntity: defineQuery(
    z.object({ entityId: z.string(), entityType: z.string() }),
    ({ ctx: { userID }, args: { entityId, entityType } }) =>
      applyActiveNotificationState(
        buildEntityNotificationQuery(
          zql.notification
            .where('recipient_entity_id', entityId)
            .where('recipient_entity_type', entityType),
          userID,
          entityType
        ),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(200)
  ),

  // Personal notifications with all relations and nested RBAC data
  byUserWithRelations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    buildGenericEntityNotificationQuery(
      applyActiveNotificationState(
        zql.notification.where('recipient_id', userID),
        userID
      ) as NotificationBaseQuery,
      userID
    ).orderBy('created_at', 'desc')
  ),

  // Group notifications by recipient group IDs
  byRecipientGroups: defineQuery(
    z.object({ groupIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { groupIds } }) =>
      applyActiveNotificationState(
        buildGroupNotificationQuery(
          zql.notification.where('recipient_group_id', 'IN', groupIds),
          userID
        ),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(50)
  ),

  // Event notifications by recipient event IDs
  byRecipientEvents: defineQuery(
    z.object({ eventIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { eventIds } }) =>
      applyActiveNotificationState(
        buildEventNotificationQuery(
          zql.notification.where('recipient_event_id', 'IN', eventIds),
          userID
        ),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(50)
  ),

  // Amendment notifications by recipient amendment IDs
  byRecipientAmendments: defineQuery(
    z.object({ amendmentIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { amendmentIds } }) =>
      applyActiveNotificationState(
        buildAmendmentNotificationQuery(
          zql.notification.where('recipient_amendment_id', 'IN', amendmentIds),
          userID
        ),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(50)
  ),

  // Blog notifications by recipient blog IDs
  byRecipientBlogs: defineQuery(
    z.object({ blogIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { blogIds } }) =>
      applyActiveNotificationState(
        buildBlogNotificationQuery(
          zql.notification.where('recipient_blog_id', 'IN', blogIds),
          userID
        ),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(50)
  ),

  // Push subscription by endpoint
  pushSubscriptionByEndpoint: defineQuery(
    z.object({ endpoint: z.string() }),
    ({ ctx: { userID }, args: { endpoint } }) =>
      zql.push_subscription.where('endpoint', endpoint).where('user_id', userID)
  ),

  // User's group memberships (for entity ID collection)
  userGroupMemberships: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.group_membership.where('user_id', userID).related('group')
  ),

  // User's event participations
  userEventParticipations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.event_participant.where('user_id', userID).related('event')
  ),

  // User's amendment collaborations
  userAmendmentCollaborations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.amendment_collaborator
      .where('user_id', userID)
      .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES)
      .related('amendment')
      .related('role', q => q.related('action_rights'))
  ),

  // User's blog relations
  userBlogRelations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.blog_blogger.where('user_id', userID).related('blog')
  ),

  byEntityId: defineQuery(
    z.object({ entity_id: z.string() }),
    ({ args: { entity_id }, ctx: { userID } }) =>
      applyActiveNotificationState(
        applyNotificationViewAccess(
          zql.notification.where('recipient_entity_id', entity_id),
          userID
        ),
        userID
      )
        .related('sender')
        .orderBy('created_at', 'desc')
        .limit(200)
  ),

  // ── Notification Read queries ──────────────────────────────────────

  // Legacy-compatible state query. New consumers should derive their count from
  // the same notification query used to render the list.
  readsByEntity: defineQuery(
    z.object({ entityId: z.string(), entityType: z.string() }),
    ({ ctx: { userID }, args: { entityId, entityType } }) =>
      zql.notification_user_state
        .where('user_id', userID)
        .whereExists('notification', q =>
          applyNotificationViewAccess(
            q.where('recipient_entity_id', entityId).where('recipient_entity_type', entityType),
            userID
          )
        )
  ),
};

export type NotificationWithRelationsRow = QueryRowType<
  typeof notificationQueries.byUserWithRelations
>;
export type NotificationSettingsRow = QueryRowType<typeof notificationQueries.settings>;

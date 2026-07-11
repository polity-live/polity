import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

const ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES = [
  'active',
  'collaborator',
  'member',
  'admin',
];

function applyNotificationAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('recipient_id', userID),
      exists('recipient_group', (group: any) =>
        group.whereExists('memberships', (membership: any) => membership.where('user_id', userID))
      ),
      exists('recipient_event', (event: any) =>
        event.whereExists('participants', (participant: any) =>
          participant.where('user_id', userID)
        )
      ),
      exists('recipient_amendment', (amendment: any) =>
        amendment.where(({ or, cmp, exists }: any) =>
          or(
            cmp('created_by_id', userID),
            exists('collaborators', (collaborator: any) =>
              collaborator
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES)
            )
          )
        )
      ),
      exists('recipient_blog', (blog: any) =>
        blog.whereExists('bloggers', (blogger: any) => blogger.where('user_id', userID))
      )
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
          exists('recipient_group', (group: any) =>
            group.whereExists('memberships', (membership: any) =>
              membership.where('user_id', userID)
            )
          )
        );
      case 'event':
        return or(
          personalRecipient,
          exists('recipient_event', (event: any) =>
            event.whereExists('participants', (participant: any) =>
              participant.where('user_id', userID)
            )
          )
        );
      case 'amendment':
        return or(
          personalRecipient,
          exists('recipient_amendment', (amendment: any) =>
            amendment.where(({ or, cmp, exists }: any) =>
              or(
                cmp('created_by_id', userID),
                exists('collaborators', (collaborator: any) =>
                  collaborator
                    .where('user_id', userID)
                    .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES)
                )
              )
            )
          )
        );
      case 'blog':
        return or(
          personalRecipient,
          exists('recipient_blog', (blog: any) =>
            blog.whereExists('bloggers', (blogger: any) => blogger.where('user_id', userID))
          )
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
    .related('reads', reads => reads.where('read_by_user_id', userID));
}

function buildGroupNotificationQuery(q: NotificationBaseQuery, userID: string | undefined) {
  return withCommonNotificationRelations(
    applyTypedNotificationAccess(q, userID, 'group'),
    userID
  ).related('recipient_group', group =>
    group.related('memberships', membership =>
      membership
        .where('user_id', userID)
        .related('membership_roles', membershipRole =>
          membershipRole.related('role', role => role.related('action_rights'))
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
  return withCommonNotificationRelations(applyNotificationAccess(q, userID), userID)
    .related('recipient_group', group =>
      group.related('memberships', membership =>
        membership
          .where('user_id', userID)
          .related('membership_roles', membershipRole =>
            membershipRole.related('role', role => role.related('action_rights'))
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

export const notificationQueries = {
  // Notifications for the current user
  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.notification.where('recipient_id', userID).orderBy('created_at', 'desc').limit(500)
  ),

  // Unread notifications for the current user
  unreadCount: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.notification.where('recipient_id', userID).where('is_read', false)
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
      buildEntityNotificationQuery(
        zql.notification
          .where('recipient_entity_id', entityId)
          .where('recipient_entity_type', entityType),
        userID,
        entityType
      )
        .orderBy('created_at', 'desc')
        .limit(200)
  ),

  // Personal notifications with all relations and nested RBAC data
  byUserWithRelations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.notification
      .where('recipient_id', userID)
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
      .related('reads', q => q.where('read_by_user_id', userID))
      .related('recipient_group', q =>
        q.related('memberships', q =>
          q
            .where('user_id', userID)
            .related('membership_roles', mq =>
              mq.related('role', rq => rq.related('action_rights'))
            )
        )
      )
      .related('recipient_event', q =>
        q.related('participants', q =>
          q
            .where('user_id', userID)
            .related('participant_roles', pq =>
              pq.related('role', rq => rq.related('action_rights'))
            )
        )
      )
      .related('recipient_amendment', q =>
        q.related('collaborators', q =>
          q
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_NOTIFICATION_STATUSES)
            .related('role', rq => rq.related('action_rights'))
        )
      )
      .related('recipient_blog', q =>
        q.related('bloggers', q =>
          q.where('user_id', userID).related('role', q => q.related('action_rights'))
        )
      )
      .orderBy('created_at', 'desc')
  ),

  // Group notifications by recipient group IDs
  byRecipientGroups: defineQuery(
    z.object({ groupIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { groupIds } }) =>
      buildGroupNotificationQuery(
        zql.notification.where('recipient_group_id', 'IN', groupIds),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(50)
  ),

  // Event notifications by recipient event IDs
  byRecipientEvents: defineQuery(
    z.object({ eventIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { eventIds } }) =>
      buildEventNotificationQuery(
        zql.notification.where('recipient_event_id', 'IN', eventIds),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(50)
  ),

  // Amendment notifications by recipient amendment IDs
  byRecipientAmendments: defineQuery(
    z.object({ amendmentIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { amendmentIds } }) =>
      buildAmendmentNotificationQuery(
        zql.notification.where('recipient_amendment_id', 'IN', amendmentIds),
        userID
      )
        .orderBy('created_at', 'desc')
        .limit(50)
  ),

  // Blog notifications by recipient blog IDs
  byRecipientBlogs: defineQuery(
    z.object({ blogIds: z.array(z.string()) }),
    ({ ctx: { userID }, args: { blogIds } }) =>
      buildBlogNotificationQuery(zql.notification.where('recipient_blog_id', 'IN', blogIds), userID)
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
      applyNotificationAccess(zql.notification.where('recipient_entity_id', entity_id), userID)
        .related('sender')
        .orderBy('created_at', 'desc')
        .limit(200)
  ),

  // ── Notification Read queries ──────────────────────────────────────

  // Reads for a specific entity (to compute unread count)
  readsByEntity: defineQuery(
    z.object({ entityId: z.string(), entityType: z.string() }),
    ({ ctx: { userID }, args: { entityId, entityType } }) =>
      zql.notification_read
        .where('entity_id', entityId)
        .where('entity_type', entityType)
        .where('read_by_user_id', userID)
  ),
};

export type NotificationWithRelationsRow = QueryRowType<
  typeof notificationQueries.byUserWithRelations
>;
export type NotificationSettingsRow = QueryRowType<typeof notificationQueries.settings>;

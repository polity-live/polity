import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { requireQueryUser, requireRequestedViewer } from './query-access';
import { zql } from '../schema';

const ACTIVE_EVENT_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];

export const rbacQueries = {
  /**
   * Stable viewer projections. They intentionally carry no user argument and
   * use scalar foreign keys instead of hydrating complete target entities.
   * Pending/invited rows are included so list cards can reuse the same data.
   */
  viewerMemberships: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    requireQueryUser(zql.group_membership, userID).related('membership_roles', q =>
      q.related('role', rq => rq.related('action_rights'))
    )
  ),

  viewerGuestAccesses: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    requireQueryUser(zql.group_guest_access, userID).related('guest_roles', q =>
      q.related('role', rq => rq.related('action_rights'))
    )
  ),

  viewerParticipations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    requireQueryUser(zql.event_participant, userID).related('participant_roles', q =>
      q.related('role', rq => rq.related('action_rights'))
    )
  ),

  viewerBloggerRelations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    requireQueryUser(zql.blog_blogger, userID).related('role', q => q.related('action_rights'))
  ),

  viewerOwnedGroups: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    requireQueryUser(zql.group, userID, 'owner_id')
  ),

  /** Group memberships for a user with attached roles→action_rights and group */
  membershipPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireRequestedViewer(zql.group_membership, userId, userID)
        .where('status', 'IN', ['active', 'member', 'admin'])
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
        .related('group')
  ),

  /** Active guest accesses for a user with attached guest roles→action_rights and group */
  guestPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireRequestedViewer(zql.group_guest_access, userId, userID)
        .where('status', 'active')
        .related('guest_roles', q => q.related('role', rq => rq.related('action_rights')))
        .related('group')
  ),

  /** Groups owned by the user, used as an owner fallback in RBAC checks */
  ownedGroupPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireRequestedViewer(zql.group, userId, userID, 'owner_id')
  ),

  /** Event participations for a user with attached roles→action_rights and event */
  participantPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireRequestedViewer(zql.event_participant, userId, userID)
        .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES)
        .related('participant_roles', q => q.related('role', rq => rq.related('action_rights')))
        .related('event')
  ),

  /** Blog blogger relations for a user with role→action_rights and blog */
  bloggerPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireRequestedViewer(zql.blog_blogger, userId, userID)
        .related('role', q => q.related('action_rights'))
        .related('blog')
  ),
};

import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { requireQueryUser } from './query-access';
import { zql } from '../schema';

export const rbacQueries = {
  /** Group memberships for a user with attached roles→action_rights and group */
  membershipPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireQueryUser(zql.group_membership, userID)
        .where('user_id', userId)
        .where('status', 'IN', ['active', 'member', 'admin'])
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
        .related('group')
  ),

  /** Active guest accesses for a user with attached guest roles→action_rights and group */
  guestPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireQueryUser(zql.group_guest_access, userID)
        .where('user_id', userId)
        .where('status', 'active')
        .related('guest_roles', q => q.related('role', rq => rq.related('action_rights')))
        .related('group')
  ),

  /** Groups owned by the user, used as an owner fallback in RBAC checks */
  ownedGroupPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireQueryUser(zql.group, userID, 'owner_id').where('owner_id', userId)
  ),

  /** Event participations for a user with attached roles→action_rights and event */
  participantPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireQueryUser(zql.event_participant, userID)
        .where('user_id', userId)
        .related('participant_roles', q => q.related('role', rq => rq.related('action_rights')))
        .related('event')
  ),

  /** Blog blogger relations for a user with role→action_rights and blog */
  bloggerPermissions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      requireQueryUser(zql.blog_blogger, userID)
        .where('user_id', userId)
        .related('role', q => q.related('action_rights'))
        .related('blog')
  ),
};

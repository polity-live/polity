import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAmendmentQueryAccess,
  applyBlogQueryAccess,
  applyDocumentQueryAccess,
  applyEventManagerQueryAccess,
  applyEventQueryAccess,
  applyGroupManagerQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyTodoQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';

function applyGroupAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('owner_id', userID),
      exists('memberships', (membership: any) => membership.where('user_id', userID)),
      exists('guest_accesses', (guestAccess: any) => guestAccess.where('user_id', userID))
    )
  ) as T;
}

export const groupQueries = {
  // ── Existing queries (unchanged) ──────────────────────────────────

  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyGroupAccess(zql.group.where('id', id), userID).one()
  ),

  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.group_membership
      .where('user_id', userID)
      .related('group')
      .related('membership_roles', q => q.related('role'))
      .orderBy('created_at', 'desc')
  ),

  search: defineQuery(z.object({ query: z.string() }), ({ args: { query }, ctx: { userID } }) =>
    applyGroupAccess(zql.group.where('name', 'ILIKE', `%${query}%`), userID).orderBy('name', 'asc')
  ),

  memberships: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupMembershipSelfOrManagerQueryAccess(zql.group_membership, userID)
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('membership_roles', q => q.related('role'))
        .orderBy('created_at', 'desc')
  ),

  roles: defineQuery(z.object({ groupId: z.string() }), ({ args: { groupId }, ctx: { userID } }) =>
    zql.role
      .where('group_id', groupId)
      .whereExists('group', group =>
        applyGroupManagerQueryAccess(group, userID, 'manage_roles', ['groups', 'groupRoles'])
      )
      .orderBy('sort_order', 'asc')
  ),

  scopedRoles: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.role
        .where('group_id', groupId)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage_roles', ['groups', 'groupRoles'])
        )
        .where('scope', 'group')
        .orderBy('sort_order', 'asc')
  ),

  membershipsByUser: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.group_membership
        .where('user_id', user_id)
        .where('user_id', userID)
        .related('group', q => q.related('owner'))
        .related('membership_roles', q => q.related('role'))
  ),

  currentUserMembershipsWithGroups: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.group_membership
      .where('user_id', userID)
      .related('group')
      .related('membership_roles', q => q.related('role'))
  ),

  /** Current user's memberships with group and role→action_rights (for permission-filtered dropdowns) */
  currentUserMembershipsWithRights: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.group_membership
      .where('user_id', userID)
      .related('group')
      .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  membershipsWithUsers: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupMembershipSelfOrManagerQueryAccess(zql.group_membership, userID)
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('group')
        .related('user')
        .related('source_group')
        .related('part_group')
        .related('base_group')
        .related('origins', originQuery =>
          originQuery.related('source_group').related('part_group').related('base_group')
        )
        .related('membership_roles', q => q.related('role'))
  ),

  offlineMembersByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_offline_member
        .where('group_id', groupId)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage_members', [
            'groups',
            'groupMemberships',
          ])
        )
        .related('group')
        .related('connected_user')
        .related('created_by')
        .orderBy('created_at', 'asc')
  ),

  offlineMembersByGroupIds: defineQuery(
    z.object({ groupIds: z.array(z.string()) }),
    ({ args: { groupIds }, ctx: { userID } }) =>
      zql.group_offline_member
        .where('group_id', 'IN', groupIds)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage_members', [
            'groups',
            'groupMemberships',
          ])
        )
        .related('group')
        .related('connected_user')
        .related('created_by')
        .orderBy('created_at', 'asc')
  ),

  offlineMembershipsWithRolesAndRights: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_offline_membership
        .where('group_id', groupId)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage_members', [
            'groups',
            'groupMemberships',
          ])
        )
        .related('group')
        .related('source_group')
        .related('group_offline_member', q =>
          q.related('group').related('connected_user').related('created_by')
        )
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
        .orderBy('created_at', 'asc')
  ),

  offlineMembershipsWithRolesAndRightsByGroupIds: defineQuery(
    z.object({ groupIds: z.array(z.string()) }),
    ({ args: { groupIds }, ctx: { userID } }) =>
      zql.group_offline_membership
        .where('group_id', 'IN', groupIds)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage_members', [
            'groups',
            'groupMemberships',
          ])
        )
        .related('group')
        .related('source_group')
        .related('group_offline_member', q =>
          q.related('group').related('connected_user').related('created_by')
        )
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
        .orderBy('created_at', 'asc')
  ),

  // ── New queries (extracted from hooks.ts) ─────────────────────────

  /** Deep-relational query powering the GroupWiki page */
  wikiData: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyGroupAccess(zql.group.where('id', id), userID)
      .related('owner')
      .related('connections_as_group_a', q =>
        q
          .related('group_b', tq =>
            tq
              .related('memberships', mq =>
                applyGroupMembershipSelfOrManagerQueryAccess(mq, userID)
              )
              .related('events', event => applyEventQueryAccess(event, userID))
              .related('amendments', amendment => applyAmendmentQueryAccess(amendment, userID))
          )
          .related('grants', rq => rq.related('initiator_group'))
          .related('membership_rule', mq => mq.related('required_source_role').related('origins'))
      )
      .related('connections_as_group_b', q =>
        q
          .related('group_a', sq =>
            sq
              .related('memberships', mq =>
                applyGroupMembershipSelfOrManagerQueryAccess(mq, userID)
              )
              .related('events', event => applyEventQueryAccess(event, userID))
              .related('amendments', amendment => applyAmendmentQueryAccess(amendment, userID))
          )
          .related('grants', rq => rq.related('initiator_group'))
          .related('membership_rule', mq => mq.related('required_source_role').related('origins'))
      )
      .related('events', q => applyEventQueryAccess(q, userID))
      .related('amendments', q => applyAmendmentQueryAccess(q, userID))
      .related('offline_members', q =>
        q
          .whereExists('group', group =>
            applyGroupManagerQueryAccess(group, userID, 'manage_members', [
              'groups',
              'groupMemberships',
            ])
          )
          .related('connected_user')
          .related('created_by')
      )
      .related('memberships', q =>
        applyGroupMembershipSelfOrManagerQueryAccess(q, userID)
          .related('user')
          .related('source_group')
          .related('part_group')
          .related('base_group')
          .related('origins', originQuery =>
            originQuery.related('source_group').related('part_group').related('base_group')
          )
          .related('membership_roles', mq => mq.related('role'))
      )
      .related('guest_accesses', q =>
        q
          .where('user_id', userID ?? '__anon__')
          .related('user')
          .related('guest_roles', gq => gq.related('role'))
      )
      .related('group_hashtags', q => q.related('hashtag'))
      .related('roles', q =>
        q
          .whereExists('group', group =>
            applyGroupManagerQueryAccess(group, userID, 'manage_roles', ['groups', 'groupRoles'])
          )
          .related('holder_history', q => q.related('user'))
      )
      .related('blogs', q =>
        applyBlogQueryAccess(q, userID).related('blog_hashtags', q => q.related('hashtag'))
      )
  ),

  /** User's membership rows in a specific group, with role */
  userMembershipInGroup: defineQuery(
    z.object({ userId: z.string(), groupId: z.string() }),
    ({ args: { userId, groupId }, ctx: { userID } }) =>
      zql.group_membership
        .where('user_id', userId)
        .where('user_id', userID)
        .where('group_id', groupId)
        .related('group')
        .related('source_group')
        .related('part_group')
        .related('base_group')
        .related('origins', originQuery =>
          originQuery.related('source_group').related('part_group').related('base_group')
        )
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** All membership rows for a group, with role (used alongside userMembershipInGroup) */
  allMembershipsInGroupWithRole: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupMembershipSelfOrManagerQueryAccess(zql.group_membership, userID)
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('group')
        .related('user')
        .related('source_group')
        .related('part_group')
        .related('base_group')
        .related('origins', originQuery =>
          originQuery.related('source_group').related('part_group').related('base_group')
        )
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** Subscribers for a group with user and group relations */
  subscribersByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.subscriber
        .where('group_id', groupId)
        .where(({ or, cmp, exists }: any) =>
          or(
            cmp('subscriber_id', userID ?? '__anon__'),
            exists('group', (group: any) =>
              applyGroupManagerQueryAccess(group, userID, 'manage_members', [
                'groups',
                'groupMemberships',
              ])
            )
          )
        )
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('subscriber_user')
        .related('group')
  ),

  /** All groups (no relations, no filter) */
  all: defineQuery(z.object({}), ({ ctx: { userID } }) => applyGroupAccess(zql.group, userID)),

  /** All documents with collaborator→user relations (cross-domain convenience) */
  allDocuments: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyDocumentQueryAccess(zql.document, userID).related('collaborators', q => q.related('user'))
  ),

  /** Group by ID with owner, conversations, memberships→user+role, roles→action_rights, events, amendments */
  byIdFull: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyGroupAccess(zql.group.where('id', id), userID)
      .related('owner')
      .related('connections_as_group_a', q =>
        q
          .related('group_b')
          .related('grants', rq => rq.related('initiator_group'))
          .related('membership_rule', mq => mq.related('required_source_role').related('origins'))
      )
      .related('connections_as_group_b', q =>
        q
          .related('group_a')
          .related('grants', rq => rq.related('initiator_group'))
          .related('membership_rule', mq => mq.related('required_source_role').related('origins'))
      )
      .related('conversations', q =>
        q
          .whereExists('participants', p => p.where('user_id', userID ?? '__anon__'))
          .related('participants', q => q.where('user_id', userID ?? '__anon__').related('user'))
      )
      .related('offline_members', q =>
        q
          .whereExists('group', group =>
            applyGroupManagerQueryAccess(group, userID, 'manage_members', [
              'groups',
              'groupMemberships',
            ])
          )
          .related('connected_user')
          .related('created_by')
      )
      .related('memberships', q =>
        applyGroupMembershipSelfOrManagerQueryAccess(q, userID)
          .related('user')
          .related('source_group')
          .related('part_group')
          .related('base_group')
          .related('origins', originQuery =>
            originQuery.related('source_group').related('part_group').related('base_group')
          )
          .related('membership_roles', mq => mq.related('role'))
      )
      .related('guest_accesses', q =>
        q
          .where('user_id', userID ?? '__anon__')
          .related('user')
          .related('guest_roles', gq => gq.related('role', rq => rq.related('action_rights')))
      )
      .related('roles', q =>
        q
          .whereExists('group', group =>
            applyGroupManagerQueryAccess(group, userID, 'manage_roles', ['groups', 'groupRoles'])
          )
          .related('action_rights')
      )
      .related('events', q => applyEventQueryAccess(q, userID))
      .related('amendments', q => applyAmendmentQueryAccess(q, userID))
  ),

  /** Memberships for a group with user and role→action_rights (for membership tables) */
  membershipsWithRolesAndRights: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupMembershipSelfOrManagerQueryAccess(zql.group_membership, userID)
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('group')
        .related('user')
        .related('source_group')
        .related('part_group')
        .related('base_group')
        .related('origins', originQuery =>
          originQuery.related('source_group').related('part_group').related('base_group')
        )
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** Memberships for several groups with user, source_group, and role→action_rights. */
  membershipsWithRolesAndRightsByGroupIds: defineQuery(
    z.object({ groupIds: z.array(z.string()) }),
    ({ args: { groupIds }, ctx: { userID } }) =>
      applyGroupMembershipSelfOrManagerQueryAccess(zql.group_membership, userID)
        .where('group_id', 'IN', groupIds)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('group')
        .related('user')
        .related('source_group')
        .related('part_group')
        .related('base_group')
        .related('origins', originQuery =>
          originQuery.related('source_group').related('part_group').related('base_group')
        )
        .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** Guest accesses for a group with user and role→action_rights */
  guestAccessesWithRolesAndRights: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_guest_access
        .where('group_id', groupId)
        .where('user_id', userID ?? '__anon__')
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('user')
        .related('guest_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** Current user's guest accesses with group and guest role→action_rights */
  currentUserGuestAccessesWithGroups: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.group_guest_access
      .where('user_id', userID)
      .related('group')
      .related('guest_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** Access roles scoped to a group with action_rights */
  accessRolesWithRights: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.role
        .where('group_id', groupId)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage_roles', ['groups', 'groupRoles'])
        )
        .where('scope', 'group')
        .related('action_rights')
        .orderBy('sort_order', 'asc')
  ),

  /** Direct memberships across all groups (hierarchy exclusivity checks) */
  directMemberships: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyGroupMembershipSelfOrManagerQueryAccess(zql.group_membership, userID)
      .where('source', 'direct')
      .whereExists('group', group => applyGroupAccess(group, userID))
      .related('user')
  ),

  /** Amendments for a group with hashtags and creator */
  amendmentsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.amendment_group_decision
        .where('group_id', groupId)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage', ['groups', 'amendments'])
        )
        .related('group')
        .related('process_run')
        .related('process_branch')
        .related('process_step_run')
        .related('amendment', q =>
          q.related('amendment_hashtags', hq => hq.related('hashtag')).related('created_by')
        )
        .orderBy('updated_at', 'desc')
  ),

  /** Amendment process steps attached to a group's events */
  amendmentEventStepRunsByEventIds: defineQuery(
    z.object({ eventIds: z.array(z.string()) }),
    ({ args: { eventIds }, ctx: { userID } }) =>
      zql.amendment_process_step_run
        .where('event_id', 'IN', eventIds)
        .whereExists('event', event => applyEventManagerQueryAccess(event, userID))
        .related('event')
        .related('target_group')
        .related('process_run', q =>
          q.related('amendment', aq =>
            aq.related('amendment_hashtags', hq => hq.related('hashtag')).related('created_by')
          )
        )
        .orderBy('updated_at', 'desc')
  ),

  /** Amendments for a group with nested documents→collaborators→user (for group document lists) */
  amendmentsWithDocuments: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyAmendmentQueryAccess(zql.amendment, userID)
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .where('document_id', 'IS', null)
        .related('documents', q =>
          applyDocumentQueryAccess(q, userID).related('collaborators', cq =>
            cq.where('user_id', userID ?? '__anon__').related('user')
          )
        )
  ),

  /** Roles for a group with group, elections→agenda_item+candidates, and holder_history */
  rolesFull: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.role
        .where('group_id', groupId)
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage_roles', ['groups', 'groupRoles'])
        )
        .where('scope', 'group')
        .related('group')
        .related('action_rights')
        .related('group_membership_roles', q =>
          q.related('group_membership', mq =>
            mq.where('status', 'active').related('user').orderBy('created_at', 'asc')
          )
        )
        .related('elections', q =>
          q
            .related('agenda_item', a => a.related('event'))
            .related('candidates', c => c.related('user'))
        )
        .related('holder_history', q => q.related('user'))
  ),

  /** Todos for a group with creator, assignments→user, and group */
  todosByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyTodoQueryAccess(zql.todo, userID)
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('creator')
        .related('assignments', q => q.where('user_id', userID ?? '__anon__').related('user'))
        .related('group')
  ),

  /** Links belonging to a group */
  linksByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.link
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
  ),

  /** Payments where the group is the receiver */
  paymentsReceivedByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.payment
        .where('receiver_group_id', groupId)
        .whereExists('receiver_group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage', ['groupPayments', 'payments'])
        )
        .related('receiver_group')
        .related('payer_group')
        .related('receiver_user')
        .related('payer_user')
  ),

  /** Payments where the group is the payer */
  paymentsPaidByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.payment
        .where('payer_group_id', groupId)
        .whereExists('payer_group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage', ['groupPayments', 'payments'])
        )
        .related('receiver_group')
        .related('payer_group')
        .related('receiver_user')
        .related('payer_user')
  ),

  /** Active (status='active') memberships for a group with user data (for dialogs) */
  activeMembersByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupMembershipSelfOrManagerQueryAccess(zql.group_membership, userID)
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupAccess(group, userID))
        .where('status', 'active')
        .related('user')
  ),

  /** Active memberships for accessible groups, with user data (for assignment pickers). */
  assignableActiveMembersByGroupIds: defineQuery(
    z.object({ groupIds: z.array(z.string()) }),
    ({ args: { groupIds }, ctx: { userID } }) =>
      zql.group_membership
        .where('group_id', 'IN', groupIds)
        .where('status', 'IN', ['active', 'admin', 'member'])
        .whereExists('group', group => applyGroupAccess(group, userID))
        .related('user')
  ),

  /** All users limited to 20 (for user search / invite dialogs) */
  allUsersLimited: defineQuery(z.object({}), ({ ctx: { userID } }) => {
    if (!userID || userID === 'anon') return zql.user.where('visibility', 'public').limit(20);
    return zql.user
      .where(({ or, cmp }: any) =>
        or(cmp('visibility', 'IN', ['public', 'authenticated']), cmp('id', userID))
      )
      .limit(20);
  }),

  /** Public groups with optional limit */
  publicGroups: defineQuery(z.object({}), () =>
    zql.group
      .where('visibility', 'public')
      .related('group_hashtags', q => q.related('hashtag'))
      .limit(100)
  ),

  /** User's group memberships with nested group→hashtags, events, amendments (for timeline) */
  userMembershipsWithGroupRelations: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      zql.group_membership
        .where('user_id', userId)
        .where('user_id', userID)
        .related('group', q =>
          q
            .related('group_hashtags', q => q.related('hashtag'))
            .related('events', q => applyEventQueryAccess(q, userID))
            .related('amendments', q => applyAmendmentQueryAccess(q, userID))
        )
  ),

  /** Single group by ID (no relations, for subscriber name lookups) */
  byIdBasic: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyGroupAccess(zql.group.where('id', id), userID)
  ),

  /** Single group by ID for network view (no relations) */
  byIdForNetwork: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyGroupAccess(zql.group.where('id', id), userID)
      .related('connections_as_group_a', q =>
        q
          .related('group_b')
          .related('grants', rq => rq.related('initiator_group'))
          .related('membership_rule', mq => mq.related('required_source_role').related('origins'))
      )
      .related('connections_as_group_b', q =>
        q
          .related('group_a')
          .related('grants', rq => rq.related('initiator_group'))
          .related('membership_rule', mq => mq.related('required_source_role').related('origins'))
      )
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type GroupByIdFullRow = QueryRowType<typeof groupQueries.byIdFull>;
export type GroupWikiRow = QueryRowType<typeof groupQueries.wikiData>;
export type GroupMembershipWithUserRow = QueryRowType<typeof groupQueries.membershipsWithUsers>;
export type GroupMembershipWithRoleRow = QueryRowType<
  typeof groupQueries.allMembershipsInGroupWithRole
>;
export type GroupMembershipWithRelationsRow = QueryRowType<
  typeof groupQueries.userMembershipsWithGroupRelations
>;
export type GroupOfflineMemberRow = QueryRowType<typeof groupQueries.offlineMembersByGroup>;
export type GroupOfflineMemberByGroupIdsRow = QueryRowType<
  typeof groupQueries.offlineMembersByGroupIds
>;
export type GroupOfflineMembershipWithRolesAndRightsRow = QueryRowType<
  typeof groupQueries.offlineMembershipsWithRolesAndRights
>;
export type GroupOfflineMembershipWithRolesAndRightsByGroupIdsRow = QueryRowType<
  typeof groupQueries.offlineMembershipsWithRolesAndRightsByGroupIds
>;
export type GroupMembershipsByUserRow = QueryRowType<typeof groupQueries.membershipsByUser>;
export type GroupAccessRoleWithRightsRow = QueryRowType<typeof groupQueries.accessRolesWithRights>;
export type GroupMembershipWithRolesAndRightsRow = QueryRowType<
  typeof groupQueries.membershipsWithRolesAndRights
>;
export type GroupMembershipWithRolesAndRightsByGroupIdsRow = QueryRowType<
  typeof groupQueries.membershipsWithRolesAndRightsByGroupIds
>;
export type GroupGuestAccessWithRolesAndRightsRow = QueryRowType<
  typeof groupQueries.guestAccessesWithRolesAndRights
>;
export type GroupRoleFullRow = QueryRowType<typeof groupQueries.rolesFull>;
export type GroupTodoRow = QueryRowType<typeof groupQueries.todosByGroup>;
export type GroupAmendmentRow = QueryRowType<typeof groupQueries.amendmentsByGroup>;
export type GroupAmendmentEventStepRunRow = QueryRowType<
  typeof groupQueries.amendmentEventStepRunsByEventIds
>;
export type GroupAmendmentWithDocsRow = QueryRowType<typeof groupQueries.amendmentsWithDocuments>;
export type GroupDirectMembershipRow = QueryRowType<typeof groupQueries.directMemberships>;
export type GroupSubscriberRow = QueryRowType<typeof groupQueries.subscribersByGroup>;
export type GroupPaymentRow = QueryRowType<typeof groupQueries.paymentsReceivedByGroup>;
export type GroupLinkRow = QueryRowType<typeof groupQueries.linksByGroup>;
export type GroupAssignableActiveMemberRow = QueryRowType<
  typeof groupQueries.assignableActiveMembersByGroupIds
>;

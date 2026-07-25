import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { applyGroupQueryAccess } from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

const networkCursorSchema = z
  .object({ id: z.string(), updated_at: z.number() })
  .nullable()
  .default(null);

function applyGroupConnectionAccess<T>(q: T, userID: string | undefined | null): T {
  return (q as any).where(({ or, exists }: any) =>
    or(
      exists('group_a', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      }),
      exists('group_b', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      }),
      exists('parent_group', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      }),
      exists('child_group', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      }),
      exists('from_group', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      }),
      exists('to_group', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      })
    )
  ) as T;
}

function applyGroupConnectionRequestAccess<T>(q: T, userID: string | undefined | null): T {
  return (q as any).where(({ or, exists }: any) =>
    or(
      exists('group_a', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      }),
      exists('group_b', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      }),
      exists('initiator_group', (group: any) => applyGroupQueryAccess(group, userID), {
        flip: false,
      })
    )
  ) as T;
}

function applyWorkflowAccess<T>(q: T, userID: string | undefined | null): T {
  return (q as any).where(({ or, exists }: any) =>
    or(
      exists('group', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('start_group', (group: any) => applyGroupQueryAccess(group, userID))
    )
  ) as T;
}

function applyWorkflowApprovalAccess<T>(q: T, userID: string | undefined | null): T {
  return (q as any).where(({ or, exists }: any) =>
    or(
      exists('group', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('requested_by_group', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('workflow', (workflow: any) => applyWorkflowAccess(workflow, userID))
    )
  ) as T;
}

export const networkQueries = {
  wikiNetwork: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupConnectionAccess(zql.group_connection, userID)
        .where(({ cmp, or }) =>
          or(
            cmp('group_a_id', '=', groupId),
            cmp('group_b_id', '=', groupId),
            cmp('from_group_id', '=', groupId),
            cmp('to_group_id', '=', groupId)
          )
        )
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
        .related('from_group')
        .related('to_group')
        .related('grants', grants => grants.related('initiator_group').orderBy('right_key', 'asc'))
        .related('membership_rule', membershipRule =>
          membershipRule
            .related('required_source_role')
            .related('origins', origin => origin.related('eligible_origin_group'))
        )
        .orderBy('updated_at', 'desc')
  ),

  groupConnectionPage: defineQuery(
    z.object({
      groupId: z.string(),
      status: z.string().optional(),
      relationshipType: z.enum(['all', 'parent', 'child', 'sibling']).default('all'),
      rights: z.array(z.string()).default([]),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: networkCursorSchema,
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({
      args: { groupId, status, relationshipType, rights, query, limit, start, dir },
      ctx: { userID },
    }) => {
      let q: any = applyGroupConnectionAccess(zql.group_connection, userID).where(
        ({ cmp, or }: any) =>
          or(
            cmp('group_a_id', '=', groupId),
            cmp('group_b_id', '=', groupId),
            cmp('from_group_id', '=', groupId),
            cmp('to_group_id', '=', groupId)
          )
      );
      if (status) q = q.where('status', status);
      if (relationshipType === 'sibling') q = q.where('connection_type', 'peer');
      if (relationshipType === 'parent') q = q.where('parent_group_id', groupId);
      if (relationshipType === 'child') q = q.where('child_group_id', groupId);
      if ((rights?.length ?? 0) > 0) {
        q = q.whereExists('grants', (grant: any) =>
          grant.where('status', 'active').where('right_key', 'IN', rights)
        );
      }
      const term = query.trim();
      if (term) {
        q = q.where(({ or, exists }: any) =>
          or(
            exists('group_a', (group: any) => group.where('name', 'ILIKE', `%${term}%`)),
            exists('group_b', (group: any) => group.where('name', 'ILIKE', `%${term}%`))
          )
        );
      }
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('updated_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
        .related('from_group')
        .related('to_group')
        .related('grants', (grant: any) => grant.orderBy('right_key', 'asc'))
        .related('membership_rule', (membershipRuleQuery: any) =>
          membershipRuleQuery.related('required_source_role')
        )
        .limit(limit);
    }
  ),
  groupConnectionsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupConnectionAccess(zql.group_connection, userID)
        .where(({ cmp, or }) =>
          or(
            cmp('group_a_id', '=', groupId),
            cmp('group_b_id', '=', groupId),
            cmp('from_group_id', '=', groupId),
            cmp('to_group_id', '=', groupId)
          )
        )
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
        .related('from_group')
        .related('to_group')
        .related('created_by')
        .related('grants', grantsQuery =>
          grantsQuery
            .related('holder_group')
            .related('scope_group')
            .related('initiator_group')
            .orderBy('right_key', 'asc')
        )
        .related('membership_rule', membershipRuleQuery =>
          membershipRuleQuery
            .related('member_source_group')
            .related('member_target_group')
            .related('required_source_role')
            .related('origins', originQuery => originQuery.related('eligible_origin_group'))
        )
        .orderBy('updated_at', 'desc')
  ),

  groupConnectionsByPair: defineQuery(
    z.object({ groupAId: z.string(), groupBId: z.string() }),
    ({ args: { groupAId, groupBId }, ctx: { userID } }) =>
      applyGroupConnectionAccess(zql.group_connection, userID)
        .where(({ and, cmp, or }) =>
          or(
            and(cmp('group_a_id', '=', groupAId), cmp('group_b_id', '=', groupBId)),
            and(cmp('group_a_id', '=', groupBId), cmp('group_b_id', '=', groupAId)),
            and(cmp('from_group_id', '=', groupAId), cmp('to_group_id', '=', groupBId)),
            and(cmp('from_group_id', '=', groupBId), cmp('to_group_id', '=', groupAId))
          )
        )
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
        .related('from_group')
        .related('to_group')
        .related('created_by')
        .related('grants', grantsQuery =>
          grantsQuery
            .related('holder_group')
            .related('scope_group')
            .related('initiator_group')
            .orderBy('right_key', 'asc')
        )
        .related('membership_rule', membershipRuleQuery =>
          membershipRuleQuery
            .related('member_source_group')
            .related('member_target_group')
            .related('required_source_role')
            .related('origins', originQuery => originQuery.related('eligible_origin_group'))
        )
        .orderBy('updated_at', 'desc')
  ),

  allGroupConnections: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyGroupConnectionAccess(zql.group_connection, userID)
      .related('group_a')
      .related('group_b')
      .related('parent_group')
      .related('child_group')
      .related('from_group')
      .related('to_group')
      .related('created_by')
      .related('grants', grantsQuery =>
        grantsQuery
          .related('holder_group')
          .related('scope_group')
          .related('initiator_group')
          .orderBy('right_key', 'asc')
      )
      .related('membership_rule', membershipRuleQuery =>
        membershipRuleQuery
          .related('member_source_group')
          .related('member_target_group')
          .related('required_source_role')
          .related('origins', originQuery => originQuery.related('eligible_origin_group'))
      )
      .orderBy('updated_at', 'desc')
  ),

  groupConnectionById: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyGroupConnectionAccess(zql.group_connection, userID)
        .where('id', id)
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
        .related('from_group')
        .related('to_group')
        .related('created_by')
        .related('grants', grantsQuery =>
          grantsQuery
            .related('holder_group')
            .related('scope_group')
            .related('initiator_group')
            .orderBy('right_key', 'asc')
        )
        .related('membership_rule', membershipRuleQuery =>
          membershipRuleQuery
            .related('member_source_group')
            .related('member_target_group')
            .related('required_source_role')
            .related('origins', originQuery => originQuery.related('eligible_origin_group'))
        )
        .one()
  ),

  hierarchyPathsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_hierarchy_path
        .where('status', 'active')
        .where(({ cmp, or }) =>
          or(cmp('ancestor_group_id', '=', groupId), cmp('descendant_group_id', '=', groupId))
        )
        .where(({ or, exists }: any) =>
          or(
            exists('ancestor_group', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('descendant_group', (group: any) => applyGroupQueryAccess(group, userID))
          )
        )
        .related('ancestor_group')
        .related('descendant_group')
        .related('direct_child_group')
        .related('base_group')
        .related('connection')
        .orderBy('depth', 'asc')
  ),

  effectiveRightsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_effective_right
        .where('status', 'active')
        .where(({ cmp, or }) =>
          or(cmp('holder_group_id', '=', groupId), cmp('scope_group_id', '=', groupId))
        )
        .where(({ or, exists }: any) =>
          or(
            exists('holder_group', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('scope_group', (group: any) => applyGroupQueryAccess(group, userID))
          )
        )
        .related('holder_group')
        .related('scope_group')
        .related('source_connection')
        .related('source_grant')
        .orderBy('right_key', 'asc')
  ),

  membershipExclusivityLocksByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_membership_exclusivity_lock
        .where('status', 'active')
        .where(({ cmp, or }) =>
          or(cmp('hierarchy_group_id', '=', groupId), cmp('source_group_id', '=', groupId))
        )
        .where(({ or, exists }: any) =>
          or(
            exists('hierarchy_group', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('source_group', (group: any) => applyGroupQueryAccess(group, userID))
          )
        )
        .related('user')
        .related('hierarchy_group')
        .related('source_group')
        .related('group_membership')
        .orderBy('created_at', 'asc')
  ),

  siblingSourceLocksByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_sibling_source_lock
        .where('status', 'active')
        .where(({ cmp, or }) =>
          or(cmp('sibling_group_id', '=', groupId), cmp('source_group_id', '=', groupId))
        )
        .where(({ or, exists }: any) =>
          or(
            exists('sibling_group', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('source_group', (group: any) => applyGroupQueryAccess(group, userID))
          )
        )
        .related('user')
        .related('sibling_group')
        .related('source_group')
        .related('group_membership')
        .orderBy('created_at', 'asc')
  ),

  groupConnectionRequestsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupConnectionRequestAccess(zql.group_connection_request, userID)
        .where(({ cmp, or }) =>
          or(cmp('group_a_id', '=', groupId), cmp('group_b_id', '=', groupId))
        )
        .related('group_a')
        .related('group_b')
        .related('initiator_group')
        .related('active_connection')
        .related('grant_requests', q =>
          q
            .related('holder_group')
            .related('scope_group')
            .related('initiator_group')
            .orderBy('right_key', 'asc')
        )
        .related('membership_rule_requests', q =>
          q
            .related('required_source_role')
            .related('origins', oq => oq.related('eligible_origin_group'))
            .orderBy('updated_at', 'desc')
        )
        .orderBy('updated_at', 'desc')
  ),

  groupConnectionRequestPage: defineQuery(
    z.object({
      groupId: z.string(),
      direction: z.enum(['incoming', 'outgoing']),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: networkCursorSchema,
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({
      args: { groupId, direction: requestDirection, query, limit, start, dir },
      ctx: { userID },
    }) => {
      let q: any = applyGroupConnectionRequestAccess(zql.group_connection_request, userID)
        .where(({ cmp, or }: any) =>
          or(cmp('group_a_id', '=', groupId), cmp('group_b_id', '=', groupId))
        )
        .where('status', 'pending');
      q =
        requestDirection === 'outgoing'
          ? q.where('initiator_group_id', groupId)
          : q.where('initiator_group_id', '!=', groupId);
      const term = query.trim();
      if (term) {
        q = q.where(({ or, exists }: any) =>
          or(
            exists('group_a', (group: any) => group.where('name', 'ILIKE', `%${term}%`)),
            exists('group_b', (group: any) => group.where('name', 'ILIKE', `%${term}%`))
          )
        );
      }
      const order = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('updated_at', order).orderBy('id', order);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('group_a')
        .related('group_b')
        .related('initiator_group')
        .related('active_connection')
        .related('grant_requests', (grant: any) => grant.orderBy('right_key', 'asc'))
        .related('membership_rule_requests', (membership: any) =>
          membership.related('required_source_role').orderBy('updated_at', 'desc')
        )
        .limit(limit);
    }
  ),

  groupConnectionRequestsByPair: defineQuery(
    z.object({ groupAId: z.string(), groupBId: z.string() }),
    ({ args: { groupAId, groupBId }, ctx: { userID } }) =>
      applyGroupConnectionRequestAccess(zql.group_connection_request, userID)
        .where(({ and, cmp, or }) =>
          or(
            and(cmp('group_a_id', '=', groupAId), cmp('group_b_id', '=', groupBId)),
            and(cmp('group_a_id', '=', groupBId), cmp('group_b_id', '=', groupAId))
          )
        )
        .related('group_a')
        .related('group_b')
        .related('initiator_group')
        .related('active_connection')
        .related('grant_requests', q =>
          q
            .related('holder_group')
            .related('scope_group')
            .related('initiator_group')
            .orderBy('right_key', 'asc')
        )
        .related('membership_rule_requests', q =>
          q
            .related('required_source_role')
            .related('origins', oq => oq.related('eligible_origin_group'))
            .orderBy('updated_at', 'desc')
        )
        .orderBy('updated_at', 'desc')
  ),

  groupConnectionRequestById: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyGroupConnectionRequestAccess(zql.group_connection_request, userID)
        .where('id', id)
        .related('group_a')
        .related('group_b')
        .related('initiator_group')
        .related('active_connection')
        .related('grant_requests', q =>
          q
            .related('holder_group')
            .related('scope_group')
            .related('initiator_group')
            .orderBy('right_key', 'asc')
        )
        .related('membership_rule_requests', q =>
          q
            .related('required_source_role')
            .related('origins', oq => oq.related('eligible_origin_group'))
            .orderBy('updated_at', 'desc')
        )
        .one()
  ),

  // ── Workflow queries ──────────────────────────────────────────────

  workflowsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyWorkflowAccess(zql.group_workflow, userID)
        .where('group_id', groupId)
        .related('steps', q =>
          q.related('group').related('target_workflow').orderBy('order_index', 'asc')
        )
        .related('start_group')
        .related('approvals', q =>
          q.related('group').related('requested_by_group').orderBy('created_at', 'asc')
        )
        .related('group')
        .related('created_by')
        .orderBy('created_at', 'desc')
  ),

  workflowById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyWorkflowAccess(zql.group_workflow, userID)
      .where('id', id)
      .related('steps', q =>
        q.related('group').related('target_workflow').orderBy('order_index', 'asc')
      )
      .related('start_group')
      .related('approvals', q =>
        q.related('group').related('requested_by_group').orderBy('created_at', 'asc')
      )
      .related('group')
      .related('created_by')
      .one()
  ),

  allWorkflows: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyWorkflowAccess(zql.group_workflow, userID)
      .related('steps', q =>
        q.related('group').related('target_workflow').orderBy('order_index', 'asc')
      )
      .related('start_group')
      .related('approvals', q =>
        q.related('group').related('requested_by_group').orderBy('created_at', 'asc')
      )
      .related('group')
      .related('created_by')
      .orderBy('created_at', 'desc')
  ),

  workflowApprovalsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyWorkflowApprovalAccess(zql.group_workflow_approval, userID)
        .where('group_id', groupId)
        .related('group')
        .related('requested_by_group')
        .related('workflow', q =>
          q
            .related('group')
            .related('start_group')
            .related('created_by')
            .related('approvals', aq =>
              aq.related('group').related('requested_by_group').orderBy('created_at', 'asc')
            )
            .related('steps', sq =>
              sq.related('group').related('target_workflow').orderBy('order_index', 'asc')
            )
        )
        .orderBy('updated_at', 'desc')
  ),
};

// ── Row types ─────────────────────────────────────────────────────
export type GroupConnectionWithRelationsRow = NonNullable<
  QueryRowType<typeof networkQueries.groupConnectionById>
>;
export type GroupConnectionListRow = QueryRowType<typeof networkQueries.groupConnectionsByGroup>;
export type GroupConnectionPairRow = QueryRowType<typeof networkQueries.groupConnectionsByPair>;
export type WikiNetworkRow = QueryRowType<typeof networkQueries.wikiNetwork>;
export type GroupHierarchyPathRow = QueryRowType<typeof networkQueries.hierarchyPathsByGroup>;
export type GroupEffectiveRightRow = QueryRowType<typeof networkQueries.effectiveRightsByGroup>;
export type GroupMembershipExclusivityLockRow = QueryRowType<
  typeof networkQueries.membershipExclusivityLocksByGroup
>;
export type GroupSiblingSourceLockRow = QueryRowType<
  typeof networkQueries.siblingSourceLocksByGroup
>;
export type GroupConnectionRequestListRow = QueryRowType<
  typeof networkQueries.groupConnectionRequestsByGroup
>;
export type GroupConnectionRequestPairRow = QueryRowType<
  typeof networkQueries.groupConnectionRequestsByPair
>;
export type WorkflowWithStepsRow = NonNullable<QueryRowType<typeof networkQueries.workflowById>>;
export type WorkflowStepRow = WorkflowWithStepsRow['steps'][number];
export type WorkflowApprovalByGroupRow = QueryRowType<
  typeof networkQueries.workflowApprovalsByGroup
>;

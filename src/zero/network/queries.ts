import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { applyGroupQueryAccess } from '../rbac/query-access';
import { zql } from '../schema';

function applyGroupConnectionAccess<T>(q: T, userID: string | undefined | null): T {
  return (q as any).where(({ or, exists }: any) =>
    or(
      exists('group_a', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('group_b', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('parent_group', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('child_group', (group: any) => applyGroupQueryAccess(group, userID))
    )
  ) as T;
}

function applyGroupConnectionRequestAccess<T>(q: T, userID: string | undefined | null): T {
  return (q as any).where(({ or, exists }: any) =>
    or(
      exists('group_a', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('group_b', (group: any) => applyGroupQueryAccess(group, userID)),
      exists('initiator_group', (group: any) => applyGroupQueryAccess(group, userID))
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
  groupConnectionsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyGroupConnectionAccess(zql.group_connection, userID)
        .where(({ cmp, or }) =>
          or(cmp('group_a_id', '=', groupId), cmp('group_b_id', '=', groupId))
        )
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
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
            and(cmp('group_a_id', '=', groupBId), cmp('group_b_id', '=', groupAId))
          )
        )
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
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

import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

export const networkQueries = {
  networkLinksByGroup: defineQuery(z.object({ groupId: z.string() }), ({ args: { groupId } }) =>
    zql.network_link
      .where(({ cmp, or }) =>
        or(cmp('source_group_id', '=', groupId), cmp('target_group_id', '=', groupId))
      )
      .related('source_group')
      .related('target_group')
      .related('created_by')
      .related('rights', rightsQuery =>
        rightsQuery.related('initiator_group').orderBy('right_key', 'asc')
      )
      .related('membership_rule', membershipRuleQuery => membershipRuleQuery.related('role'))
      .orderBy('updated_at', 'desc')
  ),

  networkLinksByPair: defineQuery(
    z.object({ groupAId: z.string(), groupBId: z.string() }),
    ({ args: { groupAId, groupBId } }) =>
      zql.network_link
        .where(({ and, cmp, or }) =>
          or(
            and(cmp('source_group_id', '=', groupAId), cmp('target_group_id', '=', groupBId)),
            and(cmp('source_group_id', '=', groupBId), cmp('target_group_id', '=', groupAId))
          )
        )
        .related('source_group')
        .related('target_group')
        .related('created_by')
        .related('rights', rightsQuery =>
          rightsQuery.related('initiator_group').orderBy('right_key', 'asc')
        )
        .related('membership_rule', membershipRuleQuery => membershipRuleQuery.related('role'))
        .orderBy('updated_at', 'desc')
  ),

  allNetworkLinks: defineQuery(z.object({}), () =>
    zql.network_link
      .related('source_group')
      .related('target_group')
      .related('created_by')
      .related('rights', rightsQuery =>
        rightsQuery.related('initiator_group').orderBy('right_key', 'asc')
      )
      .related('membership_rule', membershipRuleQuery => membershipRuleQuery.related('role'))
      .orderBy('updated_at', 'desc')
  ),

  networkLinkById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.network_link
      .where('id', id)
      .related('source_group')
      .related('target_group')
      .related('created_by')
      .related('rights', rightsQuery =>
        rightsQuery.related('initiator_group').orderBy('right_key', 'asc')
      )
      .related('membership_rule', membershipRuleQuery => membershipRuleQuery.related('role'))
      .one()
  ),

  networkLinkChangeRequestsByGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId } }) =>
      zql.network_link_change_request
        .where(({ cmp, or }) =>
          or(cmp('source_group_id', '=', groupId), cmp('target_group_id', '=', groupId))
        )
        .related('source_group')
        .related('target_group')
        .related('initiator_group')
        .related('desired_role')
        .related('active_network_link')
        .orderBy('updated_at', 'desc')
  ),

  networkLinkChangeRequestsByPair: defineQuery(
    z.object({ groupAId: z.string(), groupBId: z.string() }),
    ({ args: { groupAId, groupBId } }) =>
      zql.network_link_change_request
        .where(({ and, cmp, or }) =>
          or(
            and(cmp('source_group_id', '=', groupAId), cmp('target_group_id', '=', groupBId)),
            and(cmp('source_group_id', '=', groupBId), cmp('target_group_id', '=', groupAId))
          )
        )
        .related('source_group')
        .related('target_group')
        .related('initiator_group')
        .related('desired_role')
        .related('active_network_link')
        .orderBy('updated_at', 'desc')
  ),

  networkLinkChangeRequestById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.network_link_change_request
      .where('id', id)
      .related('source_group')
      .related('target_group')
      .related('initiator_group')
      .related('desired_role')
      .related('active_network_link')
      .one()
  ),

  // ── Workflow queries ──────────────────────────────────────────────

  workflowsByGroup: defineQuery(z.object({ groupId: z.string() }), ({ args: { groupId } }) =>
    zql.group_workflow
      .where('group_id', groupId)
      .related('steps', q =>
        q.related('group').related('target_workflow').orderBy('order_index', 'asc')
      )
      .related('group')
      .related('created_by')
      .orderBy('created_at', 'desc')
  ),

  workflowById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.group_workflow
      .where('id', id)
      .related('steps', q =>
        q.related('group').related('target_workflow').orderBy('order_index', 'asc')
      )
      .related('group')
      .related('created_by')
      .one()
  ),

  allWorkflows: defineQuery(z.object({}), () =>
    zql.group_workflow
      .related('steps', q =>
        q.related('group').related('target_workflow').orderBy('order_index', 'asc')
      )
      .related('group')
      .orderBy('created_at', 'desc')
  ),
};

// ── Row types ─────────────────────────────────────────────────────
export type NetworkLinkWithRelationsRow = NonNullable<
  QueryRowType<typeof networkQueries.networkLinkById>
>;
export type NetworkLinkListRow = QueryRowType<typeof networkQueries.networkLinksByGroup>;
export type NetworkLinkPairRow = QueryRowType<typeof networkQueries.networkLinksByPair>;
export type NetworkLinkChangeRequestListRow = QueryRowType<
  typeof networkQueries.networkLinkChangeRequestsByGroup
>;
export type NetworkLinkChangeRequestPairRow = QueryRowType<
  typeof networkQueries.networkLinkChangeRequestsByPair
>;
export type WorkflowWithStepsRow = NonNullable<QueryRowType<typeof networkQueries.workflowById>>;
export type WorkflowStepRow = WorkflowWithStepsRow['steps'][number];

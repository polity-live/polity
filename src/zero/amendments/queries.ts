import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import type { NormalizedGroupRelationship } from '@/features/network/types/network.types';

export const amendmentQueries = {
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.amendment.where('id', id).one()
  ),

  // Full amendment with all related entities for detail views
  byIdWithRelations: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.amendment
      .where('id', id)
      .related('created_by')
      .related('group')
      .related('collaborators', q => q.related('user'))
      .related('change_requests', q => q.related('user').related('votes'))
      .related('threads', q => q.related('user').related('comments'))
      .one()
  ),

  // Full amendment for wiki view (all relations)
  byIdFull: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.amendment
      .where('id', id)
      .related('collaborators', q => q.related('user'))
      .related('amendment_hashtags', q => q.related('hashtag'))
      .related('support_votes', q => q.related('user'))
      .related('vote_entries', q => q.related('choices'))
      .related('change_requests')
      .related('support_confirmations', q =>
        q.related('group').related('event').related('process_task')
      )
      .related('group')
      .related('paths', q => q.related('segments'))
      .related('current_process_run', q =>
        q
          .related('selected_source_group')
          .related('selected_target_group')
          .related('selected_target_workflow')
          .related('active_branch')
          .related('tasks', tq => tq.related('group').related('target_group').related('event'))
      )
      .related('process_runs', q =>
        q
          .related('selected_source_group')
          .related('selected_target_group')
          .related('selected_target_workflow')
          .related('active_branch')
          .related('tasks', tq => tq.related('group').related('target_group').related('event'))
      )
      .related('documents')
      .related('document', q => q.related('collaborators', cq => cq.related('user')))
      .related('clone_source')
      .one()
  ),

  // Amendment with process/path data
  byIdWithProcessData: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.amendment
      .where('id', id)
      .related('group')
      .related('event')
      .related('agenda_items')
      .related('vote_entries')
      .related('current_process_run', q =>
        q
          .related('root_workflow')
          .related('selected_source_group')
          .related('selected_target_group')
          .related('selected_target_workflow')
          .related('active_branch')
          .related('terminal_step_run', sq =>
            sq
              .related('workflow')
              .related('workflow_step')
              .related('source_group')
              .related('target_group')
              .related('event')
              .related('agenda_item')
              .related('vote')
          )
          .related('branches', bq =>
            bq
              .related('parent_branch')
              .related('merged_into_branch')
              .related('document_version')
              .related('step_runs', sq =>
                sq
                  .related('workflow')
                  .related('workflow_step')
                  .related('source_group')
                  .related('target_group')
                  .related('event')
                  .related('agenda_item')
                  .related('vote')
                  .related('support_confirmation')
                  .orderBy('order_index', 'asc')
              )
              .related('tasks', tq =>
                tq
                  .related('group')
                  .related('target_group')
                  .related('event')
                  .related('agenda_item')
                  .related('support_confirmation')
                  .orderBy('due_at', 'asc')
              )
              .orderBy('created_at', 'asc')
          )
          .related('step_runs', sq =>
            sq
              .related('branch')
              .related('workflow')
              .related('workflow_step')
              .related('source_group')
              .related('target_group')
              .related('event')
              .related('agenda_item')
              .related('vote')
              .related('support_confirmation')
              .orderBy('order_index', 'asc')
          )
          .related('tasks', tq =>
            tq
              .related('branch')
              .related('step_run')
              .related('group')
              .related('target_group')
              .related('event')
              .related('agenda_item')
              .related('support_confirmation')
              .orderBy('due_at', 'asc')
          )
      )
      .related('process_runs', q =>
        q
          .related('selected_source_group')
          .related('selected_target_group')
          .related('selected_target_workflow')
          .related('active_branch')
          .related('branches', bq =>
            bq
              .related('step_runs', sq =>
                sq
                  .related('event')
                  .related('vote')
                  .related('agenda_item')
                  .orderBy('order_index', 'asc')
              )
              .orderBy('created_at', 'asc')
          )
          .related('tasks', tq => tq.related('group').related('target_group').related('event'))
          .orderBy('created_at', 'desc')
      )
      .related('support_confirmations', q =>
        q.related('group').related('event').related('process_task')
      )
      .related('paths', q => q.related('segments', sq => sq.related('group').related('event')))
      .one()
  ),

  // Amendment with document + collaborators for editor
  byIdWithDocsAndCollabs: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.amendment
      .where('id', id)
      .related('document', q => q.related('collaborators', cq => cq.related('user')))
      .related('collaborators', q => q.related('user'))
      .one()
  ),

  // Amendment with group, event, paths+segments for path visualization
  byIdWithPathViz: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.amendment
      .where('id', id)
      .related('group')
      .related('event')
      .related('paths', q => q.related('segments'))
      .one()
  ),

  byGroup: defineQuery(z.object({ group_id: z.string() }), ({ args: { group_id } }) =>
    zql.amendment.where('group_id', group_id).orderBy('created_at', 'desc')
  ),

  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.amendment.where('created_by_id', userID).orderBy('created_at', 'desc')
  ),

  collaborators: defineQuery(z.object({ amendment_id: z.string() }), ({ args: { amendment_id } }) =>
    zql.amendment_collaborator
      .where('amendment_id', amendment_id)
      .related('user')
      .orderBy('created_at', 'desc')
  ),

  // Current user's collaboration on a specific amendment
  userCollaboration: defineQuery(
    z.object({ amendment_id: z.string(), user_id: z.string() }),
    ({ args: { amendment_id, user_id } }) =>
      zql.amendment_collaborator.where('amendment_id', amendment_id).where('user_id', user_id)
  ),

  changeRequests: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id } }) =>
      zql.change_request.where('amendment_id', amendment_id).orderBy('created_at', 'desc')
  ),

  // Change requests with votes and user for voting UI
  changeRequestsWithVotes: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id } }) =>
      zql.change_request
        .where('amendment_id', amendment_id)
        .related('votes', q => q.related('user'))
        .orderBy('created_at', 'desc')
  ),

  paths: defineQuery(z.object({ amendment_id: z.string() }), ({ args: { amendment_id } }) =>
    zql.amendment_path.where('amendment_id', amendment_id).orderBy('created_at', 'desc')
  ),

  // Support confirmations for a group
  supportConfirmations: defineQuery(
    z.object({ group_id: z.string(), status: z.string() }),
    ({ args: { group_id, status } }) =>
      zql.support_confirmation
        .where('group_id', group_id)
        .where('status', status)
        .related('amendment', q => q.related('documents').related('current_process_run'))
        .related('process_run')
        .related('process_step_run')
        .related('process_task')
  ),

  // Support confirmations by user (pending)
  supportConfirmationsByUser: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id } }) =>
      zql.support_confirmation
        .where('confirmed_by_id', user_id)
        .where('status', 'pending')
        .related('amendment')
        .related('process_run')
        .related('process_task')
  ),

  processRunsByAmendment: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id } }) =>
      zql.amendment_process_run
        .where('amendment_id', amendment_id)
        .related('root_workflow')
        .related('selected_source_group')
        .related('selected_target_group')
        .related('selected_target_workflow')
        .related('active_branch')
        .related('branches', bq =>
          bq
            .related('document_version')
            .related('step_runs', sq =>
              sq
                .related('workflow')
                .related('workflow_step')
                .related('source_group')
                .related('target_group')
                .related('event')
                .related('agenda_item')
                .related('vote')
                .orderBy('order_index', 'asc')
            )
            .orderBy('created_at', 'asc')
        )
        .related('tasks', tq =>
          tq.related('group').related('target_group').related('event').orderBy('due_at', 'asc')
        )
        .orderBy('created_at', 'desc')
  ),

  processRunById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.amendment_process_run
      .where('id', id)
      .related('amendment')
      .related('root_workflow')
      .related('selected_source_group')
      .related('selected_target_group')
      .related('selected_target_workflow')
      .related('active_branch')
      .related('terminal_step_run')
      .related('branches', bq =>
        bq
          .related('document_version')
          .related('step_runs', sq =>
            sq
              .related('workflow')
              .related('workflow_step')
              .related('source_group')
              .related('target_group')
              .related('event')
              .related('agenda_item')
              .related('vote')
              .orderBy('order_index', 'asc')
          )
          .related('tasks', tq =>
            tq.related('group').related('target_group').related('event').orderBy('due_at', 'asc')
          )
          .orderBy('created_at', 'asc')
      )
      .related('tasks', tq =>
        tq
          .related('branch')
          .related('step_run')
          .related('group')
          .related('target_group')
          .related('event')
          .related('agenda_item')
          .related('support_confirmation')
          .orderBy('due_at', 'asc')
      )
      .one()
  ),

  openProcessTasksByGroup: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id } }) =>
      zql.process_task
        .where('group_id', group_id)
        .where('status', 'open')
        .related('process_run', q => q.related('amendment'))
        .related('branch')
        .related('step_run', sq => sq.related('event').related('agenda_item').related('vote'))
        .related('target_group')
        .related('event')
        .related('agenda_item')
        .related('support_confirmation', sq => sq.related('amendment'))
        .orderBy('due_at', 'asc')
  ),

  // Subscribers for an amendment
  subscribers: defineQuery(z.object({ amendment_id: z.string() }), ({ args: { amendment_id } }) =>
    zql.subscriber
      .where('amendment_id', amendment_id)
      .related('subscriber_user')
      .related('amendment')
  ),

  // Clones of an amendment
  clonesBySource: defineQuery(z.object({ source_id: z.string() }), ({ args: { source_id } }) =>
    zql.amendment.where('clone_source_id', source_id)
  ),

  // Threads with deep relations for discussion views
  threads: defineQuery(z.object({ amendment_id: z.string() }), ({ args: { amendment_id } }) =>
    zql.thread
      .where('amendment_id', amendment_id)
      .related('user')
      .related('votes', q => q.related('user'))
      .related('comments', q =>
        q
          .related('user')
          .related('votes', vq => vq.related('user'))
          .related('parent')
      )
  ),

  // Documents by amendment
  documentsByAmendment: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id } }) => zql.document.where('amendment_id', amendment_id)
  ),

  // Single document by id
  documentById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.document.where('id', id).one()
  ),

  // Roles for amendment collaborators
  rolesByAmendment: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id } }) =>
      zql.role
        .where('amendment_id', amendment_id)
        .where('scope', 'amendment')
        .related('action_rights')
  ),

  // Document versions by document
  documentVersionsByDocument: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id } }) =>
      zql.document_version.where('document_id', document_id).related('author')
  ),

  // Cross-domain: All groups
  allGroups: defineQuery(z.object({}), () => zql.group),

  // Cross-domain: Canonical network links with related groups
  allGroupRelationships: defineQuery(z.object({}), () =>
    zql.network_link
      .related('source_group')
      .related('target_group')
      .related('created_by')
      .related('rights', rightsQuery =>
        rightsQuery.related('initiator_group').orderBy('right_key', 'asc')
      )
      .related('membership_rule', membershipRuleQuery => membershipRuleQuery.related('role'))
  ),

  // Cross-domain: All group memberships with user and group
  allGroupMemberships: defineQuery(z.object({}), () =>
    zql.group_membership.related('group').related('user')
  ),

  // Cross-domain: User group memberships
  userGroupMemberships: defineQuery(z.object({ user_id: z.string() }), ({ args: { user_id } }) =>
    zql.group_membership.where('user_id', user_id).related('user').related('group')
  ),

  // Cross-domain: All events with group
  allEvents: defineQuery(z.object({}), () => zql.event.related('group')),

  // Cross-domain: Events by group with group
  eventsByGroup: defineQuery(z.object({ group_id: z.string() }), ({ args: { group_id } }) =>
    zql.event.where('group_id', group_id).related('group')
  ),

  // Cross-domain: All users
  allUsers: defineQuery(z.object({}), () => zql.user),

  // Cross-domain: Users by IDs
  usersByIds: defineQuery(z.object({ ids: z.array(z.string()) }), ({ args: { ids } }) =>
    ids.length > 0 ? zql.user.where('id', 'IN', ids) : zql.user.where('id', '__none__')
  ),

  // Cross-domain: User by ID
  userById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.user.where('id', id).limit(1)
  ),

  collaboratorsByUser: defineQuery(z.object({ user_id: z.string() }), ({ args: { user_id } }) =>
    zql.amendment_collaborator
      .where('user_id', user_id)
      .related('amendment', q => q.related('created_by'))
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type AmendmentRow = QueryRowType<typeof amendmentQueries.byId>;
export type AmendmentWithRelationsRow = QueryRowType<typeof amendmentQueries.byIdWithRelations>;
export type AmendmentFullRow = QueryRowType<typeof amendmentQueries.byIdFull>;
export type AmendmentWithProcessDataRow = QueryRowType<typeof amendmentQueries.byIdWithProcessData>;
export type AmendmentWithDocsAndCollabsRow = QueryRowType<
  typeof amendmentQueries.byIdWithDocsAndCollabs
>;
export type AmendmentCollaboratorRow = QueryRowType<typeof amendmentQueries.collaborators>;
export type AmendmentThreadRow = QueryRowType<typeof amendmentQueries.threads>;
export type AmendmentRoleRow = QueryRowType<typeof amendmentQueries.rolesByAmendment>;
export type ChangeRequestRow = QueryRowType<typeof amendmentQueries.changeRequests>;
export type ChangeRequestWithVotesRow = QueryRowType<
  typeof amendmentQueries.changeRequestsWithVotes
>;
export type DocumentVersionRow = QueryRowType<typeof amendmentQueries.documentVersionsByDocument>;
export type SupportConfirmationRow = QueryRowType<typeof amendmentQueries.supportConfirmations>;
export type AmendmentCollaboratorsByUserRow = QueryRowType<
  typeof amendmentQueries.collaboratorsByUser
>;
export type AmendmentProcessRunRow = QueryRowType<typeof amendmentQueries.processRunsByAmendment>;
export type ProcessTaskByGroupRow = QueryRowType<typeof amendmentQueries.openProcessTasksByGroup>;

// Cross-domain network Row types (used by amendmentPathHelpers)
export type NetworkGroupRow = QueryRowType<typeof amendmentQueries.allGroups>;
export type NetworkGroupLinkRow = QueryRowType<typeof amendmentQueries.allGroupRelationships>;
export type NetworkGroupRelationshipRow = NormalizedGroupRelationship;
export type NetworkGroupMembershipRow = QueryRowType<typeof amendmentQueries.allGroupMemberships>;
export type NetworkEventRow = QueryRowType<typeof amendmentQueries.allEvents>;

/** Single comment from the threads query (element of AmendmentThreadRow['comments']). */
export type AmendmentCommentRow = AmendmentThreadRow['comments'][number];

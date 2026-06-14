import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAgendaItemQueryAccess,
  applyDocumentQueryAccess,
  applyEventQueryAccess,
  applyGroupQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';
import type { NormalizedGroupRelationship } from '@/features/network/types/network.types';

function applyAmendmentAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('created_by_id', userID),
      exists('collaborators', (collaborator: any) => collaborator.where('user_id', userID)),
      exists('group', (group: any) =>
        group.whereExists('memberships', (membership: any) => membership.where('user_id', userID))
      ),
      exists('event', (event: any) =>
        event.whereExists('participants', (participant: any) =>
          participant.where('user_id', userID)
        )
      )
    )
  ) as T;
}

function applyAmendmentManagerAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('created_by_id', userID),
      exists('collaborators', (collaborator: any) =>
        collaborator
          .where('user_id', userID)
          .whereExists('role', (role: any) =>
            role.whereExists('action_rights', (right: any) =>
              right.where('resource', 'amendments').where('action', 'manage')
            )
          )
      )
    )
  ) as T;
}

function applyAmendmentUserPrivateAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('amendment', (amendment: any) => applyAmendmentManagerAccess(amendment, userID))
    )
  ) as T;
}

function applyChangeRequestVotePrivateAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('change_request', (changeRequest: any) =>
        changeRequest.whereExists('amendment', (amendment: any) =>
          applyAmendmentManagerAccess(amendment, userID)
        )
      )
    )
  ) as T;
}

function applyAmendmentThreadVotePrivateAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('thread', (thread: any) =>
        thread.whereExists('amendment', (amendment: any) =>
          applyAmendmentManagerAccess(amendment, userID)
        )
      )
    )
  ) as T;
}

function applyAmendmentCommentVotePrivateAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('comment', (comment: any) =>
        comment.whereExists('thread', (thread: any) =>
          thread.whereExists('amendment', (amendment: any) =>
            applyAmendmentManagerAccess(amendment, userID)
          )
        )
      )
    )
  ) as T;
}

export const amendmentQueries = {
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyAmendmentAccess(zql.amendment.where('id', id), userID).one()
  ),

  // Full amendment with all related entities for detail views
  byIdWithRelations: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyAmendmentAccess(zql.amendment.where('id', id), userID)
        .related('created_by')
        .related('group')
        .related('collaborators', q => q.related('user'))
        .related('change_requests', q =>
          q.related('user').related('votes', vote => vote.where('user_id', userID ?? '__anon__'))
        )
        .related('threads', q => q.related('user').related('comments'))
        .one()
  ),

  // Full amendment for wiki view (all relations)
  byIdFull: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyAmendmentAccess(zql.amendment.where('id', id), userID)
      .related('collaborators', q => q.related('user'))
      .related('amendment_hashtags', q => q.related('hashtag'))
      .related('support_votes', q => applyAmendmentUserPrivateAccess(q, userID).related('user'))
      .related('vote_entries', q => q.related('choices'))
      .related('change_requests')
      .related('support_confirmations', q =>
        q.related('group').related('event').related('process_task')
      )
      .related('group_decisions', q => q.related('group').orderBy('updated_at', 'desc'))
      .related('group')
      .related('paths', q => q.related('segments'))
      .related('current_process_run', q =>
        q
          .related('selected_source_group')
          .related('selected_target_group')
          .related('selected_target_workflow')
          .related('active_branch')
          .related('tasks', tq =>
            tq
              .related('group')
              .related('target_group')
              .related('event')
              .related('agenda_item', aq =>
                aq.related('votes', vq =>
                  applyVoteQueryAccess(vq, userID)
                    .related('choices', cq => cq.orderBy('order_index', 'asc'))
                    .related('offline_tallies', offlineTally =>
                      offlineTally.whereExists('vote', vote =>
                        applyVoteManagerQueryAccess(vote, userID)
                      )
                    )
                    .related('voters', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
                    .related('final_participations', participation =>
                      participation.whereExists('voter', voter =>
                        applyVoteVoterOrManagerQueryAccess(voter, userID)
                      )
                    )
                    .related('final_decisions', decision =>
                      decision.whereExists('vote', vote =>
                        applyVoteManagerQueryAccess(vote, userID)
                      )
                    )
                )
              )
              .orderBy('due_at', 'asc')
          )
      )
      .related('process_runs', q =>
        q
          .related('selected_source_group')
          .related('selected_target_group')
          .related('selected_target_workflow')
          .related('active_branch')
          .related('tasks', tq =>
            tq
              .related('group')
              .related('target_group')
              .related('event')
              .related('agenda_item', aq =>
                aq.related('votes', vq =>
                  applyVoteQueryAccess(vq, userID)
                    .related('choices', cq => cq.orderBy('order_index', 'asc'))
                    .related('offline_tallies', offlineTally =>
                      offlineTally.whereExists('vote', vote =>
                        applyVoteManagerQueryAccess(vote, userID)
                      )
                    )
                    .related('voters', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
                    .related('final_participations', participation =>
                      participation.whereExists('voter', voter =>
                        applyVoteVoterOrManagerQueryAccess(voter, userID)
                      )
                    )
                    .related('final_decisions', decision =>
                      decision.whereExists('vote', vote =>
                        applyVoteManagerQueryAccess(vote, userID)
                      )
                    )
                )
              )
              .orderBy('due_at', 'asc')
          )
      )
      .related('documents')
      .related('document', q => q.related('collaborators', cq => cq.related('user')))
      .related('clone_source')
      .one()
  ),

  // Amendment with process/path data
  byIdWithProcessData: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyAmendmentAccess(zql.amendment.where('id', id), userID)
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
                .related('workflow_step', wq => wq.related('target_workflow'))
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
                    .related('workflow_step', wq => wq.related('target_workflow'))
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
                .related('workflow_step', wq => wq.related('target_workflow'))
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
        .related('group_decisions', q =>
          q
            .related('group')
            .related('process_run')
            .related('process_branch')
            .related('process_step_run')
            .orderBy('updated_at', 'desc')
        )
        .related('paths', q => q.related('segments', sq => sq.related('group').related('event')))
        .one()
  ),

  // Amendment with document + collaborators for editor
  byIdWithDocsAndCollabs: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyAmendmentAccess(zql.amendment.where('id', id), userID)
        .related('document', q => q.related('collaborators', cq => cq.related('user')))
        .related('collaborators', q => q.related('user'))
        .one()
  ),

  // Amendment with group, event, paths+segments for path visualization
  byIdWithPathViz: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyAmendmentAccess(zql.amendment.where('id', id), userID)
      .related('group')
      .related('event')
      .related('paths', q => q.related('segments'))
      .one()
  ),

  byGroup: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyAmendmentAccess(zql.amendment.where('group_id', group_id), userID).orderBy(
        'created_at',
        'desc'
      )
  ),

  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.amendment.where('created_by_id', userID).orderBy('created_at', 'desc')
  ),

  collaborators: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.amendment_collaborator
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('user')
        .orderBy('created_at', 'desc')
  ),

  // Current user's collaboration on a specific amendment
  userCollaboration: defineQuery(
    z.object({ amendment_id: z.string(), user_id: z.string() }),
    ({ args: { amendment_id, user_id }, ctx: { userID } }) =>
      zql.amendment_collaborator
        .where('amendment_id', amendment_id)
        .where('user_id', user_id)
        .where('user_id', userID)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
  ),

  changeRequests: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.change_request
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .orderBy('created_at', 'desc')
  ),

  // Change requests with votes and user for voting UI
  changeRequestsWithVotes: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.change_request
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('votes', q => applyChangeRequestVotePrivateAccess(q, userID).related('user'))
        .orderBy('created_at', 'desc')
  ),

  paths: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.amendment_path
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .orderBy('created_at', 'desc')
  ),

  // Support confirmations for a group
  supportConfirmations: defineQuery(
    z.object({ group_id: z.string(), status: z.string() }),
    ({ args: { group_id, status }, ctx: { userID } }) =>
      zql.support_confirmation
        .where('group_id', group_id)
        .whereExists('group', group => applyGroupQueryAccess(group, userID))
        .where('status', status)
        .related('amendment', q => q.related('documents').related('current_process_run'))
        .related('process_run')
        .related('process_step_run')
        .related('process_task')
  ),

  // Support confirmations by user (pending)
  supportConfirmationsByUser: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.support_confirmation
        .where('confirmed_by_id', user_id)
        .where('confirmed_by_id', userID)
        .where('status', 'pending')
        .related('amendment')
        .related('process_run')
        .related('process_task')
  ),

  groupDecisionsByAmendment: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.amendment_group_decision
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('group')
        .related('process_run')
        .related('process_branch')
        .related('process_step_run')
        .orderBy('updated_at', 'desc')
  ),

  processRunsByAmendment: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.amendment_process_run
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
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
                .related('workflow_step', wq => wq.related('target_workflow'))
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

  processRunById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    zql.amendment_process_run
      .where('id', id)
      .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
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
              .related('workflow_step', wq => wq.related('target_workflow'))
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
    ({ args: { group_id }, ctx: { userID } }) =>
      zql.process_task
        .where('group_id', group_id)
        .whereExists('group', group => applyGroupQueryAccess(group, userID))
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

  agendaItemForwardingContext: defineQuery(
    z.object({ agenda_item_id: z.string() }),
    ({ args: { agenda_item_id }, ctx: { userID } }) =>
      zql.amendment_process_step_run
        .where('agenda_item_id', agenda_item_id)
        .whereExists('agenda_item', agendaItem => applyAgendaItemQueryAccess(agendaItem, userID))
        .orderBy('branch_id', 'asc')
        .orderBy('order_index', 'asc')
        .related('process_run', q =>
          q
            .related('amendment', aq => aq.related('document'))
            .related('active_branch')
            .related('step_runs', sq =>
              sq
                .related('workflow_step')
                .related('target_group')
                .related('event')
                .related('agenda_item')
                .related('vote')
                .related('tasks')
                .orderBy('order_index', 'asc')
            )
        )
        .related('branch', bq =>
          bq
            .related('document_version')
            .related('step_runs', sq =>
              sq
                .related('workflow_step')
                .related('target_group')
                .related('event')
                .related('agenda_item')
                .related('vote')
                .related('tasks')
                .orderBy('order_index', 'asc')
            )
        )
        .related('target_group')
        .related('workflow_step')
        .related('event')
        .related('agenda_item')
        .related('vote')
        .related('tasks')
  ),

  // Subscribers for an amendment
  subscribers: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.subscriber
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('subscriber_user')
        .related('amendment')
  ),

  // Clones of an amendment
  clonesBySource: defineQuery(
    z.object({ source_id: z.string() }),
    ({ args: { source_id }, ctx: { userID } }) =>
      applyAmendmentAccess(zql.amendment.where('clone_source_id', source_id), userID)
  ),

  // Threads with deep relations for discussion views
  threads: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.thread
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('user')
        .related('votes', q => applyAmendmentThreadVotePrivateAccess(q, userID).related('user'))
        .related('comments', q =>
          q
            .related('user')
            .related('votes', vq =>
              applyAmendmentCommentVotePrivateAccess(vq, userID).related('user')
            )
            .related('parent')
        )
  ),

  // Documents by amendment
  documentsByAmendment: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      applyDocumentQueryAccess(zql.document.where('amendment_id', amendment_id), userID)
  ),

  // Single document by id
  documentById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyDocumentQueryAccess(zql.document.where('id', id), userID).one()
  ),

  // Roles for amendment collaborators
  rolesByAmendment: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.role
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .where('scope', 'amendment')
        .related('action_rights')
  ),

  // Document versions by document
  documentVersionsByDocument: defineQuery(
    z.object({ document_id: z.string() }),
    ({ args: { document_id }, ctx: { userID } }) =>
      zql.document_version
        .where('document_id', document_id)
        .whereExists('document', document => applyDocumentQueryAccess(document, userID))
        .related('author')
  ),

  // Cross-domain: All groups
  allGroups: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyGroupQueryAccess(zql.group, userID)
  ),

  // Cross-domain: Explicit group connections with grants and membership
  allGroupRelationships: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.group_connection
      .where(({ or, exists }: any) =>
        or(
          exists('group_a', (group: any) => applyGroupQueryAccess(group, userID)),
          exists('group_b', (group: any) => applyGroupQueryAccess(group, userID)),
          exists('parent_group', (group: any) => applyGroupQueryAccess(group, userID)),
          exists('child_group', (group: any) => applyGroupQueryAccess(group, userID))
        )
      )
      .related('group_a')
      .related('group_b')
      .related('parent_group')
      .related('child_group')
      .related('created_by')
      .related('grants', grantQuery =>
        grantQuery
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
  ),

  // Cross-domain: All group memberships with user and group
  allGroupMemberships: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.group_membership
      .whereExists('group', group => applyGroupQueryAccess(group, userID))
      .related('group')
      .related('user')
      .related('membership_roles', q => q.related('role'))
  ),

  // Cross-domain: User group memberships
  userGroupMemberships: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.group_membership
        .where('user_id', user_id)
        .where('user_id', userID)
        .related('user')
        .related('group')
        .related('membership_roles', q => q.related('role'))
  ),

  // Cross-domain: All events with group
  allEvents: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyEventQueryAccess(zql.event, userID).related('group')
  ),

  // Cross-domain: Events by group with group
  eventsByGroup: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      applyEventQueryAccess(zql.event, userID).where('group_id', group_id).related('group')
  ),

  // Cross-domain: All users
  allUsers: defineQuery(z.object({}), ({ ctx: { userID } }) => {
    if (!userID || userID === 'anon') return zql.user.where('visibility', 'public');
    return zql.user.where(({ or, cmp }: any) =>
      or(cmp('visibility', 'IN', ['public', 'authenticated']), cmp('id', userID))
    );
  }),

  // Cross-domain: Users by IDs
  usersByIds: defineQuery(
    z.object({ ids: z.array(z.string()) }),
    ({ args: { ids }, ctx: { userID } }) => {
      const q = ids.length > 0 ? zql.user.where('id', 'IN', ids) : zql.user.where('id', '__none__');
      if (!userID || userID === 'anon') return q.where('visibility', 'public');
      return q.where(({ or, cmp }: any) =>
        or(cmp('visibility', 'IN', ['public', 'authenticated']), cmp('id', userID))
      );
    }
  ),

  // Cross-domain: User by ID
  userById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) => {
    const q = zql.user.where('id', id).limit(1);
    if (!userID || userID === 'anon') return q.where('visibility', 'public');
    return q.where(({ or, cmp }: any) =>
      or(cmp('visibility', 'IN', ['public', 'authenticated']), cmp('id', userID))
    );
  }),

  collaboratorsByUser: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.amendment_collaborator
        .where('user_id', user_id)
        .where('user_id', userID)
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
export type AmendmentGroupDecisionRow = QueryRowType<
  typeof amendmentQueries.groupDecisionsByAmendment
>;
export type AmendmentCollaboratorsByUserRow = QueryRowType<
  typeof amendmentQueries.collaboratorsByUser
>;
export type AmendmentProcessRunRow = QueryRowType<typeof amendmentQueries.processRunsByAmendment>;
export type ProcessTaskByGroupRow = QueryRowType<typeof amendmentQueries.openProcessTasksByGroup>;
export type AgendaItemForwardingContextRow = QueryRowType<
  typeof amendmentQueries.agendaItemForwardingContext
>;

// Cross-domain network Row types (used by amendmentPathHelpers)
export type NetworkGroupRow = QueryRowType<typeof amendmentQueries.allGroups>;
export type NetworkGroupLinkRow = QueryRowType<typeof amendmentQueries.allGroupRelationships>;
export type NetworkGroupRelationshipRow = NormalizedGroupRelationship;
export type NetworkGroupMembershipRow = QueryRowType<typeof amendmentQueries.allGroupMemberships>;
export type NetworkEventRow = QueryRowType<typeof amendmentQueries.allEvents>;

/** Single comment from the threads query (element of AmendmentThreadRow['comments']). */
export type AmendmentCommentRow = AmendmentThreadRow['comments'][number];

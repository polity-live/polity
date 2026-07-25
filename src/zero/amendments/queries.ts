import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAgendaItemQueryAccess,
  applyAmendmentQueryAccess,
  applyChangeRequestVisibilityAccess,
  applyDocumentQueryAccess,
  applyEventQueryAccess,
  applyGroupQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';
import type { NormalizedGroupRelationship } from '@/features/network/types/network.types';

const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ['active', 'collaborator', 'member', 'admin'];
const WIKI_ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ACTIVE_AMENDMENT_COLLABORATOR_STATUSES;
const NAVIGATION_ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ACTIVE_AMENDMENT_COLLABORATOR_STATUSES;
const discussionThreadStartSchema = z
  .object({
    id: z.string(),
    created_at: z.number().optional(),
    upvotes: z.number().optional(),
    downvotes: z.number().optional(),
  })
  .nullable();

function applyAmendmentAccess<T>(q: T, userID: string | undefined): T {
  return applyAmendmentQueryAccess(q, userID);
}

type GroupAmendmentDisplayStatus = 'accepted' | 'pending' | 'rejected' | 'withdrawn';

const GROUP_AMENDMENT_DISPLAY_STATUSES: Record<GroupAmendmentDisplayStatus, string[]> = {
  accepted: ['accepted', 'supported', 'approved', 'merged', 'completed'],
  rejected: ['rejected', 'declined'],
  withdrawn: ['withdrawn', 'cancelled'],
  pending: [
    'pending',
    'requested',
    'open',
    'active',
    'in_progress',
    'forward_confirmed',
    'previous_decision_outstanding',
    'tie',
  ],
};

function applyGroupAmendmentFilters({
  groupId,
  status,
  displayStatus,
  hashtag,
  query,
  userID,
}: {
  groupId: string;
  status?: string;
  displayStatus?: GroupAmendmentDisplayStatus;
  hashtag?: string;
  query: string;
  userID?: string;
}) {
  const stepRunForGroup = (stepRun: any) =>
    stepRun.whereExists('event', (event: any) => event.where('group_id', groupId));
  let q: any = applyAmendmentAccess(zql.amendment, userID).where(({ or, cmp, exists }: any) =>
    or(
      cmp('group_id', groupId),
      exists('group_decisions', (decision: any) => decision.where('group_id', groupId)),
      exists('event', (event: any) => event.where('group_id', groupId)),
      exists('current_process_run', (run: any) =>
        run.whereExists('branches', (branch: any) =>
          branch.whereExists('step_runs', stepRunForGroup)
        )
      )
    )
  );
  if (status) q = q.whereExists('current_process_run', (run: any) => run.where('status', status));
  if (displayStatus) {
    const statuses = GROUP_AMENDMENT_DISPLAY_STATUSES[displayStatus];
    q = q.where(({ or, exists }: any) =>
      or(
        exists('group_decisions', (decision: any) =>
          decision.where('group_id', groupId).where('status', 'IN', statuses)
        ),
        exists('current_process_run', (run: any) =>
          run.whereExists('branches', (branch: any) =>
            branch.whereExists('step_runs', (stepRun: any) =>
              stepRunForGroup(stepRun).where(({ or: stepOr, cmp }: any) =>
                stepOr(cmp('decision_status', 'IN', statuses), cmp('status', 'IN', statuses))
              )
            )
          )
        )
      )
    );
  }
  if (hashtag) {
    q = q.whereExists('amendment_hashtags', (link: any) =>
      link.whereExists('hashtag', (tag: any) => tag.where('tag', hashtag))
    );
  }
  const term = query.trim();
  if (term) {
    q = q.where(({ or, cmp }: any) =>
      or(cmp('title', 'ILIKE', `%${term}%`), cmp('reason', 'ILIKE', `%${term}%`))
    );
  }
  return q;
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
          .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
          .whereExists('role', (role: any) =>
            role.whereExists('action_rights', (right: any) =>
              right.where('resource', 'amendments').where('action', 'manage')
            )
          )
      )
    )
  ) as T;
}

function applyAmendmentCollaboratorRosterAccess<T>(q: T, userID: string | undefined): T {
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
        .related('collaborators', q =>
          applyAmendmentCollaboratorRosterAccess(q, userID)
            .related('user')
            .related('role', role => role.related('action_rights'))
        )
        .related('change_requests', q =>
          applyChangeRequestVisibilityAccess(q, userID)
            .related('user')
            .related('votes', vote => vote.where('user_id', userID ?? '__anon__'))
        )
        .related('current_process_run', q =>
          q.related('branches', bq => bq.orderBy('created_at', 'asc'))
        )
        .related('threads', q => q.related('user').related('comments'))
        .one()
  ),

  // Full amendment for wiki view (all relations)
  byIdFull: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyAmendmentAccess(zql.amendment.where('id', id), userID)
      .related('collaborators', q =>
        q.where('status', 'IN', WIKI_ACTIVE_AMENDMENT_COLLABORATOR_STATUSES).related('user')
      )
      .related('amendment_hashtags', q => q.related('hashtag'))
      .related('support_votes', q => applyAmendmentUserPrivateAccess(q, userID).related('user'))
      .related('vote_entries', q => q.related('choices'))
      .related('change_requests', q => applyChangeRequestVisibilityAccess(q, userID))
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
          .related('active_branch', bq => bq.related('document'))
          .related('branches', bq =>
            bq
              .related('document')
              .related('document_version')
              .related('change_requests', cq => applyChangeRequestVisibilityAccess(cq, userID))
              .related('step_runs', sq =>
                sq
                  .related('source_group')
                  .related('target_group')
                  .related('event')
                  .related('agenda_item')
                  .orderBy('order_index', 'asc')
              )
              .orderBy('created_at', 'asc')
          )
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
          .related('active_branch', bq => bq.related('document'))
          .related('branches', bq =>
            bq
              .related('document')
              .related('document_version')
              .related('change_requests', cq => applyChangeRequestVisibilityAccess(cq, userID))
              .related('step_runs', sq =>
                sq
                  .related('source_group')
                  .related('target_group')
                  .related('event')
                  .related('agenda_item')
                  .orderBy('order_index', 'asc')
              )
              .orderBy('created_at', 'asc')
          )
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
        .related('change_requests', q => applyChangeRequestVisibilityAccess(q, userID))
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
                .related('document')
                .related('document_version')
                .related('change_requests', cq => applyChangeRequestVisibilityAccess(cq, userID))
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
                .related('document')
                .related('document_version')
                .related('change_requests', cq => applyChangeRequestVisibilityAccess(cq, userID))
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
        .related('group', group =>
          group
            .related('memberships', membership =>
              membership
                .where('user_id', userID ?? '__anon__')
                .related('membership_roles', link =>
                  link.related('role', role => role.related('action_rights'))
                )
            )
            .related('guest_accesses', access =>
              access
                .where('user_id', userID ?? '__anon__')
                .related('guest_roles', link =>
                  link.related('role', role => role.related('action_rights'))
                )
            )
        )
        .related('document', q => q.related('collaborators', cq => cq.related('user')))
        .related('collaborators', q =>
          applyAmendmentCollaboratorRosterAccess(q, userID)
            .related('user')
            .related('role', role => role.related('action_rights'))
        )
        .related('change_requests', q =>
          applyChangeRequestVisibilityAccess(q, userID)
            .related('user')
            .related('votes', vote => vote.where('user_id', userID ?? '__anon__'))
        )
        .related('current_process_run', q =>
          q
            .related('active_branch', bq => bq.related('document'))
            .related('branches', bq =>
              bq
                .related('document', dq => dq.related('collaborators', cq => cq.related('user')))
                .related('document_version')
                .related('change_requests', cq =>
                  applyChangeRequestVisibilityAccess(cq, userID)
                    .related('user')
                    .related('votes', vote => vote.where('user_id', userID ?? '__anon__'))
                )
                .related('step_runs', sq =>
                  sq
                    .related('source_group')
                    .related('target_group')
                    .related('event')
                    .related('agenda_item')
                    .orderBy('order_index', 'asc')
                )
                .orderBy('created_at', 'asc')
            )
        )
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

  groupAmendmentPage: defineQuery(
    z.object({
      groupId: z.string(),
      status: z.string().optional(),
      displayStatus: z.enum(['accepted', 'pending', 'rejected', 'withdrawn']).optional(),
      statuses: z.array(z.string()).default([]),
      hashtag: z.string().optional(),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({
      args: { groupId, status, displayStatus, hashtag, query, limit, start, dir },
      ctx: { userID },
    }) => {
      let q: any = applyGroupAmendmentFilters({
        groupId,
        status,
        displayStatus,
        hashtag,
        query,
        userID,
      });
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('current_process_run', (run: any) =>
          run.related('branches', (branch: any) => branch.orderBy('created_at', 'asc'))
        )
        .related('group_decisions', (decision: any) => decision.where('group_id', groupId))
        .related('amendment_hashtags', (link: any) => link.related('hashtag'))
        .limit(limit);
    }
  ),

  groupAmendmentCountRows: defineQuery(
    z.object({
      groupId: z.string(),
      displayStatus: z.enum(['accepted', 'pending', 'rejected', 'withdrawn']),
      hashtag: z.string().optional(),
      query: z.string().default(''),
    }),
    ({ args: { groupId, displayStatus, hashtag, query }, ctx: { userID } }) =>
      applyGroupAmendmentFilters({
        groupId,
        displayStatus,
        hashtag,
        query,
        userID,
      })
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
  ),

  groupAmendmentById: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyAmendmentAccess(zql.amendment.where('id', id), userID)
        .related('current_process_run', q =>
          q.related('branches', branch => branch.orderBy('created_at', 'asc'))
        )
        .related('amendment_hashtags', q => q.related('hashtag'))
        .one()
  ),

  byUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.amendment.where('created_by_id', userID).orderBy('created_at', 'desc')
  ),

  collaborators: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      applyAmendmentCollaboratorRosterAccess(
        zql.amendment_collaborator.where('amendment_id', amendment_id),
        userID
      )
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('user')
        .related('role', role => role.related('action_rights'))
        .orderBy('created_at', 'desc')
  ),

  collaboratorPage: defineQuery(
    z.object({
      amendmentId: z.string(),
      status: z.string().optional(),
      statuses: z.array(z.string()).default([]),
      roleId: z.string().optional(),
      roleIds: z.array(z.string()).default([]),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({
      args: { amendmentId, status, statuses, roleId, roleIds, query, limit, start, dir },
      ctx: { userID },
    }) => {
      let q: any = applyAmendmentCollaboratorRosterAccess(zql.amendment_collaborator, userID)
        .where('amendment_id', amendmentId)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID));
      if (status) q = q.where('status', status);
      if ((statuses?.length ?? 0) > 0) q = q.where('status', 'IN', statuses);
      if (roleId) q = q.where('role_id', roleId);
      if ((roleIds?.length ?? 0) > 0) q = q.where('role_id', 'IN', roleIds);
      const term = query.trim();
      if (term)
        q = q.whereExists('user', (user: any) =>
          user.where(({ or, cmp }: any) =>
            or(
              cmp('first_name', 'ILIKE', `%${term}%`),
              cmp('last_name', 'ILIKE', `%${term}%`),
              cmp('handle', 'ILIKE', `%${term}%`)
            )
          )
        );
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('user')
        .related('role', (role: any) => role.related('action_rights'))
        .limit(limit);
    }
  ),

  collaborationPageByUser: defineQuery(
    z.object({
      userId: z.string(),
      status: z.string().optional(),
      statuses: z.array(z.string()).default([]),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { userId, status, statuses, query, limit, start, dir }, ctx: { userID } }) => {
      let q: any = zql.amendment_collaborator
        .where('user_id', userId)
        .where(({ or, cmp, exists }: any) =>
          or(
            cmp('user_id', userID ?? '__anon__'),
            exists('amendment', (amendment: any) => applyAmendmentAccess(amendment, userID))
          )
        );
      if (status) q = q.where('status', status);
      if ((statuses?.length ?? 0) > 0) q = q.where('status', 'IN', statuses);
      const term = query.trim();
      if (term)
        q = q.whereExists('amendment', (amendment: any) =>
          amendment.where(({ or, cmp }: any) =>
            or(cmp('title', 'ILIKE', `%${term}%`), cmp('reason', 'ILIKE', `%${term}%`))
          )
        );
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('role')
        .related('amendment', (amendment: any) =>
          amendment
            .related('group')
            .related('amendment_hashtags', (link: any) => link.related('hashtag'))
            .related('current_process_run', (run: any) => run.related('branches'))
        )
        .limit(limit);
    }
  ),

  collaboratorById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyAmendmentCollaboratorRosterAccess(zql.amendment_collaborator, userID)
      .where('id', id)
      .related('user')
      .related('role', role => role.related('action_rights'))
      .one()
  ),

  streetDesigns: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      zql.amendment_street_design
        .where('amendment_id', amendment_id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('created_by')
        .orderBy('updated_at', 'desc')
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
      applyChangeRequestVisibilityAccess(
        zql.change_request
          .where('amendment_id', amendment_id)
          .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID)),
        userID
      ).orderBy('created_at', 'desc')
  ),

  changeRequestPage: defineQuery(
    z.object({
      amendmentId: z.string(),
      branchId: z.string().optional(),
      status: z.string().optional(),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { amendmentId, branchId, status, limit, start, dir }, ctx: { userID } }) => {
      let q: any = applyChangeRequestVisibilityAccess(
        zql.change_request
          .where('amendment_id', amendmentId)
          .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID)),
        userID
      );
      if (branchId) q = q.where('process_branch_id', branchId);
      if (status) q = q.where('status', status);
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('user')
        .related('votes', (vote: any) =>
          applyChangeRequestVotePrivateAccess(vote, userID).related('user')
        )
        .limit(limit);
    }
  ),

  changeRequestById: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyChangeRequestVisibilityAccess(zql.change_request.where('id', id), userID)
        .related('user')
        .related('votes', vote => applyChangeRequestVotePrivateAccess(vote, userID).related('user'))
        .one()
  ),

  // Change requests with votes and user for voting UI
  changeRequestsWithVotes: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      applyChangeRequestVisibilityAccess(
        zql.change_request
          .where('amendment_id', amendment_id)
          .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID)),
        userID
      )
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
        .related('amendment', q =>
          q.related('document').related('documents').related('current_process_run')
        )
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
          .related('document')
          .related('document_version')
          .related('change_requests', cq => applyChangeRequestVisibilityAccess(cq, userID))
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

  processTasksByGroupForAssignments: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      zql.process_task
        .where('group_id', group_id)
        .whereExists('group', group => applyGroupQueryAccess(group, userID))
        .where('status', 'IN', ['open', 'scheduled', 'completed'])
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
            .related('document')
            .related('document_version')
            .related('change_requests', cq => applyChangeRequestVisibilityAccess(cq, userID))
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
      applyAmendmentAccess(zql.amendment.where('clone_source_id', source_id), userID).related(
        'current_process_run',
        q => q.related('branches', bq => bq.orderBy('created_at', 'asc'))
      )
  ),

  // Threads with deep relations for discussion views
  discussionThreadPage: defineQuery(
    z.object({
      amendmentId: z.string(),
      sort: z.enum(['votes', 'time']).default('votes'),
      limit: virtualPageLimitSchema,
      start: discussionThreadStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { amendmentId, sort, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      let q: any = zql.thread
        .where('amendment_id', amendmentId)
        .whereExists('amendment', (amendment: any) => applyAmendmentAccess(amendment, userID))
        .related('user')
        .related('votes', (vote: any) =>
          applyAmendmentThreadVotePrivateAccess(vote, userID).related('user')
        );

      q =
        sort === 'votes'
          ? q.orderBy('upvotes', direction).orderBy('downvotes', dir === 'forward' ? 'asc' : 'desc')
          : q.orderBy('created_at', direction);
      q = q.orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q.limit(limit);
    }
  ),

  discussionThreadById: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      zql.thread
        .where('id', id)
        .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        .related('user')
        .related('votes', vote =>
          applyAmendmentThreadVotePrivateAccess(vote, userID).related('user')
        )
        .one()
  ),

  discussionCommentPage: defineQuery(
    z.object({
      threadId: z.string(),
      parentId: z.string().nullable().default(null),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { threadId, parentId, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'backward' ? 'desc' : 'asc';
      let q: any = zql.comment
        .where('thread_id', threadId)
        .where('parent_id', 'IS', parentId as any)
        .whereExists('thread', (thread: any) =>
          thread.whereExists('amendment', (amendment: any) =>
            applyAmendmentAccess(amendment, userID)
          )
        )
        .orderBy('created_at', direction)
        .orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('user')
        .related('votes', (vote: any) =>
          applyAmendmentCommentVotePrivateAccess(vote, userID).related('user')
        )
        .limit(limit);
    }
  ),

  discussionCommentById: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      zql.comment
        .where('id', id)
        .whereExists('thread', thread =>
          thread.whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
        )
        .related('user')
        .related('votes', vote =>
          applyAmendmentCommentVotePrivateAccess(vote, userID).related('user')
        )
        .related('parent', parent =>
          parent.related('parent', ancestor => ancestor.related('parent'))
        )
        .one()
  ),

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
        .related('amendment', q =>
          q
            .related('created_by')
            .related('current_process_run', rq =>
              rq.related('branches', bq => bq.orderBy('created_at', 'asc'))
            )
        )
        .related('role')
  ),

  currentUserActiveCollaborationsWithAmendments: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.amendment_collaborator
      .where('user_id', userID)
      .where('status', 'IN', WIKI_ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
      .whereExists('amendment', amendment => applyAmendmentAccess(amendment, userID))
      .related('amendment', q =>
        q
          .related('created_by')
          .related('group')
          .related('event')
          .related('amendment_hashtags', hq => hq.related('hashtag'))
          .related('current_process_run', rq =>
            rq.related('branches', bq => bq.orderBy('created_at', 'asc'))
          )
      )
      .related('role', q => q.related('action_rights'))
  ),

  currentUserOpenNavigationAmendments: defineQuery(z.object({}), ({ ctx: { userID } }) => {
    if (!userID || userID === 'anon') {
      return zql.amendment.where('id', '__unauthorized__');
    }

    return zql.amendment
      .where(({ or, cmp, exists }: any) =>
        or(
          cmp('created_by_id', userID),
          exists('collaborators', (collaborator: any) =>
            collaborator
              .where('user_id', userID)
              .where('status', 'IN', NAVIGATION_ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
          )
        )
      )
      .related('group')
      .related('event')
      .related('current_process_run', q =>
        q
          .related('selected_target_group')
          .related('terminal_step_run')
          .related('branches', bq => bq.orderBy('created_at', 'asc'))
      )
      .related('group_decisions', q => q.related('group'));
  }),
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
export type AmendmentStreetDesignRow = QueryRowType<typeof amendmentQueries.streetDesigns>;
export type AmendmentThreadRow = QueryRowType<typeof amendmentQueries.threads>;
export type AmendmentRoleRow = QueryRowType<typeof amendmentQueries.rolesByAmendment>;
export type ChangeRequestRow = QueryRowType<typeof amendmentQueries.changeRequests>;
export type ChangeRequestWithVotesRow = QueryRowType<
  typeof amendmentQueries.changeRequestsWithVotes
>;
export type SupportConfirmationRow = QueryRowType<typeof amendmentQueries.supportConfirmations>;
export type AmendmentGroupDecisionRow = QueryRowType<
  typeof amendmentQueries.groupDecisionsByAmendment
>;
export type AmendmentCollaboratorsByUserRow = QueryRowType<
  typeof amendmentQueries.collaboratorsByUser
>;
export type AmendmentProcessRunRow = QueryRowType<typeof amendmentQueries.processRunsByAmendment>;
export type ProcessTaskByGroupRow = QueryRowType<typeof amendmentQueries.openProcessTasksByGroup>;
export type ProcessTaskAssignmentByGroupRow = QueryRowType<
  typeof amendmentQueries.processTasksByGroupForAssignments
>;
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

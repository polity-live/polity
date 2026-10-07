import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import {
  groupProjectsAccess,
  studioProjectCollaborativeAccess,
  studioProjectReadAccess,
} from './access';

const requireQueryUser = (userID: string | undefined | null) =>
  userID && userID !== 'anon' ? userID : '00000000-0000-0000-0000-000000000000';

function projects(actor: string | null) {
  return studioProjectReadAccess(zql.studio_project.where('document_schema_version', 5), actor);
}

function relatedProject<T>(project: T, actor: string | null): T {
  return studioProjectReadAccess((project as any).where('document_schema_version', 5), actor);
}

function collaborativeProject<T>(project: T, actor: string): T {
  return studioProjectCollaborativeAccess(
    (project as any).where('document_schema_version', 5),
    actor
  );
}

function canvasWorkspaces(actor: string, projectId: string) {
  return zql.canvas_proposal
    .where('project_id', projectId)
    .whereExists('project', (project: any) => collaborativeProject(project, actor))
    .where(({ or, cmp, exists }) =>
      or(
        cmp('checksum', 'IS NOT', null),
        cmp('owner_id', actor),
        exists('readers', reader => reader.where('user_id', actor))
      )
    );
}

function workspaceReadAccess<T>(query: T, actor: string): T {
  return (query as any).where(({ or, cmp, exists }: any) =>
    or(
      cmp('checksum', 'IS NOT', null),
      cmp('owner_id', actor),
      exists('readers', (reader: any) => reader.where('user_id', actor))
    )
  );
}
const projectInput = z.object({ projectId: z.string().uuid() });
function elementSets(actor: string, groupId: string | null) {
  return zql.studio_element_set
    .where('archived_at', 'IS', null)
    .where(({ or, and, cmp, exists }) =>
      or(
        and(cmp('group_id', 'IS', null), cmp('owner_id', actor)),
        and(
          cmp('group_id', '=', groupId ?? '00000000-0000-0000-0000-000000000000'),
          exists('group', group => groupProjectsAccess(group, actor))
        )
      )
    )
    .related('current_revision')
    .orderBy('updated_at', 'desc');
}
export const studioQueries = {
  commandReceipt: defineQuery(z.object({ operationId: z.string().uuid() }), ({ args, ctx }) =>
    zql.studio_command_receipt
      .where('id', args.operationId)
      .where('actor_id', requireQueryUser(ctx.userID))
      .where(({ or, cmp, exists }) =>
        or(
          cmp('project_id', 'IS', null),
          exists('project', p => collaborativeProject(p, requireQueryUser(ctx.userID)))
        )
      )
      .where(({ or, cmp }) => or(cmp('expires_at', 'IS', null), cmp('expires_at', '>', Date.now())))
      .one()
  ),
  canvasReceipt: defineQuery(z.object({ operationId: z.string().uuid() }), ({ args, ctx }) =>
    zql.canvas_receipt
      .where('id', args.operationId)
      .where('actor_id', requireQueryUser(ctx.userID))
      .whereExists('project', project =>
        collaborativeProject(project, requireQueryUser(ctx.userID))
      )
      .one()
  ),
  control: defineQuery(projectInput, ({ args, ctx }) =>
    zql.canvas_control
      .where('project_id', args.projectId)
      .whereExists('project', project =>
        collaborativeProject(project, requireQueryUser(ctx.userID))
      )
      .one()
  ),
  sessionProject: defineQuery(projectInput, ({ args, ctx }) =>
    collaborativeProject(zql.studio_project, requireQueryUser(ctx.userID))
      .where('id', args.projectId)
      .related('owner')
      .related('collaborators', c => c.where('status', 'active').related('user'))
      .related('group', g =>
        g
          .related('owner')
          .related('memberships', m =>
            m
              .where('status', 'IN', ['active', 'member', 'admin'])
              .related('user')
              .related('membership_roles', a =>
                a
                  .related('studio_project_rights')
                  .related('role', r => r.related('canvas_capabilities'))
              )
          )
          .related('roles', r => r.related('canvas_capabilities'))
      )
      .one()
  ),
  assets: defineQuery(
    z.object({ projectId: z.string().uuid(), workspaceId: z.string().uuid().optional() }),
    ({ args, ctx }) =>
      zql.studio_asset
        .where('project_id', args.projectId)
        .where('ready', true)
        .where(({ or, cmp }) =>
          or(
            cmp('workspace_id', 'IS', null),
            cmp('workspace_id', '=', args.workspaceId ?? '00000000-0000-0000-0000-000000000000')
          )
        )
        .whereExists('project', project =>
          args.workspaceId
            ? collaborativeProject(project, requireQueryUser(ctx.userID))
            : relatedProject(project, ctx.userID && ctx.userID !== 'anon' ? ctx.userID : null)
        )
        .where(({ or, cmp, exists }) =>
          or(
            cmp('workspace_id', 'IS', null),
            exists('workspace', w => workspaceReadAccess(w, requireQueryUser(ctx.userID)))
          )
        )
  ),
  collaborators: defineQuery(projectInput, ({ args, ctx }) =>
    zql.studio_project_collaborator
      .where('project_id', args.projectId)
      .whereExists('project', project =>
        project
          .where('document_schema_version', 5)
          .where('group_id', 'IS', null)
          .where('owner_id', requireQueryUser(ctx.userID))
      )
      .related('user')
      .orderBy('created_at', 'asc')
  ),
  invitations: defineQuery(z.undefined(), ({ ctx }) =>
    zql.studio_project_collaborator
      .where('user_id', requireQueryUser(ctx.userID))
      .where('status', 'invited')
      .whereExists('project', p =>
        p.where('document_schema_version', 5).where('group_id', 'IS', null)
      )
      .related('project', p => p.related('owner'))
      .orderBy('updated_at', 'desc')
  ),
  themes: defineQuery(z.object({ groupId: z.string().uuid().nullable() }), ({ args, ctx }) =>
    zql.appearance_theme
      .whereExists('current_revision', r => r.where('status', 'published'))
      .where(({ or, and, cmp, exists }) =>
        or(
          and(cmp('kind', 'personal'), cmp('created_by_id', requireQueryUser(ctx.userID))),
          and(
            cmp('kind', 'group'),
            cmp('group_id', '=', args.groupId ?? '00000000-0000-0000-0000-000000000000'),
            exists('group', g => groupProjectsAccess(g, requireQueryUser(ctx.userID)))
          )
        )
      )
      .related('current_revision')
      .orderBy('kind', 'asc')
      .orderBy('name', 'asc')
  ),
  elementSets: defineQuery(z.object({ groupId: z.string().uuid().nullable() }), ({ args, ctx }) =>
    elementSets(requireQueryUser(ctx.userID), args.groupId)
  ),
  editorActions: defineQuery(projectInput, ({ args, ctx }) =>
    zql.studio_editor_action
      .where('project_id', args.projectId)
      .where('actor_id', requireQueryUser(ctx.userID))
      .where('pending', true)
      .whereExists('project', p => collaborativeProject(p, requireQueryUser(ctx.userID)))
      .orderBy('created_at', 'asc')
      .limit(20)
  ),
  comments: defineQuery(projectInput, ({ args, ctx }) =>
    zql.canvas_comment
      .where('project_id', args.projectId)
      .whereExists('project', p => collaborativeProject(p, requireQueryUser(ctx.userID)))
      .where(({ or, cmp, exists }) =>
        or(
          cmp('proposal_id', 'IS', null),
          exists('proposal', p => workspaceReadAccess(p, requireQueryUser(ctx.userID)))
        )
      )
      .orderBy('created_at', 'asc')
  ),
  history: defineQuery(projectInput, ({ args, ctx }) =>
    zql.canvas_history
      .where('project_id', args.projectId)
      .whereExists('project', p => collaborativeProject(p, requireQueryUser(ctx.userID)))
      .orderBy('revision', 'desc')
      .limit(100)
  ),
  libraries: defineQuery(z.object({ groupId: z.string().uuid().nullable() }), ({ args, ctx }) =>
    zql.canvas_library
      .whereExists('project', p =>
        collaborativeProject(p, requireQueryUser(ctx.userID))
          .where('group_id', args.groupId === null ? 'IS' : '=', args.groupId)
          .where(({ or, cmp }: any) =>
            or(cmp('group_id', 'IS NOT', null), cmp('owner_id', requireQueryUser(ctx.userID)))
          )
      )
      .orderBy('created_at', 'asc')
  ),
  export: defineQuery(z.object({ id: z.string().uuid() }), ({ args, ctx }) =>
    zql.studio_export
      .where('id', args.id)
      .whereExists('project', p => collaborativeProject(p, requireQueryUser(ctx.userID)))
      .related('revision')
      .one()
  ),
  byOwner: defineQuery(z.object({ ownerId: z.string().uuid() }), ({ args, ctx: { userID } }) =>
    projects(userID && userID !== 'anon' ? userID : null)
      .where('owner_id', args.ownerId)
      .orderBy('updated_at', 'desc')
      .limit(100)
  ),
  manageGroups: defineQuery(z.undefined(), ({ ctx: { userID } }) =>
    groupProjectsAccess(zql.group, requireQueryUser(userID), true).orderBy('name', 'asc').limit(200)
  ),
  manageGroup: defineQuery(z.object({ groupId: z.string().uuid() }), ({ args, ctx: { userID } }) =>
    groupProjectsAccess(zql.group.where('id', args.groupId), requireQueryUser(userID), true).one()
  ),
  workspace: defineQuery(
    z.object({ projectId: z.string().uuid(), workspaceId: z.string().uuid() }),
    ({ args, ctx: { userID } }) =>
      canvasWorkspaces(requireQueryUser(userID), args.projectId)
        .where('id', args.workspaceId)
        .related('readers')
        .one()
  ),
  proposals: defineQuery(z.object({ projectId: z.string().uuid() }), ({ args, ctx: { userID } }) =>
    canvasWorkspaces(requireQueryUser(userID), args.projectId)
      .where('ai_status', 'ready')
      .related('readers')
      .related('votes')
      .orderBy('updated_at', 'desc')
  ),
  operation: defineQuery(
    z.object({ projectId: z.string(), operationId: z.string() }),
    ({ args, ctx: { userID } }) =>
      zql.studio_operation
        .where('project_id', args.projectId)
        .where('id', args.operationId)
        .where('actor_id', requireQueryUser(userID))
        .whereExists('project', project => collaborativeProject(project, requireQueryUser(userID)))
        .one()
  ),
  document: defineQuery(z.object({ id: z.string() }), ({ args, ctx: { userID } }) =>
    zql.studio_state
      .where('project_id', args.id)
      .whereExists('project', project =>
        relatedProject(project, userID && userID !== 'anon' ? userID : null)
      )
      .one()
  ),
  list: defineQuery(
    z.object({ groupId: z.string().nullable().default(null) }),
    ({ args, ctx: { userID } }) =>
      projects(userID && userID !== 'anon' ? userID : null)
        .where('group_id', args.groupId === null ? 'IS' : '=', args.groupId)
        .orderBy('updated_at', 'desc')
        .limit(100)
  ),
  project: defineQuery(z.object({ id: z.string() }), ({ args, ctx: { userID } }) =>
    projects(userID && userID !== 'anon' ? userID : null)
      .where('id', args.id)
      .one()
  ),
  exports: defineQuery(z.object({ projectId: z.string() }), ({ args, ctx: { userID } }) =>
    zql.studio_export
      .where('project_id', args.projectId)
      .whereExists('project', project => collaborativeProject(project, requireQueryUser(userID)))
      .orderBy('created_at', 'desc')
      .limit(25)
  ),
};

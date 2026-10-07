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

function relatedProject(project: any, actor: string | null) {
  return studioProjectReadAccess(project.where('document_schema_version', 5), actor);
}

function collaborativeProject(project: any, actor: string) {
  return studioProjectCollaborativeAccess(project.where('document_schema_version', 5), actor);
}

function canvasWorkspaces(actor: string, projectId: string) {
  return zql.canvas_proposal
    .where('project_id', projectId)
    .whereExists('project', (project: any) =>
      collaborativeProject(project, actor).where('group_id', 'IS NOT', null)
    )
    .where(({ or, cmp, exists }) =>
      or(
        cmp('checksum', 'IS NOT', null),
        cmp('owner_id', actor),
        exists('readers', reader => reader.where('user_id', actor))
      )
    );
}

export const studioQueries = {
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
      canvasWorkspaces(requireQueryUser(userID), args.projectId).where('id', args.workspaceId).one()
  ),
  proposals: defineQuery(z.object({ projectId: z.string().uuid() }), ({ args, ctx: { userID } }) =>
    canvasWorkspaces(requireQueryUser(userID), args.projectId).orderBy('updated_at', 'desc')
  ),
  operation: defineQuery(
    z.object({ projectId: z.string(), operationId: z.string() }),
    ({ args, ctx: { userID } }) =>
      zql.studio_operation
        .where('project_id', args.projectId)
        .where('id', args.operationId)
        .where('actor_id', requireQueryUser(userID))
        .whereExists('project', project => relatedProject(project, requireQueryUser(userID)))
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

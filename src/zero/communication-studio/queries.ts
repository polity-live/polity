import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
const requireQueryUser = (userID: string | undefined | null) =>
  userID && userID !== 'anon' ? userID : '00000000-0000-0000-0000-000000000000';
function projects(userID: string) {
  return zql.studio_project.where('document_schema_version', 4).where(({ or, and, cmp, exists }) =>
    or(
      and(cmp('group_id', 'IS', null), cmp('owner_id', userID)),
      exists('group', g =>
        g.where(({ or, cmp, exists }) =>
          or(
            cmp('owner_id', userID),
            exists('memberships', m =>
              m.where('user_id', userID).where('status', 'IN', ['active', 'member', 'admin'])
            )
          )
        )
      )
    )
  );
}
export const studioQueries = {
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
        .whereExists('project', p =>
          p.where('document_schema_version', 4).where(({ or, and, cmp, exists }) =>
            or(
              and(cmp('group_id', 'IS', null), cmp('owner_id', requireQueryUser(userID))),
              exists('group', g =>
                g.where(({ or, cmp, exists }) =>
                  or(
                    cmp('owner_id', requireQueryUser(userID)),
                    exists('memberships', m =>
                      m
                        .where('user_id', requireQueryUser(userID))
                        .where('status', 'IN', ['active', 'member', 'admin'])
                    )
                  )
                )
              )
            )
          )
        )
        .one()
  ),
  document: defineQuery(z.object({ id: z.string() }), ({ args, ctx: { userID } }) =>
    zql.studio_state
      .where('project_id', args.id)
      .whereExists('project', p =>
        p.where('document_schema_version', 4).where(({ or, and, cmp, exists }) =>
          or(
            and(cmp('group_id', 'IS', null), cmp('owner_id', requireQueryUser(userID))),
            exists('group', g =>
              g.where(({ or, cmp, exists }) =>
                or(
                  cmp('owner_id', requireQueryUser(userID)),
                  exists('memberships', m =>
                    m
                      .where('user_id', requireQueryUser(userID))
                      .where('status', 'IN', ['active', 'member', 'admin'])
                  )
                )
              )
            )
          )
        )
      )
      .one()
  ),
  list: defineQuery(
    z.object({ groupId: z.string().nullable().default(null) }),
    ({ args, ctx: { userID } }) =>
      projects(requireQueryUser(userID))
        .where('group_id', args.groupId === null ? 'IS' : '=', args.groupId)
        .orderBy('updated_at', 'desc')
        .limit(100)
  ),
  project: defineQuery(z.object({ id: z.string() }), ({ args, ctx: { userID } }) =>
    projects(requireQueryUser(userID)).where('id', args.id).one()
  ),
  exports: defineQuery(z.object({ projectId: z.string() }), ({ args, ctx: { userID } }) =>
    zql.studio_export
      .where('project_id', args.projectId)
      .whereExists('project', p =>
        p.where('document_schema_version', 4).where(({ or, and, cmp, exists }) =>
          or(
            and(cmp('group_id', 'IS', null), cmp('owner_id', requireQueryUser(userID))),
            exists('group', g =>
              g.where(({ or, cmp, exists }) =>
                or(
                  cmp('owner_id', requireQueryUser(userID)),
                  exists('memberships', m =>
                    m
                      .where('user_id', requireQueryUser(userID))
                      .where('status', 'IN', ['active', 'member', 'admin'])
                  )
                )
              )
            )
          )
        )
      )
      .orderBy('created_at', 'desc')
      .limit(25)
  ),
};

function canvasWorkspaces(actor: string, projectId: string) {
  return zql.canvas_proposal
    .where('project_id', projectId)
    .whereExists('project', p =>
      p.where('document_schema_version', 4).whereExists('group', g =>
        g.where(({ or, cmp, exists }) =>
          or(
            cmp('owner_id', actor),
            exists('memberships', m =>
              m.where('user_id', actor).where('status', 'IN', ['active', 'member', 'admin'])
            )
          )
        )
      )
    )
    .where(({ or, cmp, exists }) =>
      or(
        cmp('checksum', 'IS NOT', null),
        cmp('owner_id', actor),
        exists('readers', r => r.where('user_id', actor))
      )
    );
}

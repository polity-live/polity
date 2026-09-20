import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
const requireQueryUser = (userID: string | undefined | null) =>
  userID && userID !== 'anon' ? userID : '00000000-0000-0000-0000-000000000000';
function projects(userID: string) {
  return zql.studio_project.where(({ or, and, cmp, exists }) =>
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
        p.where(({ or, and, cmp, exists }) =>
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

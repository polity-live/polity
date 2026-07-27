import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import { applyGroupManagerQueryAccess } from '../rbac/query-access';

const ACTIVE_MEMBERSHIP_STATUSES = ['active', 'member', 'admin'];

export const appearanceThemeQueries = {
  catalog: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.appearance_theme
      .where(({ and, cmp, exists, or }: any) =>
        or(
          cmp('kind', 'builtin'),
          and(
            cmp('kind', 'group'),
            cmp('current_revision_id', 'IS NOT', null),
            exists('current_revision', (revision: any) => revision.where('status', 'published')),
            exists('group', (group: any) =>
              group.whereExists('memberships', (membership: any) =>
                membership
                  .where('user_id', userID)
                  .where('status', 'IN', ACTIVE_MEMBERSHIP_STATUSES)
              )
            )
          )
        )
      )
      .related('group')
      .related('current_revision')
      .orderBy('name', 'asc')
  ),

  availableGroupThemes: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.appearance_theme
      .where('kind', 'group')
      .where('current_revision_id', 'IS NOT', null)
      .whereExists('current_revision', revision => revision.where('status', 'published'))
      .whereExists('group', group =>
        group.whereExists('memberships', membership =>
          membership.where('user_id', userID).where('status', 'IN', ACTIVE_MEMBERSHIP_STATUSES)
        )
      )
      .related('group')
      .related('current_revision')
      .orderBy('name', 'asc')
  ),

  selectedGroupTheme: defineQuery(
    z.object({ themeId: z.string().uuid() }),
    ({ args: { themeId }, ctx: { userID } }) =>
      zql.appearance_theme
        .where('id', themeId)
        .where('kind', 'group')
        .where('current_revision_id', 'IS NOT', null)
        .whereExists('current_revision', revision => revision.where('status', 'published'))
        .whereExists('group', group =>
          group.whereExists('memberships', membership =>
            membership.where('user_id', userID).where('status', 'IN', ACTIVE_MEMBERSHIP_STATUSES)
          )
        )
        .related('group')
        .related('current_revision')
        .one()
  ),

  groupEditor: defineQuery(
    z.object({ groupId: z.string().uuid() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.appearance_theme
        .where('group_id', groupId)
        .where('kind', 'group')
        .whereExists('group', group =>
          applyGroupManagerQueryAccess(group, userID, 'manage', ['groups', 'groupThemes'])
        )
        .related('group')
        .related('current_revision')
        .related('revisions', revision => revision.orderBy('version', 'desc'))
        .orderBy('updated_at', 'desc')
  ),
};

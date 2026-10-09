import { describe, expect, it } from 'vitest';
import {
  buildQuery,
  loadCases,
  OWNER,
  OUTSIDER,
} from '../../../../tools/e2e/zero-performance/catalog';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import { applyGroupDiscoveryQueryAccess } from '../../rbac/query-access';
import { whereAnyOf } from '../../shared/query-conditions';
import { zql } from '../../schema';

function originalCatalog(userID: string) {
  return zql.appearance_theme
    .where(({ and, cmp, exists, or }: any) =>
      or(
        cmp('kind', 'builtin'),
        and(cmp('kind', 'personal'), cmp('created_by_id', userID)),
        and(
          cmp('kind', 'group'),
          cmp('current_revision_id', 'IS NOT', null),
          exists('current_revision', (revision: any) => revision.where('status', 'published')),
          exists('group', (group: any) =>
            group.whereExists('memberships', (membership: any) =>
              whereAnyOf(membership.where('user_id', userID), 'status', [
                'active',
                'member',
                'admin',
              ])
            )
          )
        )
      )
    )
    .related('group', group => applyGroupDiscoveryQueryAccess(group, userID))
    .related('current_revision')
    .orderBy('name', 'asc');
}

describe('appearance catalog indexed candidate set', () => {
  it.each([OWNER, OUTSIDER, { userID: 'anon', email: '' }])(
    'retains every original permission, nested projection and order for $userID',
    ctx => {
      const entry = loadCases().find(entry => entry.name === 'appearanceThemes.catalog')!;
      const actual = structuredClone(queryAST(buildQuery(entry, ctx)));
      const where = actual.where;
      expect(where.type).toBe('and');
      const candidates = where.conditions.filter((condition: any) => condition.op === 'IN');
      expect(candidates).toEqual([
        {
          type: 'simple',
          op: 'IN',
          left: { type: 'column', name: 'kind' },
          right: { type: 'literal', value: ['builtin', 'personal', 'group'] },
        },
      ]);
      const original = where.conditions.filter((condition: any) => condition.op !== 'IN');
      expect(original).toHaveLength(1);
      actual.where = original[0];
      expect(actual).toEqual(queryAST(originalCatalog(ctx.userID)));
    }
  );

  it('the candidate set cannot remove any builtin, personal or permitted group result', () => {
    for (const kind of ['builtin', 'personal', 'group', 'unknown', '', null]) {
      for (const creator of [OWNER.userID, OUTSIDER.userID, null]) {
        for (const revision of [null, 'revision']) {
          for (const published of [false, true]) {
            for (const membership of ['active', 'member', 'admin', 'invited', 'inactive', null]) {
              const allowed =
                kind === 'builtin' ||
                (kind === 'personal' && creator === OWNER.userID) ||
                (kind === 'group' &&
                  revision !== null &&
                  published &&
                  ['active', 'member', 'admin'].includes(membership ?? ''));
              const guarded = ['builtin', 'personal', 'group'].includes(kind ?? '') && allowed;
              expect(
                guarded,
                JSON.stringify({ kind, creator, revision, published, membership })
              ).toBe(allowed);
            }
          }
        }
      }
    }
  });
});

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

type PolicyRow = Record<string, unknown> & { relations?: Record<string, PolicyRow[]> };
function matches(condition: any, row: PolicyRow): boolean {
  if (!condition) return true;
  if (condition.type === 'and')
    return condition.conditions.every((child: any) => matches(child, row));
  if (condition.type === 'or')
    return condition.conditions.some((child: any) => matches(child, row));
  if (condition.type === 'correlatedSubquery') {
    expect(condition.op).toBe('EXISTS');
    const child = condition.related.subquery;
    return (row.relations?.[child.alias] ?? []).some(value => matches(child.where, value));
  }
  const value = row[condition.left.name];
  const literal = condition.right.value;
  switch (condition.op) {
    case '=':
      return value != null && literal != null && value === literal;
    case '!=':
      return value != null && literal != null && value !== literal;
    case 'IN':
      return value != null && literal.includes(value);
    case 'IS NOT':
      return value !== literal;
    default:
      throw new Error(`Unhandled policy operator ${condition.op}`);
  }
}

describe('appearance catalog indexed candidate set', () => {
  it.each([OWNER, OUTSIDER, { userID: 'anon', email: '' }])(
    'retains every original permission, nested projection and order for $userID',
    ctx => {
      const entry = loadCases().find(entry => entry.name === 'appearanceThemes.catalog')!;
      const actual = structuredClone(queryAST(buildQuery(entry, ctx)));
      const before = queryAST(originalCatalog(ctx.userID));
      const collectExists = (value: any): any[] =>
        value.type === 'correlatedSubquery'
          ? [value]
          : (value.conditions ?? []).flatMap(collectExists);
      expect(collectExists(actual.where)).toEqual(collectExists(before.where));
      const { where: _actualWhere, ...actualProjection } = actual;
      const { where: _originalWhere, ...originalProjection } = before;
      expect(actualProjection).toEqual(originalProjection);

      for (const kind of ['builtin', 'personal', 'group', 'unknown', '', null])
        for (const creator of [OWNER.userID, OUTSIDER.userID, null])
          for (const revision of [null, 'revision'])
            for (const published of [false, true])
              for (const membership of ['active', 'member', 'admin', 'invited', 'inactive', null]) {
                const row: PolicyRow = {
                  kind,
                  created_by_id: creator,
                  current_revision_id: revision,
                  relations: {
                    zsubq_current_revision:
                      revision === null ? [] : [{ status: published ? 'published' : 'draft' }],
                    zsubq_group: [
                      {
                        relations: {
                          zsubq_memberships: [{ user_id: OWNER.userID, status: membership }],
                        },
                      },
                    ],
                  },
                };
                const allowed =
                  kind === 'builtin' ||
                  (kind === 'personal' && creator === ctx.userID) ||
                  (kind === 'group' &&
                    revision !== null &&
                    published &&
                    ctx.userID === OWNER.userID &&
                    ['active', 'member', 'admin'].includes(membership ?? ''));
                expect(
                  matches(before.where, row),
                  JSON.stringify({ kind, creator, revision, published, membership })
                ).toBe(allowed);
                expect(
                  matches(actual.where, row),
                  JSON.stringify({ kind, creator, revision, published, membership })
                ).toBe(allowed);
              }
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
              const guarded =
                ['builtin', 'personal', 'group'].includes(kind ?? '') &&
                (kind !== 'personal' || creator === OWNER.userID) &&
                (kind !== 'group' ||
                  (revision !== null &&
                    published &&
                    ['active', 'member', 'admin'].includes(membership ?? '')));
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

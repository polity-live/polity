import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildQuery,
  loadCases,
  OWNER,
  OUTSIDER,
} from '../../../../tools/e2e/zero-performance/catalog';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import { applyGroupQueryAccess } from '../../rbac/query-access';
import { zql } from '../../schema';

const selectors = [
  [
    'hierarchyPathsByGroup',
    'group_hierarchy_path',
    'ancestor_group',
    'descendant_group',
    'ancestor_group_id',
    'descendant_group_id',
  ],
  [
    'effectiveRightsByGroup',
    'group_effective_right',
    'holder_group',
    'scope_group',
    'holder_group_id',
    'scope_group_id',
  ],
  [
    'membershipExclusivityLocksByGroup',
    'group_membership_exclusivity_lock',
    'hierarchy_group',
    'source_group',
    'hierarchy_group_id',
    'source_group_id',
  ],
  [
    'siblingSourceLocksByGroup',
    'group_sibling_source_lock',
    'sibling_group',
    'source_group',
    'sibling_group_id',
    'source_group_id',
  ],
  [
    'groupConnectionRequestsByGroup',
    'group_connection_request',
    'group_a',
    'group_b',
    'group_a_id',
    'group_b_id',
  ],
] as const;

const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .filter(key => key !== 'flip')
            .sort()
            .map(key => [key, canonical(value[key])])
        )
      : value;

describe('indexed network endpoint selection', () => {
  for (const name of ['wikiNetwork', 'groupConnectionsByGroup', 'groupConnectionsByPair']) {
    it.each([OWNER, OUTSIDER, { userID: 'anon', email: '' }])(
      `${name} preserves all connection endpoints and access predicates for $userID`,
      ctx => {
        const entry = loadCases().find(
          entry => entry.name === `network.${name}` && entry.variant === 'default'
        )!;
        const args = entry.args as { groupId: string; groupAId: string; groupBId: string };
        const migration = readFileSync(
          'supabase/migrations/20260922043912_initial_reset.sql',
          'utf8'
        );
        const fields = ['group_a_id', 'group_b_id', 'from_group_id', 'to_group_id'];
        for (const field of fields) {
          expect(migration).toContain(`FOREIGN KEY (${field}) REFERENCES public."group"(id)`);
          expect(migration).toContain(
            `alter table "public"."group_connection" validate constraint "group_connection_${field}_fkey";`
          );
        }
        let joins = 0;
        const normalize = (value: any): any => {
          if (value?.type === 'correlatedSubquery' && value.flip === true) {
            const { correlation, subquery } = value.related;
            expect(value.op).toBe('EXISTS');
            expect(subquery.table).toBe('group');
            expect(correlation.childField).toEqual(['id']);
            expect(correlation.parentField).toHaveLength(1);
            expect(fields).toContain(correlation.parentField[0]);
            expect(subquery.where).toMatchObject({
              type: 'simple',
              op: '=',
              left: { type: 'column', name: 'id' },
              right: { type: 'literal' },
            });
            joins++;
            return {
              ...subquery.where,
              left: { type: 'column', name: correlation.parentField[0] },
            };
          }
          return Array.isArray(value)
            ? value.map(normalize)
            : value && typeof value === 'object'
              ? Object.fromEntries(
                  Object.entries(value).map(([key, child]) => [key, normalize(child)])
                )
              : value;
        };
        const actual = normalize(queryAST(buildQuery(entry, ctx)).where);
        const permission = zql.group_connection.where(({ or, exists }) =>
          or(
            ...['group_a', 'group_b', 'parent_group', 'child_group', 'from_group', 'to_group'].map(
              relation =>
                exists(
                  relation as 'group_a',
                  group => applyGroupQueryAccess(group, ctx.userID, true),
                  { flip: false }
                )
            )
          )
        );
        const expected =
          name === 'groupConnectionsByPair'
            ? permission.where(({ or, and, cmp }) =>
                or(
                  and(cmp('group_a_id', '=', args.groupAId), cmp('group_b_id', '=', args.groupBId)),
                  and(cmp('group_a_id', '=', args.groupBId), cmp('group_b_id', '=', args.groupAId)),
                  and(
                    cmp('from_group_id', '=', args.groupAId),
                    cmp('to_group_id', '=', args.groupBId)
                  ),
                  and(
                    cmp('from_group_id', '=', args.groupBId),
                    cmp('to_group_id', '=', args.groupAId)
                  )
                )
              )
            : permission.where(({ or, cmp }) =>
                or(
                  cmp('group_a_id', '=', args.groupId),
                  cmp('group_b_id', '=', args.groupId),
                  cmp('from_group_id', '=', args.groupId),
                  cmp('to_group_id', '=', args.groupId)
                )
              );
        expect(joins).toBe(name === 'groupConnectionsByPair' ? 8 : 4);
        expect(canonical(actual)).toEqual(canonical(queryAST(expected).where));
      }
    );
  }
  it('requires validated group foreign keys for every equivalent PK lookup', () => {
    const migration = readFileSync('supabase/migrations/20260922043912_initial_reset.sql', 'utf8');
    for (const [, table, , , firstField, secondField] of selectors) {
      for (const field of [firstField, secondField]) {
        expect(migration).toContain(`FOREIGN KEY (${field}) REFERENCES public."group"(id)`);
        expect(migration).toContain(
          `alter table "public"."${table}" validate constraint "${table}_${field}_fkey";`
        );
      }
    }
  });

  for (const [name, table, first, second, firstField, secondField] of selectors) {
    it.each([OWNER, OUTSIDER, { userID: 'anon', email: '' }])(
      `${name} preserves endpoint, status and permission predicates for $userID`,
      ctx => {
        const entry = loadCases().find(
          entry => entry.name === `network.${name}` && entry.variant === 'default'
        )!;
        const { groupId } = entry.args as { groupId: string };
        const actual = queryAST(buildQuery(entry, ctx));
        const joins: any[] = [];
        const normalize = (value: any): any => {
          if (value?.type === 'correlatedSubquery' && value.flip === true) {
            expect(value.op).toBe('EXISTS');
            expect(value.related.subquery.table).toBe('group');
            expect(value.related.correlation.childField).toEqual(['id']);
            expect([firstField, secondField]).toContain(value.related.correlation.parentField[0]);
            expect(value.related.correlation.parentField).toHaveLength(1);
            expect(value.related.subquery.where).toEqual({
              type: 'simple',
              op: '=',
              left: { type: 'column', name: 'id' },
              right: { type: 'literal', value: groupId },
            });
            joins.push(value);
            return {
              type: 'simple',
              op: '=',
              left: { type: 'column', name: value.related.correlation.parentField[0] },
              right: { type: 'literal', value: groupId },
            };
          }
          return Array.isArray(value)
            ? value.map(normalize)
            : value && typeof value === 'object'
              ? Object.fromEntries(
                  Object.entries(value).map(([key, child]) => [key, normalize(child)])
                )
              : value;
        };
        const normalized = normalize(actual.where);
        expect(joins).toHaveLength(2);
        const permission = (q: any, relations: string[]) =>
          q.where(({ or, exists }: any) =>
            or(
              ...relations.map(relation =>
                exists(relation, (group: any) => applyGroupQueryAccess(group, ctx.userID, true), {
                  flip: false,
                })
              )
            )
          );
        let expected = (zql as any)[table];
        if (name === 'groupConnectionRequestsByGroup')
          expected = permission(expected, [first, second, 'initiator_group']);
        else expected = expected.where('status', 'active');
        expected = expected.where(({ or, cmp }: any) =>
          or(cmp(firstField, '=', groupId), cmp(secondField, '=', groupId))
        );
        if (name !== 'groupConnectionRequestsByGroup')
          expected = permission(expected, [first, second]);
        expect(canonical(normalized)).toEqual(canonical(queryAST(expected).where));

        // Exhaustive nullable endpoint combinations under those FKs, including
        // two matches, no match and selection of a nonexistent group.
        const groups = [{ id: groupId }, { id: 'other' }];
        const rows = [groupId, 'other', null].flatMap((a, i) =>
          [groupId, 'other', null].map((b, j) => ({
            id: `${i}-${j}`,
            [firstField]: a,
            [secondField]: b,
          }))
        );
        for (const target of [groupId, 'other', 'missing']) {
          const original = rows.filter(
            row => row[firstField] === target || row[secondField] === target
          );
          const indexed = rows.filter(row =>
            joins.some(join =>
              groups.some(
                group =>
                  group.id === row[join.related.correlation.parentField[0]] && group.id === target
              )
            )
          );
          expect(indexed.map(row => row.id)).toEqual(original.map(row => row.id));
        }
      }
    );
  }
});

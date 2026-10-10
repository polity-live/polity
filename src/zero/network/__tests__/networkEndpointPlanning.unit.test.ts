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

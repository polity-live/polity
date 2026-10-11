import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { Fixtures } from '../fixtures';
import { buildQuery, loadCases, OWNER, FIXTURE_ID } from '../catalog';
import { queryAST } from '../oracle';
import { schema, zql } from '../../../../src/zero/schema';

function planner() {
  const fixtures = new Fixtures((() => {
    throw new Error('Unit planning must not access a database');
  }) as unknown as Sql);
  for (const table of Object.values(schema.tables) as any[]) {
    fixtures.columns.set(
      table.serverName ?? table.name,
      new Map(
        Object.entries(table.columns).map(([name, column]: [string, any]) => [
          column.serverName ?? name,
          {
            type:
              name === 'id' || name.endsWith('_id')
                ? 'uuid'
                : column.type === 'number'
                  ? 'bigint'
                  : column.type === 'boolean'
                    ? 'boolean'
                    : column.type === 'json'
                      ? 'jsonb'
                      : 'text',
            nullable: Boolean(column.optional),
            default: null,
          },
        ])
      )
    );
  }
  return fixtures;
}

describe('positive fixtures with constrained correlated keys', () => {
  it.each([
    'hierarchyPathsByGroup',
    'effectiveRightsByGroup',
    'membershipExclusivityLocksByGroup',
    'siblingSourceLocksByGroup',
    'groupConnectionRequestsByGroup',
  ])('plans a real matching group endpoint for network.%s', name => {
    const entry = loadCases().find(entry => entry.name === `network.${name}`)!;
    const result = planner().plan(queryAST(buildQuery(entry, OWNER)));
    expect(Object.values(result.root.values)).toContain(FIXTURE_ID);
    expect(
      result.records.some(record => record.table === 'group' && record.values.id === FIXTURE_ID)
    ).toBe(true);
  });

  it('binds an unassigned parent FK to the actual constrained child identity', () => {
    const target = '40000000-0000-4000-8000-000000000055';
    const result = planner().plan(
      queryAST(
        zql.group_hierarchy_path.whereExists('ancestor_group', group => group.where('id', target), {
          flip: true,
        })
      )
    );
    expect(result.root.values.ancestor_group_id).toBe(target);
    expect(
      result.records.some(record => record.table === 'group' && record.values.id === target)
    ).toBe(true);
  });

  it('rejects contradictory parent and child identities instead of changing the argument', () => {
    expect(() =>
      planner().plan(
        queryAST(
          zql.group_hierarchy_path
            .where('ancestor_group_id', FIXTURE_ID)
            .whereExists(
              'ancestor_group',
              group => group.where('id', '40000000-0000-4000-8000-000000000055'),
              { flip: true }
            )
        )
      )
    ).toThrow(/Conflicting fixture predicates/);
  });
});

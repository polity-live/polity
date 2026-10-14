import { afterEach, describe, expect, it } from 'vitest';
import { LogContext } from '@rocicorp/logger';
import { Database, QueryDelegate } from '@rocicorp/zero/zqlite';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import { eventQueries } from '../queries';
import { applyGroupQueryAccess } from '../../rbac/query-access';
import { schema, zql } from '../../schema';

const endpoints = ['group_a', 'group_b', 'parent_group', 'child_group', 'from_group', 'to_group'];
const databases: Database[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function build(groupId?: string, userID?: string) {
  return eventQueries.groupRelationships.fn({ args: { groupId }, ctx: { userID } } as never);
}

function outerPermissions(query: ReturnType<typeof build>) {
  const found: any[] = [];
  const visit = (condition: any) => {
    if (condition.type === 'correlatedSubquery') found.push(condition);
    else condition.conditions?.forEach(visit);
  };
  visit(queryAST(query).where);
  return found;
}

function database() {
  const logger = new LogContext('error');
  const database = new Database(logger, ':memory:');
  databases.push(database);
  for (const [name, table] of Object.entries(schema.tables)) {
    const columns = Object.entries(table.columns).map(
      ([field, column]) =>
        `"${field}" ${column.type === 'number' ? 'REAL' : column.type === 'boolean' ? 'INTEGER' : 'TEXT'}`
    );
    database.exec(
      `CREATE TABLE "${name}" (${columns.join(',')}, PRIMARY KEY (${table.primaryKey.map(field => `"${field}"`).join(',')}))`
    );
  }
  const insert = (table: string, row: Record<string, string | number | null>) => {
    const fields = Object.keys(row);
    database
      .prepare(
        `INSERT INTO "${table}" (${fields.map(field => `"${field}"`).join(',')}) VALUES (${fields.map(() => '?').join(',')})`
      )
      .run(...Object.values(row));
  };
  const delegate = new QueryDelegate(logger, database, schema);
  const run = (groupId?: string, userID?: string) => delegate.run(build(groupId, userID));
  return { insert, run, database };
}

describe('group connection access planning with the installed Zero SDK', () => {
  it.each(['anon', undefined, 'owner', 'outsider'])(
    'drives only the six outer permission joins from connections for %s without changing their predicates',
    userID => {
      for (const groupId of [undefined, 'requested-group']) {
        const query = build(groupId, userID);
        const permissions = outerPermissions(query);
        expect(permissions.map(permission => permission.related.subquery.alias)).toEqual(
          endpoints.map(endpoint => `zsubq_${endpoint}`)
        );
        expect(permissions).toHaveLength(6);
        for (const permission of permissions) {
          expect(permission.flip).toBe(false);
          expect(permission.op).toBe('EXISTS');
          expect(permission.related.correlation.childField).toEqual(['id']);
          expect(permission.related.subquery.where).toEqual(
            queryAST(applyGroupQueryAccess(zql.group, userID)).where
          );
        }
        const former = zql.group_connection.where(({ or, exists }) =>
          or(
            ...endpoints.map(endpoint =>
              exists(endpoint as never, group => applyGroupQueryAccess(group, userID))
            )
          )
        );
        const unhinted = outerPermissions(former as ReturnType<typeof build>);
        expect(permissions.map(({ flip: _flip, ...permission }) => permission)).toEqual(unhinted);
      }
    }
  );

  it('returns empty and nonempty anonymous results without exposing a private endpoint selected by groupId', async () => {
    const { insert, run } = database();
    expect(await run(undefined, 'anon')).toEqual([]);
    insert('group', { id: 'private', owner_id: 'owner', visibility: 'private' });
    insert('group', { id: 'public', owner_id: 'other', visibility: 'public' });
    insert('group_connection', {
      id: 'connection',
      group_a_id: 'private',
      group_b_id: 'public',
      updated_at: 1,
    });
    const result = await run('private', 'anon');
    expect(result.map(row => row.id)).toEqual(['connection']);
    expect(result[0].group_a).toBeUndefined();
    expect(result[0].group_b?.id).toBe('public');
    expect(await run('unrelated', 'anon')).toEqual([]);
  });

  it.each(endpoints)(
    'retains authorization through %s and revokes its membership access',
    async endpoint => {
      const { insert, run, database: db } = database();
      insert('group', { id: 'private', owner_id: 'owner', visibility: 'private' });
      insert('group_connection', {
        id: 'connection',
        [`${endpoint}_id`]: 'private',
        updated_at: 1,
      });
      expect((await run(undefined, 'owner')).map(row => row.id)).toEqual(['connection']);
      expect(await run(undefined, 'outsider')).toEqual([]);
      expect(await run(undefined, 'anon')).toEqual([]);
      insert('group_membership', {
        id: 'membership',
        group_id: 'private',
        user_id: 'member',
        status: 'active',
      });
      expect((await run(undefined, 'member')).map(row => row.id)).toEqual(['connection']);
      db.prepare('UPDATE group_membership SET status=? WHERE id=?').run('revoked', 'membership');
      expect(await run(undefined, 'member')).toEqual([]);
    }
  );

  it('preserves tutorial owner and active-run filtering even for a public endpoint', async () => {
    const { insert, run, database: db } = database();
    insert('app_tutorial_run', { id: 'tutorial', user_id: 'owner', status: 'active' });
    insert('group', {
      id: 'public-tutorial',
      owner_id: 'owner',
      visibility: 'public',
      tutorial_run_id: 'tutorial',
    });
    insert('group_connection', {
      id: 'connection',
      from_group_id: 'public-tutorial',
      updated_at: 1,
    });
    expect((await run(undefined, 'owner')).map(row => row.id)).toEqual(['connection']);
    expect(await run(undefined, 'outsider')).toEqual([]);
    expect(await run(undefined, 'anon')).toEqual([]);
    db.prepare('UPDATE app_tutorial_run SET status=? WHERE id=?').run('closed', 'tutorial');
    expect(await run(undefined, 'owner')).toEqual([]);
  });
});

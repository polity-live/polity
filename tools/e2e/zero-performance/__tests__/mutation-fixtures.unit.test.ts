import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { MutationFixtures, mutationFixtureID } from '../mutation-fixtures';

function environment(port = 15625) {
  const url = `postgres://postgres:fixture@127.0.0.1:${port}/postgres`;
  for (const name of [
    'ZERO_UPSTREAM_DB',
    'E2E_DATABASE_URL',
    'DATABASE_URL',
    'SUPABASE_DB_URL',
    'STUDIO_DATABASE_URL',
    'STUDIO_TEST_DATABASE_URL',
  ])
    vi.stubEnv(name, url);
  vi.stubEnv('SUPABASE_URL', `http://127.0.0.1:${port - 1}`);
  vi.stubEnv('ZERO_PERFORMANCE_LAYER', 'mutations');
}
function database() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const deletions: string[] = [];
  const rows = (name: string) => {
    let result = tables.get(name);
    if (!result) {
      result = new Map();
      tables.set(name, result);
    }
    return result;
  };
  const sql = ((first: unknown, ...args: unknown[]) => {
    if (typeof first === 'string') return { identifier: first };
    if (!Array.isArray(first)) return { values: first };
    const statement = first.join('?');
    const table = (args[0] as { identifier: string }).identifier;
    if (statement.startsWith('select')) {
      const scope = statement.includes('where ? = ?');
      const column = scope ? (args[1] as { identifier: string }).identifier : 'id';
      const value = scope ? args[2] : args[1];
      return Promise.resolve(
        [...rows(table).values()]
          .filter(row => row[column] === value)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .map(row => structuredClone(row))
      );
    }
    if (statement.startsWith('insert')) {
      const values = (args[1] as { values: Record<string, unknown> }).values;
      rows(table).set(String(values.id), structuredClone(values));
    }
    if (statement.startsWith('update')) {
      const values = (args[1] as { values: Record<string, unknown> }).values;
      const id = String(args[2]);
      rows(table).set(id, { ...rows(table).get(id), ...structuredClone(values) });
    }
    if (statement.startsWith('delete')) {
      const id = String(args[1]);
      deletions.push(`${table}:${id}`);
      rows(table).delete(id);
    }
    return Promise.resolve([]);
  }) as unknown as Sql;
  return { sql, rows, deletions };
}
afterEach(() => vi.unstubAllEnvs());
describe('isolated mutation fixture snapshots', () => {
  it('rejects the ordinary development database even in mutations layer', () => {
    environment(54322);
    expect(() => new MutationFixtures(database().sql)).toThrow('never development port 54322');
    environment();
    vi.stubEnv('E2E_DATABASE_URL', 'postgres://example.invalid/production');
    expect(() => new MutationFixtures(database().sql)).toThrow('verified isolated');
  });
  it('restores existing parent snapshots in place and removes only created scoped side effects', async () => {
    environment();
    const db = database();
    db.rows('user').set('owner', { id: 'owner', first_name: 'Original' });
    db.rows('notification').set('existing', {
      id: 'existing',
      recipient_id: 'owner',
      title: 'Original',
    });
    db.rows('notification').set('unrelated', {
      id: 'unrelated',
      recipient_id: 'someone-else',
      title: 'Unrelated',
    });
    const f = new MutationFixtures(db.sql);
    await f.track('user', 'owner');
    await f.trackScope('notification', 'recipient_id', 'owner');
    db.rows('user').get('owner')!.first_name = 'Changed';
    db.rows('notification').get('existing')!.title = 'Changed';
    db.rows('notification').set('generated', {
      id: 'generated',
      recipient_id: 'owner',
      title: 'New',
    });
    await f.restore();
    await f.verifyRestored();
    expect(db.deletions).toEqual(['notification:generated']);
    expect(db.rows('notification').get('unrelated')?.title).toBe('Unrelated');
  });
  it('uses stable UUIDs isolated by repetition namespace and row label', () => {
    expect(mutationFixtureID('repeat1', 'row')).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/
    );
    expect(mutationFixtureID('repeat1', 'row')).toBe(mutationFixtureID('repeat1', 'row'));
    expect(mutationFixtureID('repeat1', 'row')).not.toBe(mutationFixtureID('repeat2', 'row'));
  });
  it('seals prepared rollback state but proves fixture-owned scoped rows absent after restoration', async () => {
    environment();
    const db = database();
    const f = new MutationFixtures(db.sql);
    await f.insert('parent', { id: 'new-parent' });
    await f.insert('child', { id: 'new-child', parent_id: 'new-parent', title: 'Before' });
    await f.trackScope('child', 'parent_id', 'new-parent');
    await f.sealScopes();
    await f.verifyScopesUnchanged();
    db.rows('child').get('new-child')!.title = 'Changed';
    await expect(f.verifyScopesUnchanged()).rejects.toThrow();
    await f.restore();
    await f.verifyRestored();
    expect(db.rows('child').size).toBe(0);
    expect(db.rows('parent').size).toBe(0);
  });
});

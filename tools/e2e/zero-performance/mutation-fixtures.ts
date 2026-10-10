import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Sql } from 'postgres';
import { isLocalTestDatabase } from '../../../src/test/local-database';

export type FixtureRow = Record<string, unknown> & { id: string };
/** Stable per-attempt UUIDs; no collision with seeded or other case records. */
export function mutationFixtureID(namespace: string, label: string): string {
  const hex = createHash('sha256').update(`${namespace}:${label}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Explicit SQL fixtures only. Subjects are never invoked during setup or restoration. */
export class MutationFixtures {
  private records: { table: string; id: string; before?: FixtureRow }[] = [];
  private scopes: {
    table: string;
    column: string;
    value: string;
    before: FixtureRow[];
    prepared?: FixtureRow[];
  }[] = [];
  constructor(readonly sql: Sql) {
    const target = process.env.ZERO_UPSTREAM_DB ?? '';
    assert(
      target &&
        process.env.E2E_DATABASE_URL === target &&
        isLocalTestDatabase(target, { ...process.env, ZERO_PERFORMANCE_LAYER: 'integrity' }),
      'Mutation fixtures require the verified isolated local database (never development port 54322)'
    );
  }
  async rows(table: string, id: string): Promise<FixtureRow[]> {
    return Array.from(
      await this.sql`select * from ${this.sql(table)} where id = ${id}`
    ) as unknown as FixtureRow[];
  }
  async track(table: string, id: string) {
    if (this.records.some(row => row.table === table && row.id === id)) return;
    const [before] = await this.rows(table, id);
    this.records.push({ table, id, before });
  }
  /** Snapshot a fixture-owned FK scope before the subject creates generated-ID side effects. */
  async trackScope(table: string, column: string, value: string) {
    assert(
      !this.scopes.some(
        scope => scope.table === table && scope.column === column && scope.value === value
      ),
      'Duplicate fixture scope'
    );
    const before = (await this
      .sql`select * from ${this.sql(table)} where ${this.sql(column)} = ${value}`) as unknown as FixtureRow[];
    this.scopes.push({ table, column, value, before: Array.from(before) });
  }
  /** Capture rollback baselines after all fixture inserts, before invoking the subject. */
  async sealScopes() {
    for (const scope of this.scopes)
      scope.prepared = Array.from(
        await this
          .sql`select * from ${this.sql(scope.table)} where ${this.sql(scope.column)} = ${scope.value}`
      ) as unknown as FixtureRow[];
  }
  private finalScopeRows(scope: { table: string; before: FixtureRow[] }) {
    return scope.before.flatMap(row => {
      const record = this.records.find(item => item.table === scope.table && item.id === row.id);
      return record ? (record.before ? [record.before] : []) : [row];
    });
  }
  async insert(table: string, values: FixtureRow) {
    await this.track(table, values.id);
    assert.equal((await this.rows(table, values.id)).length, 0, `Fixture collision in ${table}`);
    await this.sql`insert into ${this.sql(table)} ${this.sql(values)}`;
  }
  async update(table: string, input: FixtureRow | string, fields?: Record<string, unknown>) {
    const values: FixtureRow = typeof input === 'string' ? { ...fields, id: input } : input;
    await this.track(table, values.id);
    await this.sql`update ${this.sql(table)} set ${this.sql(values)} where id = ${values.id}`;
  }
  async remove(table: string, id: string) {
    await this.track(table, id);
    await this.sql`delete from ${this.sql(table)} where id = ${id}`;
  }
  async expect(table: string, id: string, expected: Record<string, unknown> | null) {
    const rows = await this.rows(table, id);
    if (expected === null) {
      assert.equal(rows.length, 0, `${table} must be absent`);
      return;
    }
    assert.equal(rows.length, 1, `${table} must contain the expected record`);
    for (const [key, value] of Object.entries(expected)) {
      const actual = rows[0][key];
      assert.deepEqual(
        actual instanceof Date ? actual.toISOString() : actual,
        value instanceof Date ? value.toISOString() : value,
        `${table}.${key}`
      );
    }
  }
  async restore() {
    for (const scope of [...this.scopes].reverse()) {
      const current = (await this
        .sql`select * from ${this.sql(scope.table)} where ${this.sql(scope.column)} = ${scope.value}`) as unknown as FixtureRow[];
      for (const row of current)
        if (!scope.before.some(before => before.id === row.id))
          await this.sql`delete from ${this.sql(scope.table)} where id = ${row.id}`;
    }
    // Parents are tracked before children. Reverse order removes FK dependents first.
    for (const row of [...this.records].reverse())
      if (!row.before) await this.sql`delete from ${this.sql(row.table)} where id = ${row.id}`;
    for (const row of this.records)
      if (row.before) {
        if ((await this.rows(row.table, row.id)).length)
          await this
            .sql`update ${this.sql(row.table)} set ${this.sql(row.before)} where id = ${row.id}`;
        else await this.sql`insert into ${this.sql(row.table)} ${this.sql(row.before)}`;
      }
    // Restore original collection rows only after their original tracked parents exist.
    for (const scope of this.scopes)
      for (const before of this.finalScopeRows(scope)) {
        if ((await this.rows(scope.table, before.id)).length)
          await this
            .sql`update ${this.sql(scope.table)} set ${this.sql(before)} where id = ${before.id}`;
        else await this.sql`insert into ${this.sql(scope.table)} ${this.sql(before)}`;
      }
  }
  async verifyRestored() {
    for (const row of this.records)
      assert.deepEqual(
        await this.rows(row.table, row.id),
        row.before ? [row.before] : [],
        `Restoration proof: ${row.table}`
      );
    await this.verifyScopesUnchanged(true);
  }
  async verifyScopesUnchanged(restored = false) {
    for (const scope of this.scopes) {
      const rows = (await this
        .sql`select * from ${this.sql(scope.table)} where ${this.sql(scope.column)} = ${scope.value} order by id`) as unknown as FixtureRow[];
      assert.deepEqual(
        Array.from(rows),
        [...(restored ? this.finalScopeRows(scope) : (scope.prepared ?? scope.before))].sort(
          (a, b) => a.id.localeCompare(b.id)
        ),
        `Scope restoration proof: ${scope.table}.${scope.column}`
      );
    }
  }
}

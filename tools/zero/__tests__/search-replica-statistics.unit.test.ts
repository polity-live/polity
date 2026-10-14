import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { maintainSearchStatistics, maintainSearchReplica } from '../search-replica-statistics.mjs';

const require = createRequire(import.meta.url);
const sdkCli = require.resolve('@rocicorp/zero').replace(/zero\.js$/, 'cli.js');
const Database = createRequire(sdkCli)('@rocicorp/zero-sqlite3');
function replica(size: number, file = ':memory:') {
  const db = new Database(file);
  db.exec(
    'CREATE TABLE search_document(id TEXT PRIMARY KEY,entity_type TEXT,created_at REAL,search_text TEXT); CREATE INDEX idx_search_document_type_recent ON search_document(entity_type,created_at DESC,id DESC)'
  );
  const insert = db.prepare('INSERT INTO search_document VALUES(?,?,?,?)');
  for (let i = 0; i < size; i++) insert.run('user-' + i, 'user', i, 'user');
  db.pragma('analysis_limit=1000');
  db.pragma('optimize=0x10002');
  return db;
}
describe('bounded offline Search replica statistics', () => {
  it.each([0, 3, 1000])(
    'restores exact type-index plans before serving a small replica of %s rows',
    size => {
      const db = replica(size);
      try {
        expect(maintainSearchStatistics(db)).toMatchObject({ status: 'analyzed', rows: size });
        db.pragma('analysis_limit=1000');
        db.pragma('optimize=0x10002');
        db.exec("INSERT INTO search_document VALUES('group','group',2,'benchmark')");
        const sql =
          'SELECT * FROM search_document WHERE lower(search_text) LIKE lower(?) AND entity_type=? ORDER BY created_at DESC,id DESC';
        expect(
          db
            .prepare(sql)
            .all('%benchmark%', 'group')
            .map((row: { id: string }) => row.id)
        ).toEqual(['group']);
        expect(
          db
            .prepare('EXPLAIN QUERY PLAN ' + sql)
            .all('%benchmark%', 'group')
            .some((row: { detail: string }) =>
              row.detail.includes(
                'SEARCH search_document USING INDEX idx_search_document_type_recent'
              )
            )
        ).toBe(true);
      } finally {
        db.close();
      }
    }
  );
  it.each([1001, 10000])('caps the probe and keeps normal SDK maintenance on %s rows', size => {
    const db = replica(size);
    const exec = vi.spyOn(db, 'exec');
    try {
      expect(maintainSearchStatistics(db)).toEqual({
        status: 'large-table',
        boundedRows: 1001,
        limit: 1000,
      });
      expect(exec).not.toHaveBeenCalledWith('ANALYZE main.search_document');
    } finally {
      db.close();
    }
  });
  it('supports a publication without Search and closes a privately owned replica after success or SQL failure', () => {
    const db = new Database(':memory:');
    expect(maintainSearchStatistics(db)).toEqual({ status: 'not-published' });
    db.close();
    const directory = mkdtempSync(path.join(tmpdir(), 'polity-search-statistics-'));
    try {
      const file = path.join(directory, 'replica.db');
      const owned = replica(3, file);
      owned.close();
      expect(maintainSearchReplica(file, sdkCli)).toMatchObject({ status: 'analyzed', rows: 3 });
      expect(() => maintainSearchReplica(path.join(directory, 'missing.db'), sdkCli)).toThrow();
      const error = new Error('SQLite unavailable');
      const failing = {
        exec: () => {
          throw error;
        },
        close: vi.fn(),
      };
      expect(() => maintainSearchReplica(file, sdkCli, () => failing)).toThrow(error);
      expect(failing.close).toHaveBeenCalledOnce();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each([NaN, -1, 1002])('rolls back an invalid bounded count without ANALYZE: %s', count => {
    const db = {
      exec: vi.fn(),
      prepare: vi.fn((sql: string) => ({
        get: () => (sql.includes('sqlite_master') ? { name: 'search_document' } : { count }),
      })),
    };
    expect(() => maintainSearchStatistics(db)).toThrow('Invalid bounded');
    expect(db.exec).toHaveBeenLastCalledWith('ROLLBACK');
  });
  it('rolls back unavailable statistics and preserves the SQL failure', () => {
    const db = {
      exec: vi.fn(),
      pragma: vi.fn(),
      prepare: (sql: string) => ({
        get: () =>
          sql.includes('sqlite_master')
            ? { name: 'search_document' }
            : { count: sql.includes('sqlite_stat4') ? -1 : 3 },
      }),
    };
    expect(() => maintainSearchStatistics(db)).toThrow('Invalid Search replica statistics');
    expect(db.exec).toHaveBeenLastCalledWith('ROLLBACK');
  });
});

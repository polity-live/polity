import { createRequire } from 'node:module';

// SDK 1.10 uses approximate ANALYZE at initial sync. SQLite omits STAT4 in that
// mode, so a tiny multi-entity Search replica can choose a full table scan even
// though its (entity_type, created_at, id) index exactly matches the query.
// Run offline, between replica bootstrap and the serving process. The exclusive
// transaction also prevents a second writer from growing the table after the
// bounded probe. Large tables keep the SDK's normal approximate maintenance.
export function maintainSearchStatistics(db) {
  db.exec('BEGIN EXCLUSIVE');
  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='search_document'")
      .get();
    if (!table) {
      db.exec('COMMIT');
      return { status: 'not-published' };
    }
    const { count } = db
      .prepare('SELECT count(*) AS count FROM (SELECT 1 FROM main.search_document LIMIT 1001)')
      .get();
    if (!Number.isSafeInteger(count) || count < 0 || count > 1001)
      throw new Error('Invalid bounded Search replica row count');
    if (count > 1000) {
      db.exec('COMMIT');
      return { status: 'large-table', boundedRows: count, limit: 1000 };
    }
    const start = performance.now();
    db.pragma('analysis_limit=0');
    db.exec('ANALYZE main.search_document');
    const samples = db
      .prepare("SELECT count(*) AS count FROM sqlite_stat4 WHERE tbl='search_document'")
      .get().count;
    if (!Number.isSafeInteger(samples) || samples < 0)
      throw new Error('Invalid Search replica statistics sample count');
    db.exec('COMMIT');
    return { status: 'analyzed', rows: count, samples, elapsedMs: performance.now() - start };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openSearchReplica(file, sdkCli) {
  const sdkRequire = createRequire(sdkCli);
  const Database = sdkRequire('@rocicorp/zero-sqlite3');
  return new Database(file, { fileMustExist: true });
}

export function maintainSearchReplica(file, sdkCli, open = openSearchReplica) {
  const db = open(file, sdkCli);
  try {
    return maintainSearchStatistics(db);
  } finally {
    db.close();
  }
}

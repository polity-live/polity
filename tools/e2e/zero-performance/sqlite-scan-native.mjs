import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { captureScanStatus, instrumentStatement } from './sqlite-scan-status.mjs';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const Database = createRequire(require.resolve('@rocicorp/zero'))('@rocicorp/zero-sqlite3');
if (process.env.ZERO_PERFORMANCE_SCAN_STATUS === '1') {
  const db = new Database(':memory:');
  db.exec(
    'CREATE TABLE t(id INTEGER PRIMARY KEY,a TEXT,b TEXT); CREATE INDEX ta ON t(a); CREATE INDEX tb ON t(b)'
  );
  const statement = db.prepare('SELECT * FROM t WHERE a=? OR b=? ORDER BY a,id');
  const measured = [];
  for (const populated of [false, true]) {
    if (populated) db.exec("INSERT INTO t VALUES(1,'1','2'),(2,'2','1'),(3,'1','1')");
    for (let repeat = 0; repeat < 2; repeat++) {
      const rows = statement.all('1', '1');
      let total = 0;
      // Execute the unmodified SDK's exact COMPLEX aggregation through the installed preload.
      for (let index = 0; ; index++) {
        const count = statement.scanStatusV2(index, Database.SQLITE_SCANSTAT_NVISIT, 1);
        if (count === undefined) break;
        total += Number(count);
      }
      statement.scanStatusReset();
      assert.equal(total, populated ? 7 : 0);
      assert.equal(rows.length, populated ? 3 : 0);
      measured.push({ populated, repeat, total });
    }
  }
  db.close();
  const records = readFileSync(process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(record => record.kind === 'statement' && record.pid === process.pid);
  assert.equal(records.length, 4);
  assert.deepEqual(
    records.map(record => record.epoch),
    [0, 1, 2, 3]
  );
  assert.deepEqual(
    records.map(record => record.rawTotal),
    [-3, -3, 4, 4]
  );
  assert.deepEqual(
    records.map(record => record.total),
    [0, 0, 7, 7]
  );
  let child;
  if (!process.argv.includes('--child')) {
    child = spawnSync(process.execPath, [process.argv[1], '--child'], {
      encoding: 'utf8',
      env: process.env,
    });
    assert.equal(child.status, 0, child.stderr);
    child = JSON.parse(child.stdout);
  }
  console.log(
    JSON.stringify({ passed: 4 + (child?.passed ?? 0), measured, records, child }, null, 2)
  );
  process.exit(0);
}
const db = new Database(':memory:');
db.exec(
  'CREATE TABLE theme(id INTEGER PRIMARY KEY, kind TEXT, owner TEXT, group_id TEXT); CREATE INDEX theme_kind ON theme(kind); CREATE INDEX theme_group ON theme(group_id);'
);
const orSQL =
  'SELECT * FROM theme WHERE (kind = ? AND owner = ?) OR (kind = ? AND group_id = ?) ORDER BY kind, id';
const jsonSQL =
  'SELECT * FROM theme WHERE kind = ? AND kind IN (SELECT value FROM json_each(?)) ORDER BY id';
const reports = [];
for (const populated of [false, true]) {
  if (populated)
    db.exec(
      "INSERT INTO theme VALUES (1,'personal','owner',NULL),(2,'group','other','group'),(3,'personal','other',NULL)"
    );
  for (const [label, sql, bindings] of [
    ['multi-index-or', orSQL, ['personal', 'owner', 'group', 'group']],
    ['json-list', jsonSQL, ['personal', '["personal"]']],
    ['indexed-scan', 'SELECT * FROM theme WHERE group_id = ? ORDER BY id', ['group']],
  ]) {
    const statement = db.prepare(sql);
    const records = [];
    const rawScan = statement.scanStatusV2.bind(statement);
    const rawRows = statement.all(...bindings);
    const original = captureScanStatus(rawScan, Database);
    assert.ok(original.loops.length > 0);
    if (!populated) assert.equal(original.total, 0);
    if (label !== 'indexed-scan')
      assert.ok(original.nodes.some(node => node.rawVisits === -1 && node.name === null));
    statement.scanStatusReset();
    instrumentStatement(statement, Database, record => records.push(record));
    for (let repeat = 0; repeat < 2; repeat++) {
      const rows = statement.all(...bindings);
      assert.deepEqual(rows, rawRows);
      let total = 0;
      const explains = [];
      for (let index = 0; ; index++) {
        const count = statement.scanStatusV2(index, Database.SQLITE_SCANSTAT_NVISIT, 1);
        if (count === undefined) break;
        total += count;
        explains.push(statement.scanStatusV2(index, Database.SQLITE_SCANSTAT_EXPLAIN, 1));
      }
      assert.equal(total, original.total);
      assert.deepEqual(
        explains,
        original.nodes.map(node => node.explain)
      );
      statement.scanStatusReset();
      assert.equal(records[repeat].epoch, repeat);
      assert.equal(records[repeat].total, original.total);
      assert.equal(records[repeat].rawTotal, original.rawTotal);
      // A reset really cleared the native counters; the second execution is not cumulative.
      const reset = captureScanStatus(rawScan, Database);
      assert.equal(reset.total, 0);
    }
    reports.push({ label, populated, rows: rawRows.length, original, records });
  }
}
db.close();
console.log(JSON.stringify({ passed: reports.length * 2, reports }, null, 2));

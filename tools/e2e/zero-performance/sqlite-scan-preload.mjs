import { createRequire } from 'node:module';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { instrumentStatement, SCAN_STATUS_PROTOCOL } from './sqlite-scan-status.mjs';

if (
  process.env.ZERO_PERFORMANCE_SCAN_STATUS !== '1' ||
  !process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG ||
  !/^[a-f0-9-]{36}$/.test(process.env.ZERO_PERFORMANCE_SCAN_STATUS_RUNTIME_ID ?? '')
)
  throw new Error('SQLite scan-status adapter requires the owned benchmark runtime');
const require = createRequire(path.join(process.cwd(), 'package.json'));
const zeroRequire = createRequire(require.resolve('@rocicorp/zero'));
const Database = zeroRequire('@rocicorp/zero-sqlite3');
function packageFile(entry, name) {
  for (let directory = path.dirname(entry); ; directory = path.dirname(directory)) {
    const file = path.join(directory, 'package.json');
    if (existsSync(file) && JSON.parse(readFileSync(file, 'utf8')).name === name) return file;
    if (path.dirname(directory) === directory)
      throw new Error(`Missing package provenance: ${name}`);
  }
}
const sdk = packageFile(require.resolve('@rocicorp/zero'), '@rocicorp/zero');
const driver = packageFile(zeroRequire.resolve('@rocicorp/zero-sqlite3'), '@rocicorp/zero-sqlite3');
const sdkVersion = JSON.parse(readFileSync(sdk, 'utf8')).version;
if (!['1.9.0', '1.10.0'].includes(sdkVersion) || Database.SQLITE_SCANSTAT_COMPLEX !== 1)
  throw new Error('Unverified SQLite scan-status adapter API/version');
const tableSource = path.join(path.dirname(sdk), 'out/zqlite/src/table-source.js');
const provenance = {
  protocol: SCAN_STATUS_PROTOCOL,
  runtimeID: process.env.ZERO_PERFORMANCE_SCAN_STATUS_RUNTIME_ID,
  pid: process.pid,
  sdkVersion,
  driverVersion: JSON.parse(readFileSync(driver, 'utf8')).version,
  nodeVersion: process.version,
  tableSourceSHA256: createHash('sha256').update(readFileSync(tableSource)).digest('hex'),
};
const log = process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG;
appendFileSync(log, JSON.stringify({ kind: 'provenance', ...provenance }) + '\n');
const prepare = Database.prototype.prepare;
let statementID = 0;
Database.prototype.prepare = function (...args) {
  const id = statementID++;
  return instrumentStatement(prepare.apply(this, args), Database, record => {
    appendFileSync(
      log,
      JSON.stringify({ kind: 'statement', ...provenance, statementID: id, ...record }) + '\n'
    );
  });
};

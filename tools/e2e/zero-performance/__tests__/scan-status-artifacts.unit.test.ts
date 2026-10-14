import { afterEach, describe, expect, it } from 'vitest';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  readScanStatusArtifact,
  scanStatusCursor,
  writeScanStatusArtifact,
  validateScanStatus,
} from '../scan-status-artifacts';
import { readPerformanceReport, retainMeasurementArtifacts } from '../plan-artifacts';
import { REPETITIONS } from '../metrics';
import { SCAN_STATUS_PROTOCOL } from '../sqlite-scan-status.mjs';

const directories: string[] = [];
const previousLog = process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG;
afterEach(async () => {
  if (previousLog === undefined) delete process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG;
  else process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG = previousLog;
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
});
async function fixture() {
  const output = await mkdtemp(path.join(tmpdir(), 'polity-scan-status-'));
  directories.push(output);
  const log = path.join(output, 'raw.ndjson');
  const counts = { t: { sql: 0 } },
    sqlite = { sql: ['SEARCH t USING INDEX idx'] };
  const identity = {
    index: 0,
    name: 'idx',
    nativeNameType: 'string',
    explain: sqlite.sql[0],
    selectID: 1,
    parentID: 0,
  };
  const record = {
    kind: 'statement',
    protocol: SCAN_STATUS_PROTOCOL,
    runtimeID: '00000000-0000-4000-8000-000000000001',
    sdkVersion: '1.10.0',
    driverVersion: '0.1.0',
    nodeVersion: 'v24.18.0',
    tableSourceSHA256: 'a'.repeat(64),
    pid: 1,
    statementID: 0,
    epoch: 0,
    sql: 'sql',
    rawTotal: 0,
    total: 0,
    nodes: [{ ...identity, rawVisits: 0, loopIndex: 0, correctedVisits: 0 }],
    loops: [{ ...identity, visits: 0 }],
  };
  await writeFile(log, JSON.stringify({ ignoredEarlierExecution: true }) + '\n');
  process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG = log;
  const cursor = await scanStatusCursor();
  await appendFile(log, JSON.stringify(record) + '\n');
  const artifact = await writeScanStatusArtifact(output, 'key', cursor, counts, sqlite);
  const artifacts = [artifact];
  for (let epoch = 1; epoch <= REPETITIONS.analyze + REPETITIONS.warmup; epoch++) {
    const start = await scanStatusCursor();
    await appendFile(log, JSON.stringify({ ...record, epoch }) + '\n');
    artifacts.push(await writeScanStatusArtifact(output, `key/${epoch}`, start, counts, sqlite));
  }
  const report: any = {
    infrastructure: [],
    runtime: {
      initialSyncCopyFormat: 'text',
      ivmYieldThresholdMs: 4000,
      ivmPriorityYieldThresholdMs: 1000,
      zero: '1.10.0',
      node: 'v24.18.0',
      sqliteDriver: '0.1.0',
      scanStatusSourceSHA256: 'a'.repeat(64),
      scanStatusRuntimeID: '00000000-0000-4000-8000-000000000001',
    },
    measurements: [
      {
        key: 'key',
        analyzeMs: Array(REPETITIONS.analyze).fill(1),
        scannedRows: 0,
        plans: {
          sqlite,
          scansByQuery: counts,
          scanStatusArtifacts: artifacts.slice(0, -1),
          scanStatusExportArtifact: artifacts.at(-1),
        },
      },
    ],
  };
  const file = path.join(output, 'report.json');
  await writeFile(file, JSON.stringify(report));
  return { output, artifact, record, report, file };
}
describe('SQLite scan-status evidence integrity', () => {
  it('retains all visits when parameter-sensitive replanning changes the same SQL across fresh executions', async () => {
    const { record } = await fixture();
    const second = structuredClone(record);
    second.epoch++;
    second.nodes[0].name = 't';
    second.nodes[0].explain = 'SCAN t';
    second.nodes[0].rawVisits = second.nodes[0].correctedVisits = 7;
    second.loops[0].name = 't';
    second.loops[0].explain = 'SCAN t';
    second.loops[0].visits = 7;
    second.rawTotal = second.total = 7;
    expect(() =>
      validateScanStatus([record, second], { t: { sql: 7 } }, { sql: ['SCAN t'] })
    ).not.toThrow();
    expect(() =>
      validateScanStatus([record, second], { t: { sql: 7 } }, { sql: ['SEARCH t USING INDEX idx'] })
    ).toThrow('plan provenance mismatch');
    expect(() =>
      validateScanStatus([record, second], { t: { sql: 0 } }, { sql: ['SCAN t'] })
    ).toThrow('aggregate mismatch');
  });
  it('exports only fresh cursor executions and validates exact zero-row analysis evidence', async () => {
    const { output, artifact, file } = await fixture();
    expect((await readScanStatusArtifact(output, artifact)).records).toHaveLength(1);
    expect((await readPerformanceReport(file)).infrastructure).toEqual([]);
  });
  it('retains every worker analysis/export artifact in the published collector report', async () => {
    const { output, report } = await fixture();
    const collector = await mkdtemp(path.join(tmpdir(), 'polity-scan-collector-'));
    directories.push(collector);
    await retainMeasurementArtifacts(output, collector, report.measurements[0].plans);
    const file = path.join(collector, 'report.json');
    await writeFile(file, JSON.stringify(report));
    expect((await readPerformanceReport(file)).infrastructure).toEqual([]);
  });
  it.each(['sqlite', 'scansByQuery', 'scanStatusArtifacts', 'scanStatusExportArtifact'])(
    'rejects missing report evidence %s',
    async field => {
      const { report, file } = await fixture();
      report.measurements[0].plans = Object.fromEntries(
        Object.entries(report.measurements[0].plans).filter(([key]) => key !== field)
      );
      await writeFile(file, JSON.stringify(report));
      expect((await readPerformanceReport(file)).infrastructure).not.toEqual([]);
    }
  );
  it.each(['scannedRows', 'scansByQuery', 'sqlite'])(
    'rejects divergent report value %s',
    async field => {
      const { report, file } = await fixture();
      if (field === 'scannedRows') report.measurements[0].scannedRows = 1;
      else if (field === 'scansByQuery')
        report.measurements[0].plans.scansByQuery = { t: { sql: 1 } };
      else report.measurements[0].plans.sqlite = { sql: ['changed'] };
      await writeFile(file, JSON.stringify(report));
      expect((await readPerformanceReport(file)).infrastructure).not.toEqual([]);
    }
  );
  it('rejects changed bytes, missing files and traversal references', async () => {
    const { output, artifact } = await fixture();
    await writeFile(path.join(output, artifact.path), '{}');
    await expect(readScanStatusArtifact(output, artifact)).rejects.toThrow('integrity mismatch');
    await rm(path.join(output, artifact.path));
    await expect(readScanStatusArtifact(output, artifact)).rejects.toThrow('ENOENT');
    await expect(
      readScanStatusArtifact(output, { ...artifact, path: '../secret' })
    ).rejects.toThrow('reference');
  });
  it('rejects raw telemetry alterations even when the artifact hash is recomputed', async () => {
    const { output, artifact } = await fixture();
    const value = JSON.parse(await readFile(path.join(output, artifact.path), 'utf8'));
    value.records[0].nodes[0].correctedVisits = 1;
    const data = Buffer.from(JSON.stringify(value));
    await writeFile(path.join(output, artifact.path), data);
    await expect(
      readScanStatusArtifact(output, {
        ...artifact,
        bytes: data.length,
        sha256: createHash('sha256').update(data).digest('hex'),
      })
    ).rejects.toThrow('correction');
  });
  it('rejects reuse of one execution as another analysis or export', async () => {
    const { report, file } = await fixture();
    report.measurements[0].plans.scanStatusExportArtifact =
      report.measurements[0].plans.scanStatusArtifacts[0];
    await writeFile(file, JSON.stringify(report));
    expect((await readPerformanceReport(file)).infrastructure[0]).toContain('Reused');
  });
  it.each(['zero', 'node', 'sqliteDriver', 'scanStatusSourceSHA256'])(
    'rejects wrong associated runtime %s',
    async field => {
      const { report, file } = await fixture();
      report.runtime[field] = field === 'scanStatusSourceSHA256' ? 'b'.repeat(64) : 'different';
      await writeFile(file, JSON.stringify(report));
      expect((await readPerformanceReport(file)).infrastructure[0]).toContain(
        'provenance mismatch'
      );
    }
  );
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SCAN_STATUS_PROTOCOL } from './sqlite-scan-status.mjs';

type Counts = Record<string, Record<string, number>>;
type Plans = Record<string, string[]>;
export interface ScanStatusArtifact {
  path: string;
  sha256: string;
  bytes: number;
  count: number;
}

export async function scanStatusCursor() {
  const file = process.env.ZERO_PERFORMANCE_SCAN_STATUS_LOG;
  if (!file) throw new Error('Missing benchmark SQLite scan-status provenance log');
  return { file, offset: (await stat(file)).size };
}

/** Recompute every correction; unnamed positive sort work remains part of the metric. */
export function validateScanStatus(records: any[], counts: Counts, sqlite: Plans) {
  const actual: Record<string, number> = {};
  const lastPlans: Plans = {};
  const seen = new Set<string>();
  for (const record of records) {
    if (
      record.kind !== 'statement' ||
      record.protocol !== SCAN_STATUS_PROTOCOL ||
      !/^[a-f0-9-]{36}$/.test(record.runtimeID) ||
      !['1.9.0', '1.10.0'].includes(record.sdkVersion) ||
      typeof record.driverVersion !== 'string' ||
      typeof record.nodeVersion !== 'string' ||
      !/^[a-f0-9]{64}$/.test(record.tableSourceSHA256) ||
      !Number.isSafeInteger(record.pid) ||
      record.pid < 1 ||
      !Number.isSafeInteger(record.statementID) ||
      record.statementID < 0 ||
      !Number.isSafeInteger(record.epoch) ||
      record.epoch < 0 ||
      typeof record.sql !== 'string' ||
      !Array.isArray(record.nodes) ||
      !Array.isArray(record.loops)
    )
      throw new Error('Invalid SQLite scan-status provenance');
    const execution = `${record.runtimeID}/${record.pid}/${record.statementID}/${record.epoch}`;
    if (seen.has(execution)) throw new Error('Duplicate SQLite scan-status execution');
    seen.add(execution);
    let ordinal = 0,
      rawTotal = 0,
      total = 0;
    for (const [index, node] of record.nodes.entries()) {
      if (
        node.index !== index ||
        !Number.isSafeInteger(node.rawVisits) ||
        !Number.isSafeInteger(node.selectID) ||
        node.selectID < 0 ||
        !Number.isSafeInteger(node.parentID) ||
        node.parentID < 0 ||
        typeof node.explain !== 'string' ||
        !node.explain ||
        (node.name === null
          ? !['undefined', 'null'].includes(node.nativeNameType)
          : typeof node.name !== 'string' || !node.name || node.nativeNameType !== 'string')
      )
        throw new Error('Invalid SQLite plan-node telemetry');
      let corrected = node.rawVisits;
      if (node.name !== null) {
        const loop = record.loops[ordinal];
        if (
          !loop ||
          node.loopIndex !== ordinal ||
          loop.index !== ordinal ||
          loop.name !== node.name ||
          loop.explain !== node.explain ||
          loop.selectID !== node.selectID ||
          loop.parentID !== node.parentID ||
          !Number.isSafeInteger(loop.visits) ||
          loop.visits < 0 ||
          loop.visits !== node.rawVisits
        )
          throw new Error('SQLite natural-loop correspondence mismatch');
        ordinal++;
      } else {
        if (node.loopIndex !== null || node.rawVisits < -1)
          throw new Error('Invalid SQLite non-loop telemetry');
        if (node.rawVisits === -1) corrected = 0;
      }
      if (corrected < 0 || corrected !== node.correctedVisits)
        throw new Error('Invalid SQLite visit correction');
      rawTotal += node.rawVisits;
      total += corrected;
    }
    if (
      ordinal !== record.loops.length ||
      !Number.isSafeInteger(rawTotal) ||
      !Number.isSafeInteger(total) ||
      rawTotal !== record.rawTotal ||
      total !== record.total
    )
      throw new Error('Invalid SQLite aggregate telemetry');
    actual[record.sql] = (actual[record.sql] ?? 0) + total;
    if (!Number.isSafeInteger(actual[record.sql])) throw new Error('Unsafe SQLite SQL aggregate');
    if (!sqlite[record.sql]) throw new Error('Unexpected SQLite scan-status SQL');
    // SQLite STAT4 can replan the same prepared SQL for different bindings.
    // The SDK sums every execution's visits but recordExplain retains only the
    // last nonempty plan. Preserve all raw plans and mirror that final selection.
    const plan = record.nodes.map((node: any) => node.explain);
    if (plan.length || !lastPlans[record.sql]) lastPlans[record.sql] = plan;
  }
  const expected: Record<string, number> = {};
  for (const queries of Object.values(counts))
    for (const [sql, count] of Object.entries(queries)) {
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error('Invalid analyzer scan counts');
      expected[sql] = (expected[sql] ?? 0) + count;
      if (!Number.isSafeInteger(expected[sql])) throw new Error('Unsafe analyzer SQL aggregate');
    }
  for (const sql of new Set([
    ...Object.keys(actual),
    ...Object.keys(expected),
    ...Object.keys(sqlite),
  ])) {
    if (actual[sql] === undefined) throw new Error('Missing SQLite scan-status execution');
    assert.deepEqual(lastPlans[sql], sqlite[sql], 'SQLite plan provenance mismatch');
    if ((actual[sql] ?? 0) !== (expected[sql] ?? 0))
      throw new Error('SQLite/analyzer visit aggregate mismatch');
  }
}

export async function writeScanStatusArtifact(
  output: string,
  key: string,
  cursor: { file: string; offset: number },
  counts: Counts,
  sqlite: Plans
): Promise<ScanStatusArtifact> {
  const handle = await open(cursor.file, 'r');
  let raw: Buffer;
  try {
    const end = (await handle.stat()).size;
    if (end < cursor.offset) throw new Error('SQLite provenance log truncated');
    raw = Buffer.alloc(end - cursor.offset);
    const { bytesRead } = await handle.read(raw, 0, raw.length, cursor.offset);
    if (bytesRead !== raw.length) throw new Error('Incomplete SQLite provenance log');
  } finally {
    await handle.close();
  }
  const records = raw
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(record => record.kind === 'statement');
  validateScanStatus(records, counts, sqlite);
  const data = Buffer.from(
    JSON.stringify({ protocol: SCAN_STATUS_PROTOCOL, records, counts, sqlite })
  );
  const sha256 = createHash('sha256').update(data).digest('hex');
  const ref = {
    path: `plans/${createHash('sha256').update(key).digest('hex')}.scan-status.json`,
    sha256,
    bytes: data.length,
    count: records.length,
  };
  await mkdir(path.join(output, 'plans'), { recursive: true });
  await writeFile(path.join(output, ref.path), data);
  return ref;
}

export async function readScanStatusArtifact(output: string, value: unknown) {
  const ref = value as ScanStatusArtifact;
  if (
    !ref ||
    !/^plans\/[a-f0-9]{64}\.scan-status\.json$/.test(ref.path) ||
    !/^[a-f0-9]{64}$/.test(ref.sha256) ||
    !Number.isSafeInteger(ref.bytes) ||
    ref.bytes < 2 ||
    !Number.isSafeInteger(ref.count) ||
    ref.count < 0
  )
    throw new Error('Invalid SQLite scan-status artifact reference');
  const data = await readFile(path.join(output, ref.path));
  if (data.length !== ref.bytes || createHash('sha256').update(data).digest('hex') !== ref.sha256)
    throw new Error('SQLite scan-status artifact integrity mismatch');
  const artifact = JSON.parse(data.toString('utf8'));
  if (
    artifact.protocol !== SCAN_STATUS_PROTOCOL ||
    !Array.isArray(artifact.records) ||
    artifact.records.length !== ref.count
  )
    throw new Error('Invalid SQLite scan-status artifact contents');
  validateScanStatus(artifact.records, artifact.counts, artifact.sqlite);
  return artifact;
}

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkBudgets, type Measurement } from '../metrics';
import { correlateQueryAPI, parseQueryAPILog } from '../report';

const name = 'amendments.collaborationPageByUser';
const structure = { bytes: 13884, queries: 27, conditions: 113, maxQueryDepth: 7 };
function request(requestID = '8ed08352', at = 1000, clientCorrelationID = 'client-0') {
  return [
    { phase: 'arrival', at },
    { phase: 'auth', elapsed: 30 },
    { phase: 'transform', name, elapsed: 0.7 },
    { phase: 'query-identities', at: at + 32, queries: [{ id: 'query', name, structure }] },
    { phase: 'response', at: at + 33, elapsed: 33 },
  ].map(record => ({
    benchmark: 'query-api',
    requestID,
    clientCorrelationID,
    ...record,
  }));
}
function encode(records: unknown[], separator = '\n') {
  return Buffer.from(records.map(record => JSON.stringify(record) + separator).join(''));
}
function fixture(extra: unknown[] = []) {
  const measured = encode(
    Array.from({ length: 5 }, (_, index) =>
      request(index ? `sample-${index}` : '8ed08352', 1000, `client-${index}`)
    ).flat()
  );
  const log = Buffer.concat([measured, encode(extra)]);
  const parsed = parseQueryAPILog(log);
  const item: Measurement = {
    key: `${name}/next-page/empty/owner`,
    name,
    variant: 'next-page',
    profile: 'empty',
    actor: 'owner',
    revision: 1,
    reason: 'Initial',
    args: {},
    expectedIDs: [],
    observedIDs: Array.from({ length: 5 }, () => []),
    samples: Array.from({ length: 5 }, (_, index) => ({
      queryID: 'query',
      clientCorrelationID: `client-${index}`,
      apiLogBoundary: { source: 'app.log', byteEnd: measured.length },
      activatedAt: 20000,
      authoritativeAt: 20081,
      totalMs: 81,
      clientMs: 1,
      serverMs: 8,
      clientGroupID: `group-${index}`,
      clientID: `client-${index}`,
      connectionMs: 20,
    })),
    analyzeMs: [10],
    readRows: 0,
    scannedRows: 0,
    syncedRows: 0,
    plans: {
      sqlite: {},
      joins: [],
      scansByQuery: {},
      readsByQuery: {},
      exportMs: 1,
      exportMode: 'separate',
    },
    warnings: [],
    failures: [],
  };
  return { item, log, measured, ...parsed };
}

describe('measured query API log boundaries', () => {
  it('captures the worker boundary after elapsed/native hydration close and before analyzer execution, and shares the parent parser', () => {
    const worker = readFileSync(new URL('../measure.ts', import.meta.url), 'utf8');
    const parent = readFileSync(new URL('../collect.ts', import.meta.url), 'utf8');
    const closed = worker.indexOf('timelineTotals(timeline, elapsed, stats.hydrateTotal)');
    const captured = worker.indexOf("byteEnd: (await stat(path.join(logOutput, 'app.log'))).size");
    expect(closed).toBeGreaterThan(0);
    expect(captured).toBeGreaterThan(closed);
    expect(worker.indexOf('stats.analyze(', captured)).toBeGreaterThan(captured);
    expect(worker).toContain("parseQueryAPILog(await readFile(path.join(logOutput, 'app.log')))");
    expect(parent).toContain('parseQueryAPILog(appLogBuffer)');
    expect(parent).toContain('correlateQueryAPI(measurements, apiDiagnostics)');
    expect(parent).not.toContain(
      "appLog.split('\\n').flatMap(line => {\n    const start = line.search"
    );
  });
  it('retains a later >5s cache-expiry analyzer replay without making the measured request ambiguous', () => {
    // Zero 1.9's analyzer uses the same transform cache and forwarded client header.
    // A 6s fifth-sample CVR flush allows that cache to expire before analysis.
    const { item, records, errors } = fixture(request('f6be730f', 7420));
    expect(errors).toEqual([]);
    expect(records).toHaveLength(30);
    correlateQueryAPI([item], records);
    expect(item.samples.map(sample => sample.api?.requestID)).toEqual([
      '8ed08352',
      'sample-1',
      'sample-2',
      'sample-3',
      'sample-4',
    ]);
    expect(checkBudgets(item)).toEqual([]);
    // Parent collection and report validation repeat exactly the same selection.
    correlateQueryAPI([item], JSON.parse(JSON.stringify(records)));
    expect(checkBudgets(item)).toEqual([]);
    item.samples[0].totalMs = 6121;
    expect(checkBudgets(item)).toContain('Total exceeds 1000 ms');
  });

  it('still rejects two complete requests occurring before the observed boundary', () => {
    const { item, records, log } = fixture(request('retry', 1100));
    for (const sample of item.samples) sample.apiLogBoundary!.byteEnd = log.length;
    correlateQueryAPI([item], records);
    expect(item.samples[0].api).toBeUndefined();
    expect(checkBudgets(item)).toContain(
      'Missing or invalid correlated Auth/API/transform timings'
    );
  });

  it.each([undefined, null, 42])(
    'does not discard a matching measured identity with malformed request ID %j',
    requestID => {
      const { item, records } = fixture();
      records.push({ ...records[3], requestID });
      correlateQueryAPI([item], records);
      expect(item.samples[0].api).toBeUndefined();
    }
  );

  it('requires every request phase to end within the boundary, including a crossing response', () => {
    for (const offset of [0, 1]) {
      const { item, records } = fixture();
      item.samples[0].apiLogBoundary!.byteEnd = offset
        ? records[4].log.byteEnd - 1
        : records[3].log.byteEnd;
      correlateQueryAPI([item], records);
      expect(item.samples[0].api).toBeUndefined();
      expect(item.samples[2].api?.requestID).toBe('sample-2');
    }
  });

  it.each([
    undefined,
    { source: 'zero.log', byteEnd: 100 },
    { source: 'app.log', byteEnd: -1 },
    { source: 'app.log', byteEnd: 1.5 },
    { source: 'app.log', byteEnd: NaN },
    { source: 'app.log', byteEnd: Infinity },
    { source: 'app.log', byteEnd: Number.MAX_SAFE_INTEGER + 1 },
    { source: 'app.log', byteEnd: Number.MAX_SAFE_INTEGER },
    { source: 'app.log', byteEnd: 0 },
  ])('rejects missing, invalid or unobserved sample boundary %j', boundary => {
    const { item, records } = fixture();
    item.samples[0].apiLogBoundary = boundary as never;
    correlateQueryAPI([item], records);
    expect(item.samples[0].api).toBeUndefined();
    expect(checkBudgets(item)).toContain(
      'Missing or invalid correlated Auth/API/transform timings'
    );
  });

  it.each([
    undefined,
    { source: 'zero.log' },
    { source: 'app.log', byteStart: -1 },
    { source: 'app.log', byteStart: 1.5 },
    { source: 'app.log', byteEnd: NaN },
    { source: 'app.log', byteEnd: 0 },
    { source: 'app.log', byteEnd: Number.MAX_SAFE_INTEGER },
    { source: 'app.log', byteLength: NaN },
    { source: 'app.log', byteLength: 1 },
  ])('rejects invalid identity byte evidence instead of filtering it out: %j', evidence => {
    const { item, records } = fixture(request('analyzer', 7420));
    const identity = records.find(
      record => record.requestID === 'analyzer' && record.phase === 'query-identities'
    );
    identity.log = evidence === undefined ? undefined : { ...identity.log, ...evidence };
    correlateQueryAPI([item], records);
    expect(item.samples[0].api).toBeUndefined();
  });

  it('rejects absent or inconsistent phase byte metadata and duplicate/missing measured phases', () => {
    for (const mode of ['metadata', 'size', 'duplicate', 'missing']) {
      const { item, records } = fixture();
      if (mode === 'metadata') delete records[0].log;
      if (mode === 'size') records[0].log.byteLength++;
      if (mode === 'duplicate') records.push(records[0]);
      if (mode === 'missing') records.splice(1, 1);
      correlateQueryAPI([item], records);
      expect(item.samples[0].api, mode).toBeUndefined();
    }
  });

  it('uses physical UTF-8/CRLF byte offsets and overwrites untrusted record coordinates', () => {
    const prefix = Buffer.from('Präfix 😀\r\n');
    const raw = encode(
      request().map(record => ({ ...record, log: { byteEnd: 0 } })),
      '\r\n'
    );
    const { records, errors } = parseQueryAPILog(Buffer.concat([prefix, raw]));
    expect(errors).toEqual([]);
    expect(records[0].log).toEqual({
      source: 'app.log',
      byteStart: prefix.length,
      byteEnd: prefix.length + encode([{ ...request()[0], log: { byteEnd: 0 } }], '\r\n').length,
      byteLength: prefix.length + raw.length,
    });
    expect(records.at(-1).log.byteEnd).toBe(prefix.length + raw.length);
    const prefixed = Buffer.from('stdout: ' + JSON.stringify(request()[0]) + '\n');
    expect(parseQueryAPILog(prefixed).records[0].phase).toBe('arrival');
  });

  it('retains parser errors for malformed and incomplete diagnostics rather than manufacturing evidence', () => {
    const malformed = Buffer.from('{"benchmark":"query-api","phase":broken}\n');
    const partial = Buffer.from(JSON.stringify(request()[3]));
    const { records, errors } = parseQueryAPILog(
      Buffer.concat([encode(request()), malformed, partial])
    );
    expect(records).toHaveLength(5);
    expect(errors).toEqual(Array(2).fill('Invalid query API diagnostic record'));
    expect(parseQueryAPILog(Buffer.alloc(0))).toEqual({ records: [], errors: [] });
    expect(parseQueryAPILog(Buffer.from('unrelated trailing output')).errors).toEqual([]);
  });
});

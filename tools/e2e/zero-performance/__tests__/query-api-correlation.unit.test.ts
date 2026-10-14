import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkBudgets, type Measurement } from '../metrics';
import { captureQueryAPILogBoundary, correlateQueryAPI, parseQueryAPILog } from '../report';

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
    const captured = worker.indexOf('await captureQueryAPILogBoundary(');
    expect(closed).toBeGreaterThan(0);
    expect(captured).toBeGreaterThan(closed);
    const saved = worker.indexOf('measurement.samples.push(sample)', closed);
    expect(saved).toBeGreaterThan(closed);
    expect(saved).toBeLessThan(captured);
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

describe('query API diagnostic flush readiness', () => {
  afterEach(() => vi.useRealTimers());
  const fakeClock = () =>
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });

  it('waits for append-only handler/auth/identity/response writes without changing closed native times', async () => {
    fakeClock();
    const { item } = fixture();
    const sample = item.samples[0];
    const before = structuredClone(sample);
    const nativeRecords = [
      request()[0],
      { ...request()[0], phase: 'handler', elapsed: 0.001 },
      ...request().slice(1),
    ];
    const whole = encode(nativeRecords);
    const handler = encode(nativeRecords.slice(0, 2));
    const partial = whole.subarray(0, whole.length - 7);
    const snapshots = [handler, partial, whole];
    const read = vi.fn(async () => snapshots.shift() ?? whole);
    const pending = captureQueryAPILogBoundary(name, sample, read);
    await vi.advanceTimersByTimeAsync(40);
    expect(await pending).toEqual({ source: 'app.log', byteEnd: whole.length });
    expect(read).toHaveBeenCalledTimes(3);
    expect(sample).toEqual(before);
    expect(vi.getTimerCount()).toBe(0);
    sample.apiLogBoundary = await pending;
    correlateQueryAPI([item], parseQueryAPILog(whole).records);
    expect(sample.api?.requestID).toBe('8ed08352');
  });

  it('observes actual asynchronous file appends and keeps the eventual parent reconstruction identical', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'query-api-flush-'));
    const file = path.join(directory, 'app.log');
    try {
      const { item } = fixture();
      await writeFile(file, encode(request().slice(0, 2)));
      let reads = 0;
      const boundary = await captureQueryAPILogBoundary(name, item.samples[0], async signal => {
        const bytes = await readFile(file, { signal });
        if (++reads === 1) await appendFile(file, encode(request().slice(2)));
        return bytes;
      });
      expect(reads).toBe(2);
      item.samples[0].apiLogBoundary = boundary;
      const measured = parseQueryAPILog(await readFile(file));
      correlateQueryAPI([item], measured.records);
      const originalAPI = structuredClone(item.samples[0].api);
      await appendFile(file, encode(request('analyzer', 7420)));
      const parent = parseQueryAPILog(await readFile(file));
      expect(parent.records).toHaveLength(10);
      correlateQueryAPI([item], parent.records);
      expect(item.samples[0].api).toEqual(originalAPI);
      expect(originalAPI?.requestID).toBe('8ed08352');
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it.each(['partial-tail', 'pending-request'])(
    'does not select a complete first request before a second %s resolves into ambiguity',
    async mode => {
      fakeClock();
      const { item } = fixture();
      const first = encode(request());
      const second = encode(request('retry', 1100));
      const incomplete =
        mode === 'partial-tail'
          ? second.subarray(0, second.length - 10)
          : encode(request('retry', 1100).slice(0, 1));
      const snapshots = [Buffer.concat([first, incomplete]), Buffer.concat([first, second])];
      const read = vi.fn(async () => (snapshots.length > 1 ? snapshots.shift()! : snapshots[0]));
      const rejected = expect(
        captureQueryAPILogBoundary(name, item.samples[0], read)
      ).rejects.toThrow('readiness exceeded 1000 ms');
      await vi.advanceTimersByTimeAsync(1000);
      await rejected;
      expect(read.mock.calls.length).toBeGreaterThan(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each(['empty', 'partial', 'missing-phase', 'invalid-timing', 'malformed-identity'])(
    'fails closed within the diagnostic deadline for %s evidence',
    async mode => {
      fakeClock();
      const { item } = fixture();
      const records: any[] = request();
      if (mode === 'missing-phase') records.splice(1, 1);
      if (mode === 'invalid-timing') records.at(-1).elapsed = 100;
      if (mode === 'malformed-identity') records[3].queries = null;
      let bytes = encode(records);
      if (mode === 'empty') bytes = Buffer.alloc(0);
      if (mode === 'partial') bytes = bytes.subarray(0, bytes.length - 7);
      const rejected = expect(
        captureQueryAPILogBoundary(name, item.samples[0], async () => bytes)
      ).rejects.toThrow('readiness exceeded 1000 ms');
      await vi.advanceTimersByTimeAsync(1000);
      await rejected;
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('bounds a noncooperative stalled read and aborts its signal', async () => {
    fakeClock();
    const { item } = fixture();
    let signal: AbortSignal | undefined;
    const rejected = expect(
      captureQueryAPILogBoundary(name, item.samples[0], async supplied => {
        signal = supplied;
        return await new Promise<Buffer>(() => {
          // Deliberately ignore abort and never settle to exercise the outer deadline.
        });
      })
    ).rejects.toThrow('readiness exceeded 1000 ms');
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not accept synchronous parsing after the monotonic deadline', async () => {
    const { item } = fixture();
    const spy = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(990)
      .mockReturnValue(1001);
    try {
      await expect(
        captureQueryAPILogBoundary(name, item.samples[0], async () => encode(request()))
      ).rejects.toThrow('readiness exceeded 1000 ms');
    } finally {
      spy.mockRestore();
    }
  });

  it.each(['truncate', 'rewrite'])(
    'refuses an observed log %s rather than forgetting earlier ambiguity',
    async mode => {
      fakeClock();
      const { item } = fixture();
      const original = encode(request().slice(0, 1));
      const second = mode === 'truncate' ? Buffer.alloc(0) : encode(request('different'));
      const snapshots = [original, second];
      const rejected = expect(
        captureQueryAPILogBoundary(name, item.samples[0], async () => snapshots.shift()!)
      ).rejects.toThrow('not append-only');
      await vi.advanceTimersByTimeAsync(20);
      await rejected;
    }
  );

  it('rejects a completed malformed line or missing request ID immediately and propagates read errors', async () => {
    const { item } = fixture();
    const malformed = Buffer.from('{"benchmark":"query-api","phase":broken}\n');
    await expect(
      captureQueryAPILogBoundary(name, item.samples[0], async () => malformed)
    ).rejects.toThrow('Invalid query API diagnostic record');
    const identity: any = request()[3];
    delete identity.requestID;
    await expect(
      captureQueryAPILogBoundary(name, item.samples[0], async () => encode([identity]))
    ).rejects.toThrow('Invalid query API diagnostic request identity');
    await expect(
      captureQueryAPILogBoundary(name, item.samples[0], async () => {
        throw new Error('read failed');
      })
    ).rejects.toThrow('read failed');
  });

  it('allows a completed bootstrap request with no workload queries and unrelated client records', async () => {
    const { item } = fixture();
    const bootstrap = request('bootstrap').filter(record => record.phase !== 'transform');
    bootstrap.find(record => record.phase === 'query-identities')!.queries = [];
    const bytes = encode([...bootstrap, ...request('another-client', 1000, 'other'), ...request()]);
    await expect(
      captureQueryAPILogBoundary(name, item.samples[0], async () => bytes)
    ).resolves.toEqual({ source: 'app.log', byteEnd: bytes.length });
  });
});

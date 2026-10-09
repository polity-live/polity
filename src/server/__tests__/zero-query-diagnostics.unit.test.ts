import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryDiagnostic, queryStructure, withQueryDiagnostics } from '../zero-query-diagnostics';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('Query request diagnostics', () => {
  it('reports structure size without retaining literal query values', () => {
    const ast = {
      table: 'group',
      where: {
        type: 'and',
        conditions: [
          { type: 'simple', right: { value: 'private-secret' } },
          {
            type: 'correlatedSubquery',
            related: { subquery: { table: 'membership', where: { type: 'simple' } } },
          },
        ],
      },
    };
    const structure = queryStructure(ast);
    expect(structure).toEqual({
      bytes: Buffer.byteLength(JSON.stringify(ast)),
      queries: 2,
      conditions: 4,
      maxQueryDepth: 2,
    });
    expect(JSON.stringify(structure)).not.toContain('private-secret');
  });
  it('correlates HTTP arrival, handler and response without logging request credentials', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../../tools/e2e/zero-performance/api-timing.mjs');
    const server = createServer(async (incoming, response) => {
      const headers = new Headers();
      const id = incoming.headers['x-zero-performance-request-id'];
      if (typeof id === 'string') headers.set('x-zero-performance-request-id', id);
      const clientID = incoming.headers['x-zero-performance-client-id'];
      if (typeof clientID === 'string') headers.set('x-zero-performance-client-id', clientID);
      await withQueryDiagnostics(
        async () => {
          queryDiagnostic('auth', performance.now());
          return undefined;
        },
        { headers }
      );
      response.end('ok');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const address = server.address() as { port: number };
      await fetch(`http://127.0.0.1:${address.port}/api/query`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer credential-not-for-logs',
          'x-zero-performance-client-id': '20000000-0000-4000-8000-000000000001',
        },
        body: 'private-query-arguments',
      });
      const events = log.mock.calls.map(([value]) => JSON.parse(String(value)));
      expect(events.map(event => event.phase)).toEqual([
        'arrival',
        'handler',
        'auth',
        'request',
        'response',
      ]);
      expect(new Set(events.map(event => event.requestID)).size).toBe(1);
      expect(new Set(events.map(event => event.clientCorrelationID))).toEqual(
        new Set(['20000000-0000-4000-8000-000000000001'])
      );
      expect(events.at(-1).elapsed).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(events)).not.toMatch(
        /credential-not-for-logs|private-query-arguments|authorization/
      );
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
  it('keeps interleaved request phases correlated and is inert outside the benchmark', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '');
    await withQueryDiagnostics(async () => queryDiagnostic('auth', performance.now()));
    expect(log).not.toHaveBeenCalled();
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    await Promise.all(
      ['first', 'second'].map(name =>
        withQueryDiagnostics(async () => {
          queryDiagnostic('auth', performance.now(), { name });
          await Promise.resolve();
          queryDiagnostic('transform', performance.now(), { name });
        })
      )
    );
    const events = log.mock.calls.map(([value]) => JSON.parse(String(value)));
    const ids = ['first', 'second'].map(
      name => new Set(events.filter(event => event.name === name).map(event => event.requestID))
    );
    expect(ids.map(set => set.size)).toEqual([1, 1]);
    expect([...ids[0]][0]).not.toBe([...ids[1]][0]);
    expect(events.filter(event => event.phase === 'request')).toHaveLength(2);
    expect(events.every(event => Number.isFinite(event.elapsed) && Number.isFinite(event.at))).toBe(
      true
    );
  });
});

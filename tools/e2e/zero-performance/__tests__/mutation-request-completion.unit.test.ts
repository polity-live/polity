import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { MutationRequestCompletion } from '../mutation-request-completion';

const identity = {
  clientGroupID: 'fresh-group',
  clientID: 'fresh-client',
  name: 'amendments.update',
};
const arrival = (requestID: string, mutationID = 1, others: unknown[] = []) => ({
  benchmark: 'mutation-api',
  requestID,
  phase: 'arrival',
  at: 100,
  elapsed: 0,
  identities: [{ ...identity, mutationID }, ...others],
});
const phase = (requestID: string, name: string, at = name === 'delivery' ? 110 : 120) => ({
  benchmark: 'mutation-api',
  requestID,
  phase: name,
  at,
  elapsed: at - 100,
});
const lines = (...values: unknown[]) =>
  values.map(value => JSON.stringify(value)).join('\n') + '\n';

describe('mutation API request completion barrier', () => {
  let directory: string;
  let log: string;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'mutation-completion-'));
    log = path.join(directory, 'app.log');
    await writeFile(log, 'app startup\n');
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('does no constructor IO and fails missing log correlation without exposing data', async () => {
    const completion = new MutationRequestCompletion(path.join(directory, 'absent'));
    await expect(completion.wait(identity, 50)).rejects.toThrow(
      'Mutation request completion correlation failed'
    );
  });
  it('waits for a late partial response and returns only observed client time', async () => {
    await appendFile(log, lines(arrival('request'), phase('request', 'delivery')));
    const response = lines(phase('request', 'response'));
    await appendFile(log, response.slice(0, 30));
    const started = performance.now();
    let finished = false;
    const waiting = new MutationRequestCompletion(log).wait(identity, 300).then(value => {
      finished = true;
      return value;
    });
    await sleep(20);
    expect(finished).toBe(false);
    await appendFile(log, response.slice(30));
    const result = await waiting;
    expect(result.requestIDs).toEqual(['request']);
    expect(result.observedAt).toBeGreaterThanOrEqual(started);
    expect(result.observedAt).toBeLessThanOrEqual(performance.now());
  });
  it('retains retry attempts and ignores unrelated batch identities and records', async () => {
    await appendFile(
      log,
      lines(
        arrival('first'),
        phase('first', 'delivery'),
        phase('first', 'response'),
        arrival('retry', 1, [{ ...identity, clientID: 'unrelated-client', mutationID: 9 }]),
        { benchmark: 'query-api', args: 'ignored' }
      )
    );
    const completion = new MutationRequestCompletion(log);
    let finished = false;
    const waiting = completion.wait(identity, 300).then(value => {
      finished = true;
      return value;
    });
    await sleep(20);
    expect(finished).toBe(false);
    await appendFile(log, lines(phase('retry', 'delivery'), phase('retry', 'response')));
    expect((await waiting).requestIDs).toEqual(['first', 'retry']);
    await expect(completion.wait(identity, 100)).resolves.toMatchObject({
      requestIDs: ['first', 'retry'],
    });
  });
  it.each(['arrival', 'response', 'delivery'])('rejects duplicate %s records', async duplicate => {
    await appendFile(
      log,
      lines(
        arrival('request'),
        phase('request', 'delivery'),
        phase('request', 'response'),
        duplicate === 'arrival' ? arrival('request') : phase('request', duplicate)
      )
    );
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
  });
  it('rejects ambiguous mutation IDs across matching retry arrivals', async () => {
    await appendFile(
      log,
      lines(
        arrival('first'),
        phase('first', 'delivery'),
        phase('first', 'response'),
        arrival('second', 2),
        phase('second', 'delivery'),
        phase('second', 'response')
      )
    );
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
  });
  it.each([
    [phase('request', 'response'), phase('request', 'delivery')],
    [phase('request', 'delivery', 130), phase('request', 'response', 120)],
    [phase('request', 'response')],
  ])('rejects delivery missing or after response in stream or server time', async (...events) => {
    await appendFile(log, lines(arrival('request'), ...events));
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
  });
  it('rejects two subject IDs for the same fresh writer even if their names differ', async () => {
    await appendFile(
      log,
      lines(
        arrival('request', 1, [{ ...identity, name: 'another.subject', mutationID: 2 }]),
        phase('request', 'delivery'),
        phase('request', 'response')
      )
    );
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
  });
  it('reads bounded chunks without losing a diagnostic spanning a chunk boundary', async () => {
    const startup = 'startup log line\n'.repeat(5000);
    await appendFile(
      log,
      startup +
        lines(arrival('request'), phase('request', 'delivery'), phase('request', 'response'))
    );
    expect((await new MutationRequestCompletion(log).wait(identity, 300)).requestIDs).toEqual([
      'request',
    ]);
  });
  it.each([
    { field: 'arrival', elapsed: 0.001 },
    { field: 'response', elapsed: 19.89 },
    { field: 'response', elapsed: 20.11 },
    { field: 'delivery', elapsed: 10.11 },
    { field: 'delivery', elapsed: 21 },
  ])('rejects impossible $field duration $elapsed at the barrier', async ({ field, elapsed }) => {
    await appendFile(
      log,
      lines(
        { ...arrival('request'), ...(field === 'arrival' ? { elapsed } : {}) },
        { ...phase('request', 'delivery'), ...(field === 'delivery' ? { elapsed } : {}) },
        { ...phase('request', 'response'), ...(field === 'response' ? { elapsed } : {}) }
      )
    );
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
  });
  it('accepts emitter rounding within 0.1ms and shorter delivery work inside the request', async () => {
    await appendFile(
      log,
      lines(
        arrival('request'),
        { ...phase('request', 'delivery'), elapsed: 3 },
        { ...phase('request', 'response'), elapsed: 19.91 }
      )
    );
    expect((await new MutationRequestCompletion(log).wait(identity, 100)).requestIDs).toEqual([
      'request',
    ]);
  });
  it('rejects a delivery interval longer than total response duration within otherwise tolerated stamps', async () => {
    await appendFile(
      log,
      lines(
        arrival('request'),
        { ...phase('request', 'delivery', 120), elapsed: 20.09 },
        { ...phase('request', 'response'), elapsed: 19.91 }
      )
    );
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
  });
  it('requires an arrival and finite response diagnostics within bounded deadline', async () => {
    await appendFile(log, lines(phase('orphan', 'delivery'), phase('orphan', 'response')));
    await expect(new MutationRequestCompletion(log).wait(identity, 25)).rejects.toThrow(
      'correlation failed'
    );
    await appendFile(
      log,
      lines(arrival('request'), phase('request', 'delivery'), {
        ...phase('request', 'response'),
        elapsed: null,
      })
    );
    await expect(new MutationRequestCompletion(log).wait(identity, 25)).rejects.toThrow(
      'correlation failed'
    );
  });
  it('rejects malformed or oversized matching diagnostic lines', async () => {
    await appendFile(log, '{"benchmark":"mutation-api","phase":oops}\n');
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
    await writeFile(log, 'x'.repeat(70_000));
    await expect(new MutationRequestCompletion(log).wait(identity, 100)).rejects.toThrow(
      'correlation failed'
    );
  });
});

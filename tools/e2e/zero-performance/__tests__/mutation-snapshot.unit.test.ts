import { afterEach, describe, expect, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import type { Sql } from 'postgres';
import { rollbackDiagnostics, type RollbackCvrBinding } from '../mutation-rollback-diagnostics';
import { replicatedTimestampValues } from '../mutation-timestamp';
import {
  waitForRollback,
  waitForReadOnlyRollbackProof,
  watchMutationSnapshot,
} from '../mutation-snapshot';

function diagnosticSQL(results: unknown[][]) {
  const statements: string[] = [];
  const execute = vi.fn();
  const sql = ((input: string | TemplateStringsArray) => {
    if (typeof input === 'string') return { identifier: input };
    const index = statements.length;
    statements.push(input.join('?'));
    return {
      then(resolve?: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) {
        execute();
        return Promise.resolve(results[index]).then(resolve, reject);
      },
    };
  }) as unknown as Sql;
  return { sql, statements, execute };
}
function diagnosticWriter() {
  return {
    inspector: {
      authenticate: vi.fn(async () => true),
      client: {
        map: vi.fn(
          async () =>
            new Map<string, unknown>([
              [
                'e/action_right/fixture-right',
                {
                  id: 'fixture-right',
                  role_id: 'fixture-role',
                  event_id: 'fixture-event',
                  resource: 'events',
                  action: 'manage_votes',
                  created_at: 1_791_684_800_000.006,
                  name: 'private application content',
                },
              ],
            ])
        ),
        queries: vi.fn(async () => [
          {
            id: 'query-id',
            name: 'votes.byId',
            got: true,
            ttl: 'none',
            inactivatedAt: null,
            rowCount: 27,
            deleted: false,
            args: ['private query argument'],
            serverZQL: 'private SQL',
          },
        ]),
      },
    },
  };
}

describe('failure-only rollback evidence', () => {
  it('forwards SDK class methods and getters with their real private-field receiver', async () => {
    class Client {
      #id = 'private-field-client';
      get id() {
        return this.#id;
      }
      async map() {
        return new Map<string, unknown>();
      }
      async queries() {
        return [{ id: this.#id }];
      }
    }
    class Inspector {
      #client = new Client();
      #password = 'private-field-password';
      get client() {
        return this.#client;
      }
      async authenticate(password: string) {
        return password === this.#password;
      }
    }
    class Writer {
      #inspector = new Inspector();
      #clientID = 'private-field-writer';
      get clientID() {
        return this.#clientID;
      }
      get inspector() {
        return this.#inspector;
      }
    }
    const source = diagnosticSQL([]);
    const trace = rollbackDiagnostics(source.sql);
    await trace.verify(new Writer(), async observed => {
      const writer = observed as Writer;
      expect(writer.clientID).toBe('private-field-writer');
      const inspector = writer.inspector;
      expect(await inspector.authenticate('private-field-password')).toBe(true);
      expect(inspector.authenticate).toBe(inspector.authenticate);
      expect(inspector.client.id).toBe('private-field-client');
      expect(await inspector.client.queries()).toEqual([{ id: 'private-field-client' }]);
      expect(inspector.client.queries).toBe(inspector.client.queries);
      expect(await inspector.client.map()).toEqual(new Map());
    });
    expect(source.execute).not.toHaveBeenCalled();
  });
  it('observes only the oracle awaits and performs no success SQL or metadata reads', async () => {
    const source = diagnosticSQL([
      [{ id: 'fixture-right' }],
      [{ microseconds: '845000000000006' }],
    ]);
    const trace = rollbackDiagnostics(source.sql);
    const writer = diagnosticWriter();
    await trace.verify(writer, async observed => {
      await (observed as typeof writer).inspector.client.map();
      const pending = trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`;
      expect(source.execute).not.toHaveBeenCalled();
      expect(await pending).toHaveLength(1);
      expect(
        await replicatedTimestampValues(trace.sql, 'action_right', 'created_at', 'fixture-right')
      ).toEqual([1_791_684_800_000.0059, 1_791_684_800_000.006]);
    });
    expect(source.execute).toHaveBeenCalledTimes(2);
    expect(source.statements).toHaveLength(2);
    expect(writer.inspector.client.map).toHaveBeenCalledTimes(1);
    expect(await trace.failure(new Error('unrelated'), writer, 'private password')).toBeUndefined();
    expect(writer.inspector.authenticate).not.toHaveBeenCalled();
    expect(writer.inspector.client.queries).not.toHaveBeenCalled();
  });
  it('retains the identical row assertion, precise row identity and sanitized metadata', async () => {
    const source = diagnosticSQL([[]]);
    const trace = rollbackDiagnostics(source.sql);
    const writer = diagnosticWriter();
    const original = new assert.AssertionError({
      actual: 0,
      expected: 1,
      message: 'Rollback row proof: action_right',
    });
    original.stack =
      'private assertion diff\n at verify (C:/private/mutation-cases-governance-revocation.ts:234:12)';
    await expect(
      trace.verify(writer, async observed => {
        await (observed as typeof writer).inspector.client.map();
        await trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`;
        throw original;
      })
    ).rejects.toBe(original);
    const diagnostic = await trace.failure(original, writer, 'private password');
    expect(diagnostic?.assertion).toEqual({
      proof: 'Rollback row proof: action_right',
      origin: 'row-select',
      frames: ['mutation-cases-governance-revocation.ts:234:12'],
    });
    expect(diagnostic?.inspector).toMatchObject({
      key: 'e/action_right/fixture-right',
      table: 'action_right',
      id: 'fixture-right',
      row: { id: 'fixture-right', role_id: 'fixture-role', action: 'manage_votes' },
    });
    expect(diagnostic?.reads).toEqual([
      {
        kind: 'row-select',
        table: 'action_right',
        id: 'fixture-right',
        at: expect.any(Number),
        rowCount: 0,
      },
    ]);
    expect(diagnostic?.queries).toEqual([
      {
        id: 'query-id',
        name: 'votes.byId',
        got: true,
        ttl: 'none',
        inactivatedAt: null,
        rowCount: 27,
        deleted: false,
      },
    ]);
    expect(diagnostic?.queryInspection).toBe('complete');
    expect(JSON.stringify(diagnostic)).not.toContain('private');
    expect(source.execute).toHaveBeenCalledTimes(1);
  });
  it('distinguishes the original timestamp read and retains preceding full SQL precision', async () => {
    const source = diagnosticSQL([
      [{ created_at: new Date() }],
      [{ microseconds: '845000000000006' }],
      [],
    ]);
    const trace = rollbackDiagnostics(source.sql);
    const writer = diagnosticWriter();
    let original: unknown;
    try {
      await trace.verify(writer, async observed => {
        await (observed as typeof writer).inspector.client.map();
        await trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`;
        await replicatedTimestampValues(trace.sql, 'action_right', 'created_at', 'fixture-right');
        await replicatedTimestampValues(trace.sql, 'action_right', 'updated_at', 'fixture-right');
      });
    } catch (error) {
      original = error;
    }
    expect(original).toBeInstanceOf(assert.AssertionError);
    const diagnostic = await trace.failure(original, writer, undefined);
    expect(diagnostic?.assertion.origin).toBe('timestamp-select');
    expect(diagnostic?.assertion.frames[0]).toMatch(/^mutation-timestamp\.ts:\d+:\d+$/);
    expect(diagnostic?.reads.map(({ at: _at, ...read }) => read)).toEqual([
      { kind: 'row-select', table: 'action_right', id: 'fixture-right', rowCount: 1 },
      {
        kind: 'timestamp-select',
        table: 'action_right',
        id: 'fixture-right',
        column: 'created_at',
        rowCount: 1,
        microseconds: ['845000000000006'],
      },
      {
        kind: 'timestamp-select',
        table: 'action_right',
        id: 'fixture-right',
        column: 'updated_at',
        rowCount: 0,
        microseconds: [],
      },
    ]);
    expect(writer.inspector.client.queries).not.toHaveBeenCalled();
    expect(source.execute).toHaveBeenCalledTimes(3);
  });
  it('keeps evidence for an earlier mismatch when the original rollback deadline rejects', async () => {
    vi.useFakeTimers();
    const source = diagnosticSQL([[]]);
    const trace = rollbackDiagnostics(source.sql);
    const writer = diagnosticWriter();
    const original = new assert.AssertionError({
      actual: 0,
      expected: 1,
      message: 'Rollback row proof: action_right',
    });
    let attempt = 0;
    const proof = waitForReadOnlyRollbackProof(
      'delegated-authority-revoked-after-preload',
      () =>
        trace.verify(writer, async observed => {
          await (observed as typeof writer).inspector.client.map();
          if (++attempt === 1) {
            await trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`;
            throw original;
          }
          await new Promise<void>(() => undefined);
        }),
      20
    );
    const rejected = expect(proof).rejects.toBe(original);
    await vi.advanceTimersByTimeAsync(20);
    await rejected;
    const diagnostic = await trace.failure(original, writer, undefined);
    expect(diagnostic?.inspector?.snapshot).toBe(1);
    expect(diagnostic?.reads[0].rowCount).toBe(0);
  });
  it('bounds failing query metadata without replacing or leaking the assertion', async () => {
    vi.useFakeTimers();
    const source = diagnosticSQL([[]]);
    const trace = rollbackDiagnostics(source.sql);
    const writer = diagnosticWriter();
    const original = new assert.AssertionError({ message: 'Rollback row proof: action_right' });
    await expect(
      trace.verify(writer, async observed => {
        await (observed as typeof writer).inspector.client.map();
        await trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`;
        throw original;
      })
    ).rejects.toBe(original);
    writer.inspector.authenticate.mockRejectedValueOnce(new Error('private RPC error'));
    expect((await trace.failure(original, writer, 'private password'))?.queryInspection).toBe(
      'failed'
    );
    writer.inspector.client.queries.mockImplementationOnce(() => new Promise(() => undefined));
    const diagnostic = trace.failure(original, writer, 'private password');
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await diagnostic)?.queryInspection).toBe('timed-out');
    let finishAuthentication!: (authenticated: boolean) => void;
    writer.inspector.authenticate.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishAuthentication = resolve;
        })
    );
    const late = trace.failure(original, writer, 'private password');
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await late)?.queryInspection).toBe('timed-out');
    const calls = writer.inspector.client.queries.mock.calls.length;
    finishAuthentication(true);
    await Promise.resolve();
    expect(writer.inspector.client.queries).toHaveBeenCalledTimes(calls);
    expect(original.message).toBe('Rollback row proof: action_right');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves proof failures when the raw snapshot lacks a valid captured row', async () => {
    const source = diagnosticSQL([[]]);
    const trace = rollbackDiagnostics(source.sql);
    const writer = diagnosticWriter();
    writer.inspector.client.map.mockResolvedValueOnce(
      new Map([
        ['m/fixture-client/1', {}],
        ['e/action_right/fixture-right', null],
        ['e/action_right/missing-id', { name: 'private content' }],
      ])
    );
    const original = new assert.AssertionError({ message: 'Rollback row proof: action_right' });
    await expect(
      trace.verify(writer, async observed => {
        await (observed as typeof writer).inspector.client.map();
        await trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`;
        throw original;
      })
    ).rejects.toBe(original);
    const diagnostic = await trace.failure(original, writer, undefined);
    expect(diagnostic?.inspector).toBeNull();
    expect(diagnostic?.cvrRow).toEqual({ status: 'unavailable' });
    expect(source.execute).toHaveBeenCalledOnce();
    expect(JSON.stringify(diagnostic)).not.toContain('private');
  });
  it.each([
    new Error('private non-assertion failure'),
    new assert.AssertionError({ message: 'Unrelated assertion' }),
  ])('does not capture unrelated failures or issue diagnostic SQL', async original => {
    const source = diagnosticSQL([]);
    const connect = vi.fn();
    const trace = rollbackDiagnostics(source.sql, connect as never);
    const writer = diagnosticWriter();
    await expect(
      trace.verify(writer, async () => {
        throw original;
      })
    ).rejects.toBe(original);
    expect(await trace.failure(original, writer, 'private password')).toBeUndefined();
    expect(source.execute).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(writer.inspector.authenticate).not.toHaveBeenCalled();
  });
  it('forwards unrelated lazy SQL unchanged without activating failure diagnostics', async () => {
    const source = diagnosticSQL([[]]);
    const connect = vi.fn();
    const trace = rollbackDiagnostics(source.sql, connect as never);
    await trace.verify(diagnosticWriter(), async () => {
      const pending = trace.sql`select 1`;
      expect(source.execute).not.toHaveBeenCalled();
      expect(await pending).toEqual([]);
    });
    expect(source.execute).toHaveBeenCalledOnce();
    expect(connect).not.toHaveBeenCalled();
  });
  it('preserves an unmodified missing-inspector assertion and omitted stack/read evidence', async () => {
    const source = diagnosticSQL([]);
    const trace = rollbackDiagnostics(source.sql);
    const original = new assert.AssertionError({ message: 'Rollback row proof: action_right' });
    original.stack = undefined;
    await expect(
      trace.verify(undefined, async observed => {
        expect(observed).toBeUndefined();
        throw original;
      })
    ).rejects.toBe(original);
    const diagnostic = await trace.failure(original, undefined, 'private password');
    expect(diagnostic).toEqual({
      assertion: { proof: 'Rollback row proof: action_right', origin: 'unknown', frames: [] },
      inspector: null,
      reads: [],
      queries: [],
      queryInspection: 'unavailable',
      cvrRow: { status: 'unavailable' },
    });
    expect(await trace.failure('non-error', undefined, undefined)).toBeUndefined();
    expect(source.execute).not.toHaveBeenCalled();
  });
  it('forwards inactive SQL and unsupported identifier contracts without inferring proof reads', async () => {
    const source = diagnosticSQL([[], [], [], []]);
    const trace = rollbackDiagnostics(source.sql);
    expect(
      await trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`
    ).toEqual([]);
    await trace.verify(diagnosticWriter(), async () => {
      expect(trace.sql('schema.table')).toEqual({ identifier: 'schema.table' });
      expect(
        await trace.sql`select * from ${'action_right'} where id = ${'fixture-right'}`
      ).toEqual([]);
      expect(await trace.sql`select * from ${trace.sql('action_right')} where id = ${1}`).toEqual(
        []
      );
      expect(
        await trace.sql`select (extract(epoch from ${'created_at'}) * 1000000 - 946684800000000)::bigint::text as microseconds from ${trace.sql('action_right')} where id = ${'fixture-right'}`
      ).toEqual([]);
    });
    expect(source.execute).toHaveBeenCalledTimes(4);
    // A broken adapter's missing identifier must also pass through to its own oracle.
    const missing = rollbackDiagnostics((() => null) as unknown as Sql);
    await missing.verify(undefined, async () => {
      expect(missing.sql('action_right')).toBeNull();
      expect(
        await missing.sql`select * from ${missing.sql('action_right')} where id = ${'fixture-right'}`
      ).toBeNull();
    });
  });
  it('forwards PendingQuery methods and then-without-callback after observation closes', async () => {
    class Pending {
      #result = [{ id: 'fixture-right' }];
      get length() {
        return this.#result.length;
      }
      result() {
        return this.#result;
      }
      then(resolve?: (rows: { id: string }[]) => unknown, reject?: (error: unknown) => unknown) {
        return Promise.resolve(this.#result).then(resolve, reject);
      }
    }
    const source = ((input: string | TemplateStringsArray) =>
      typeof input === 'string' ? { identifier: input } : new Pending()) as unknown as Sql;
    const trace = rollbackDiagnostics(source);
    let pending!: ReturnType<Sql>;
    await trace.verify(diagnosticWriter(), async () => {
      pending = trace.sql`select * from ${trace.sql('action_right')} where id = ${'fixture-right'}`;
      const query = pending as unknown as Pending;
      expect(query.length).toBe(1);
      expect(query.result()).toEqual([{ id: 'fixture-right' }]);
      expect(query.result).toBe(query.result);
    });
    expect(await pending.then()).toEqual([{ id: 'fixture-right' }]);
  });
  it('ignores a fresh map that resolves after the original observation ended', async () => {
    let resolveMap!: (rows: Map<string, unknown>) => void;
    const writer = diagnosticWriter();
    writer.inspector.client.map.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveMap = resolve;
        })
    );
    const source = diagnosticSQL([]);
    const trace = rollbackDiagnostics(source.sql);
    let pending!: Promise<Map<string, unknown>>;
    const original = new assert.AssertionError({ message: 'Rollback row proof: action_right' });
    await expect(
      trace.verify(writer, async observed => {
        pending = (observed as typeof writer).inspector.client.map();
        throw original;
      })
    ).rejects.toBe(original);
    resolveMap(new Map([['e/action_right/fixture-right', { id: 'fixture-right' }]]));
    expect(await pending).toEqual(
      new Map([['e/action_right/fixture-right', { id: 'fixture-right' }]])
    );
    expect((await trace.failure(original, writer, undefined))?.inspector).toBeNull();
    expect(source.execute).not.toHaveBeenCalled();
  });
  it('contains authentication denial and ignores query metadata arriving after its deadline', async () => {
    vi.useFakeTimers();
    const source = diagnosticSQL([]);
    const trace = rollbackDiagnostics(source.sql);
    const writer = diagnosticWriter();
    const original = new assert.AssertionError({ message: 'Rollback row proof: action_right' });
    await expect(
      trace.verify(writer, async () => {
        throw original;
      })
    ).rejects.toBe(original);
    writer.inspector.authenticate.mockResolvedValueOnce(false);
    expect((await trace.failure(original, writer, 'private password'))?.queryInspection).toBe(
      'failed'
    );
    expect(writer.inspector.client.queries).not.toHaveBeenCalled();
    let resolveQueries!: (
      rows: Awaited<ReturnType<typeof writer.inspector.client.queries>>
    ) => void;
    writer.inspector.client.queries.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveQueries = resolve;
        })
    );
    const pending = trace.failure(original, writer, 'private password');
    await vi.advanceTimersByTimeAsync(1_000);
    const diagnostic = await pending;
    expect(diagnostic?.queryInspection).toBe('timed-out');
    resolveQueries([
      {
        id: 'late',
        name: 'private query',
        got: true,
        ttl: 'none',
        inactivatedAt: null,
        rowCount: 1,
        deleted: false,
        args: [],
        serverZQL: 'private',
      },
    ]);
    await Promise.resolve();
    expect(diagnostic?.queries).toEqual([]);
    expect(diagnostic?.queryInspection).toBe('timed-out');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('failure-only exact persisted CVR row evidence', () => {
  const id = '3873aa0b-5f37-440a-8e4e-cc2433bc4bd8';
  const binding: RollbackCvrBinding = {
    clientGroupID: '6ve7nhc3uacu10m7d1',
    databaseURL: 'postgres://fixture:secret@127.0.0.1:15915/fixture',
    cvrDatabaseURL: 'postgres://fixture:secret@127.0.0.1:15915/fixture',
    appID: 'zero',
    shardNum: '0',
  };
  const row = {
    clientGroupID: binding.clientGroupID,
    rowKey: { id },
    rowVersion: '51osfwg',
    patchVersion: '51osfwg:01',
    rowsVersion: '51osfwg:01',
    instanceVersion: '51osfwg:02',
    refCounts: { ib3uxghcg7oh: 1 },
  };
  async function retained(
    result: unknown[] = [row],
    rejection?: Error,
    table = 'action_right',
    capturedID = id
  ) {
    const source = diagnosticSQL([[]]);
    Object.assign(source.sql, {
      options: {
        host: ['127.0.0.1'],
        port: [15915],
        database: 'fixture',
        user: 'fixture',
        pass: 'secret',
      },
    });
    const end = vi.fn(async () => undefined);
    const cancel = vi.fn();
    const pending = Object.assign(rejection ? Promise.reject(rejection) : Promise.resolve(result), {
      cancel,
    });
    // Suppress only the fixture's pre-execution rejection until the lazy query is used.
    void pending.catch(() => undefined);
    const unsafe = vi.fn(() => pending);
    const connect = vi.fn((_endpoint: string, options: { onnotice?: () => void }) => {
      options.onnotice?.();
      return { unsafe, end };
    });
    const trace = rollbackDiagnostics(source.sql, connect as never);
    const writer = diagnosticWriter();
    writer.inspector.client.map.mockResolvedValueOnce(
      new Map([[`e/${table}/${capturedID}`, { id: capturedID }]])
    );
    const original = new assert.AssertionError({ message: `Rollback row proof: ${table}` });
    await expect(
      trace.verify(writer, async observed => {
        await (observed as typeof writer).inspector.client.map();
        await trace.sql`select * from ${trace.sql(table)} where id = ${capturedID}`;
        throw original;
      })
    ).rejects.toBe(original);
    return { trace, writer, original, source, connect, unsafe, end, cancel };
  }
  it('reads the pinned SDK physical row contract with exact parameters', async () => {
    const test = await retained();
    expect(test.connect).not.toHaveBeenCalled();
    const diagnostic = await test.trace.failure(test.original, test.writer, undefined, binding);
    expect(diagnostic?.cvrRow).toEqual({
      status: 'complete',
      classification: 'referenced',
      identity: {
        clientGroupID: binding.clientGroupID,
        schema: '',
        table: 'action_right',
        rowKey: { id },
      },
      rowVersion: row.rowVersion,
      patchVersion: row.patchVersion,
      rowsVersion: row.rowsVersion,
      instanceVersion: row.instanceVersion,
      refCounts: row.refCounts,
    });
    expect(test.connect).toHaveBeenCalledWith(
      binding.databaseURL,
      expect.objectContaining({
        max: 1,
        prepare: false,
        connect_timeout: 1,
        connection: {
          application_name: 'rollback-cvr-diagnostic',
          default_transaction_read_only: true,
          statement_timeout: 750,
        },
      })
    );
    const [statement, parameters] = test.unsafe.mock.calls[0] as unknown as [string, unknown[]];
    expect(statement).toContain('LEFT JOIN "zero_0/cvr".rows');
    expect(statement).toContain("r.schema = '' AND r.table = 'action_right'");
    expect(statement).not.toContain(id);
    expect(parameters).toEqual([binding.clientGroupID, { id }]);
    expect(test.source.execute).toHaveBeenCalledTimes(1);
    expect(test.end).toHaveBeenCalledWith({ timeout: 0 });
    expect(test.writer.inspector.authenticate).not.toHaveBeenCalled();
    expect(JSON.stringify(diagnostic)).not.toMatch(/secret|postgres:|fixture/);
  });
  it.each([
    [{ ...row, refCounts: null }, 'tombstone'],
    [{ ...row, refCounts: {} }, 'unreferenced'],
    [{ ...row, refCounts: { ib3uxghcg7oh: 0 } }, 'unreferenced'],
    [{ ...row, clientGroupID: null, rowKey: null, refCounts: null }, 'absent'],
  ])(
    'distinguishes persisted row state without accepting the failed proof',
    async (value, classification) => {
      const test = await retained([value]);
      const diagnostic = await test.trace.failure(test.original, test.writer, undefined, binding);
      expect(diagnostic?.cvrRow?.classification).toBe(classification);
      expect(test.original.message).toBe('Rollback row proof: action_right');
      expect(diagnostic?.reads[0].rowCount).toBe(0);
      expect(test.source.execute).toHaveBeenCalledTimes(1);
    }
  );
  it.each([
    { ...binding, cvrDatabaseURL: binding.databaseURL + '-other' },
    { ...binding, databaseURL: 'invalid', cvrDatabaseURL: 'invalid' },
    { ...binding, appID: 'unsafe"schema' },
    { ...binding, shardNum: '-1' },
    { ...binding, clientGroupID: undefined },
    { ...binding, clientGroupID: 'private group contents' },
    ...[
      'https://fixture:secret@127.0.0.1:15915/fixture',
      binding.databaseURL + '?unsafe=true',
      binding.databaseURL + '#fragment',
      binding.databaseURL?.replace('127.0.0.1', 'localhost'),
      binding.databaseURL?.replace('/fixture', '/other'),
      binding.databaseURL?.replace('fixture:secret', 'other:secret'),
      binding.databaseURL?.replace(':secret@', ':other@'),
    ].map(databaseURL => ({ ...binding, databaseURL, cvrDatabaseURL: databaseURL })),
    undefined,
  ])('does not connect without an explicit matching safe binding', async declared => {
    const test = await retained();
    expect(
      (await test.trace.failure(test.original, test.writer, undefined, declared))?.cvrRow
    ).toEqual({ status: 'unavailable' });
    expect(test.connect).not.toHaveBeenCalled();
  });
  it('rejects a declared endpoint that differs from the actual fixture connection', async () => {
    const test = await retained();
    test.source.sql.options.port[0] = 15916;
    expect(
      (await test.trace.failure(test.original, test.writer, undefined, binding))?.cvrRow?.status
    ).toBe('unavailable');
    expect(test.connect).not.toHaveBeenCalled();
  });
  it.each([
    ['other_table', id],
    ['action_right', 'compound-key'],
  ])('does not guess unsupported tables or row keys', async (table, capturedID) => {
    const test = await retained([row], undefined, table, capturedID);
    expect(
      (await test.trace.failure(test.original, test.writer, undefined, binding))?.cvrRow
    ).toEqual({ status: 'unavailable' });
    expect(test.connect).not.toHaveBeenCalled();
  });
  it('performs no CVR SQL for success or an unretained failure', async () => {
    const test = await retained();
    await test.trace.verify(test.writer, async () => undefined);
    expect(
      await test.trace.failure(new Error('unretained'), test.writer, undefined, binding)
    ).toBeUndefined();
    expect(test.connect).not.toHaveBeenCalled();
  });
  it.each(
    [
      [],
      [row, row],
      [{ ...row, rowKey: { id, extra: 'private' } }],
      [{ ...row, rowVersion: 'private content' }],
      [{ ...row, rowsVersion: 'private content' }],
      [{ ...row, instanceVersion: undefined }],
      [{ ...row, clientGroupID: 'other' }],
      [{ ...row, refCounts: { 'private query data': 1 } }],
      [{ ...row, refCounts: { ib3uxghcg7oh: -1 } }],
      [{ ...row, refCounts: { ib3uxghcg7oh: 1.5 } }],
      [{ ...row, refCounts: [] }],
    ].map(result => ({ result }))
  )(
    'fails closed on malformed/ambiguous CVR results without exporting contents',
    async ({ result }) => {
      const test = await retained(result);
      const diagnostic = await test.trace.failure(test.original, test.writer, undefined, binding);
      expect(diagnostic?.cvrRow).toEqual({ status: 'failed' });
      expect(JSON.stringify(diagnostic)).not.toContain('private');
      expect(test.end).toHaveBeenCalledWith({ timeout: 0 });
    }
  );
  it('sanitizes SQL rejection and closes the dedicated connection', async () => {
    const test = await retained([], new Error('postgres://secret private error'));
    expect(
      (await test.trace.failure(test.original, test.writer, undefined, binding))?.cvrRow
    ).toEqual({ status: 'failed' });
    expect(test.end).toHaveBeenCalledWith({ timeout: 0 });
    expect(test.original.message).toBe('Rollback row proof: action_right');
  });
  it('contains constructor and close errors without replacing the failed proof', async () => {
    const test = await retained();
    test.connect.mockImplementationOnce(() => {
      throw new Error('private connection details');
    });
    expect(
      (await test.trace.failure(test.original, test.writer, undefined, binding))?.cvrRow
    ).toEqual({ status: 'failed' });
    expect(test.end).not.toHaveBeenCalled();
    test.end.mockRejectedValueOnce(new Error('private close details'));
    expect(
      (await test.trace.failure(test.original, test.writer, undefined, binding))?.cvrRow
        ?.classification
    ).toBe('referenced');
    expect(test.original.message).toBe('Rollback row proof: action_right');
  });
  it('cancels an unresolved read, closes immediately and ignores its late result', async () => {
    vi.useFakeTimers();
    const test = await retained();
    let resolve!: (rows: unknown[]) => void;
    test.unsafe.mockImplementationOnce(
      () =>
        Object.assign(
          new Promise<unknown[]>(done => {
            resolve = done;
          }),
          { cancel: test.cancel }
        ) as never
    );
    const pending = test.trace.failure(test.original, test.writer, undefined, binding);
    await vi.advanceTimersByTimeAsync(1_000);
    const diagnostic = await pending;
    expect(diagnostic?.cvrRow).toEqual({ status: 'timed-out' });
    expect(test.cancel).toHaveBeenCalledOnce();
    expect(test.end).toHaveBeenCalledWith({ timeout: 0 });
    resolve([row]);
    await Promise.resolve();
    expect(diagnostic?.cvrRow).toEqual({ status: 'timed-out' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

afterEach(() => vi.useRealTimers());
describe('mutation snapshot and rollback proof', () => {
  it('requires a replicated response for the writing client, not an HTTP ACK', async () => {
    vi.useFakeTimers();
    const map = new Map<string, unknown>([['m/other-client/1', {}]]);
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: { client: { map: async () => map } },
    });
    let settled = false;
    void watcher.promise.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(settled).toBe(false);
    expect(watcher.diagnostics.state).toBe('missing-marker');
    map.set('m/writer/1', { error: 'app', message: 'private fixture content' });
    await vi.advanceTimersByTimeAsync(5);
    expect(await watcher.promise).toEqual({ mutationID: 1, at: expect.any(Number) });
    expect(watcher.diagnostics.state).toBe('applied');
  });
  it('rejects ambiguous responses in a purported fresh writer', async () => {
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: {
        client: {
          map: async () =>
            new Map([
              ['m/writer/1', {}],
              ['m/writer/2', {}],
            ]),
        },
      },
    });
    await expect(watcher.promise).rejects.toThrow('ambiguous');
    expect(watcher.diagnostics.state).toBe('invalid-response');
  });
  it('distinguishes inspector map rejection without exporting its private error', async () => {
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: {
        client: {
          map: async () => {
            throw new Error('private map error');
          },
        },
      },
    });
    await expect(watcher.promise).rejects.toThrow('private map error');
    expect(watcher.diagnostics).toEqual({ state: 'map-rejected' });
    expect(JSON.stringify(watcher.diagnostics)).not.toContain('private');
  });
  it('cancels unresolved polling without leaking a timer', async () => {
    vi.useFakeTimers();
    const map = vi.fn(async () => new Map<string, unknown>());
    const watcher = watchMutationSnapshot({ clientID: 'writer', inspector: { client: { map } } });
    await vi.advanceTimersByTimeAsync(5);
    watcher.cancel();
    const calls = map.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(map).toHaveBeenCalledTimes(calls);
    expect(await watcher.promise).toBeUndefined();
  });
  it('does not inspect a pending map result after the watcher was cancelled', async () => {
    let resolveMap!: (value: Map<string, unknown>) => void;
    const watcher = watchMutationSnapshot({
      clientID: 'writer',
      inspector: {
        client: {
          map: () =>
            new Promise(resolve => {
              resolveMap = resolve;
            }),
        },
      },
    });
    watcher.cancel();
    resolveMap(new Map([['m/writer/1', {}]]));
    await expect(watcher.promise).resolves.toBeUndefined();
    expect(watcher.diagnostics.state).toBe('missing-marker');
  });
  it('waits for optimistic rollback after a delayed server snapshot', async () => {
    vi.useFakeTimers();
    let state = { title: 'optimistic' };
    let proved = false;
    const proof = waitForRollback(() => state, { title: 'original' }).then(() => {
      proved = true;
    });
    await vi.advanceTimersByTimeAsync(15);
    expect(proved).toBe(false);
    state = { title: 'original' };
    await vi.advanceTimersByTimeAsync(5);
    await proof;
    expect(proved).toBe(true);
  });
  it('compares complete business data without Zero bookkeeping symbols or object prototypes', async () => {
    const state = Object.assign(Object.create(null), {
      title: 'original',
      relations: [{ id: 'child' }],
      [Symbol('rc')]: 1,
    });
    await expect(waitForRollback(() => state, structuredClone(state), 20)).resolves.toBeUndefined();
    vi.useFakeTimers();
    const changed = Object.assign(Object.create(null), {
      title: 'original',
      relations: [{ id: 'changed' }],
    });
    const proof = waitForRollback(() => changed, structuredClone(state), 20);
    const assertion = expect(proof).rejects.toThrow('not rolled back');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });
  it('fails if a rejected optimistic change remains', async () => {
    vi.useFakeTimers();
    const proof = waitForRollback(() => ({ title: 'optimistic' }), { title: 'original' }, 20);
    const assertion = expect(proof).rejects.toThrow('not rolled back');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });
});

describe('revision-owned read-only SQL rollback proofs', () => {
  const delegated = 'delegated-authority-revoked-after-preload';
  const mismatch = (label: string) =>
    new assert.AssertionError({ message: label, actual: 0, expected: 1, operator: 'strictEqual' });

  it.each([delegated, 'secret-manager-authority-revoked-after-preload'])(
    'awaits fresh cache eviction and unchanged SQL equality for %s',
    async variant => {
      vi.useFakeTimers();
      let cached = new Map([['deleted-right', { id: 'deleted-right' }]]);
      const map = vi.fn(async () => cached);
      const sql = vi.fn(async () => []);
      const verify = vi.fn(async () => {
        for (const _row of (await map()).values())
          assert.equal((await sql()).length, 1, 'Rollback row proof: action_right');
      });
      const proof = waitForReadOnlyRollbackProof(variant, verify);
      await vi.advanceTimersByTimeAsync(10);
      expect(verify).toHaveBeenCalledTimes(3);
      expect(sql).toHaveBeenCalledTimes(3);
      cached = new Map();
      await vi.advanceTimersByTimeAsync(5);
      await proof;
      expect(map).toHaveBeenCalledTimes(4);
      expect(vi.getTimerCount()).toBe(0);
    }
  );
  it('rechecks complete field equality rather than accepting a still-present row', async () => {
    vi.useFakeTimers();
    let actual = 'optimistic';
    const verify = vi.fn(async () =>
      assert.deepEqual(actual, 'original', 'Rollback field proof: vote.status')
    );
    const proof = waitForReadOnlyRollbackProof(delegated, verify);
    await vi.advanceTimersByTimeAsync(10);
    actual = 'original';
    await vi.advanceTimersByTimeAsync(5);
    await proof;
    expect(verify).toHaveBeenCalledTimes(4);
  });
  it('fails at the original deadline with the last exact SQL assertion', async () => {
    vi.useFakeTimers();
    const error = mismatch('Rollback row proof: action_right');
    const verify = vi.fn(async () => {
      throw error;
    });
    const proof = waitForReadOnlyRollbackProof(delegated, verify, 13);
    const rejected = expect(proof).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(13);
    await rejected;
    expect(verify).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([
    new Error('Rollback row proof: action_right'),
    mismatch('Invalid cached application row'),
    Object.assign(new Error('database unavailable'), { code: '08006' }),
  ])(
    'never retries malformed data or failures outside the original SQL assertions',
    async error => {
      const verify = vi.fn(async () => {
        throw error;
      });
      await expect(waitForReadOnlyRollbackProof(delegated, verify)).rejects.toBe(error);
      expect(verify).toHaveBeenCalledOnce();
    }
  );
  it('calls unrelated rollback functions once even when they throw a matching assertion', async () => {
    const error = mismatch('Rollback row proof: action_right');
    const verify = vi.fn(async () => {
      throw error;
    });
    await expect(waitForReadOnlyRollbackProof('authorized', verify)).rejects.toBe(error);
    expect(verify).toHaveBeenCalledOnce();
    await expect(
      waitForReadOnlyRollbackProof('authorized', async () => undefined)
    ).resolves.toBeUndefined();
  });
  it('does not extend the shared deadline around a revision-owned inner wait', async () => {
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    const verify = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        })
    );
    const proof = waitForReadOnlyRollbackProof(delegated, verify, 13);
    const rejected = expect(proof).rejects.toThrow('Read-only rollback verification timed out');
    await vi.advanceTimersByTimeAsync(13);
    await rejected;
    reject(mismatch('Rollback row proof: action_right'));
    await vi.advanceTimersByTimeAsync(20);
    expect(verify).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

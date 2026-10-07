import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
const store = vi.hoisted(() => ({
  insertAiOperation: vi.fn(),
  finishAiOperation: vi.fn(),
  insertAiTrace: vi.fn(),
}));
vi.mock('../ai-trace-store', () => store);
import { rows, sqlTransaction, lockAuthority, AUTHORITY_LOCK } from '../transaction';
import { withAiTrace } from '../ai-trace';
const root = {
  traceId: crypto.randomUUID(),
  actorId: crypto.randomUUID(),
  surface: 'studio',
  invocation: 'test',
};
const query = vi.fn();
const tx = { location: 'server', dbTransaction: { query } } as unknown as Extract<
  Transaction<Schema>,
  { location: 'server' }
>;
beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue([]);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

it('rejects client SQL access and passes untraced server transactions through unchanged', () => {
  expect(() =>
    sqlTransaction({ ...tx, location: 'client' } as unknown as Transaction<Schema>)
  ).toThrow('server_required');
  expect(sqlTransaction(tx)).toBe(tx.dbTransaction);
  expect(query).not.toHaveBeenCalled();
});

it('returns all iterable rows and locks authority using the canonical advisory-lock key', async () => {
  query.mockResolvedValueOnce(new Set([{ id: 'first' }, { id: 'second' }]));
  expect(await rows(tx.dbTransaction, 'select id from studio_project')).toEqual([
    { id: 'first' },
    { id: 'second' },
  ]);
  expect(query).toHaveBeenCalledWith('select id from studio_project', []);
  await lockAuthority(tx.dbTransaction);
  expect(query).toHaveBeenLastCalledWith('select pg_advisory_xact_lock($1)', [AUTHORITY_LOCK]);
});

it('bypasses recursive trace-table instrumentation while retaining the underlying database result', async () => {
  const result = [{ id: 'run' }];
  query.mockResolvedValueOnce(result);
  const rows = await withAiTrace(root, () =>
    sqlTransaction(tx).query('select * from AI_RUN where id=$1', ['run'])
  );
  expect(rows).toBe(result);
  expect(store.insertAiOperation).not.toHaveBeenCalled();
});

it('instruments real SQL execution with parameter types rather than values or credentials', async () => {
  query.mockResolvedValueOnce(new Set([{ id: 'project' }]));
  const id = crypto.randomUUID();
  expect(
    await withAiTrace(root, () =>
      sqlTransaction(tx).query('select * from studio_project where id=$1::uuid', [
        id,
        null,
        '',
        { secret: 'private' },
      ])
    )
  ).toEqual([{ id: 'project' }]);
  expect(store.insertAiOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'database',
      name: 'studio_project',
      input: {
        statement: 'select * from studio_project where id=$1::uuid',
        parameters: [
          { index: 1, type: 'string', empty: false },
          { index: 2, type: 'null', empty: false },
          { index: 3, type: 'string', empty: true },
          { index: 4, type: 'object', empty: false },
        ],
      },
    })
  );
  expect(JSON.stringify(store.insertAiOperation.mock.calls)).not.toContain('private');
});

it('uses a safe diagnostic name for statements without a table relation', async () => {
  await withAiTrace(root, () => lockAuthority(sqlTransaction(tx)));
  expect(store.insertAiOperation).toHaveBeenCalledWith(expect.objectContaining({ name: 'query' }));
});

it('rejects empty UUID-cast parameters before executing SQL and records the identifier failure', async () => {
  await expect(
    withAiTrace(root, () =>
      sqlTransaction(tx).query('select * from studio_project where id=$1::uuid', [''])
    )
  ).rejects.toMatchObject({ code: 'ai_invalid_identifier' });
  expect(query).not.toHaveBeenCalled();
  expect(store.finishAiOperation).toHaveBeenCalledWith(
    expect.any(String),
    'failed',
    undefined,
    expect.objectContaining({ code: 'ai_invalid_identifier' }),
    expect.anything()
  );
});

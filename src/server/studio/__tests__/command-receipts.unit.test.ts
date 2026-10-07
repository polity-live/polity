import { beforeEach, expect, it, vi } from 'vitest';
import { checksum } from '@/server/checksum';
import { encodeAppError } from '@/features/shared/errors/app-error';
const io = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('@/server/zero-mutate', () => ({
  withZeroTransaction: (_tx: unknown, body: () => unknown) => body(),
}));
import { studioCommandResult } from '../command-receipts';
import { currentStudioTransaction } from '../context';
import { StudioError } from '../db';
const input = { operationId: crypto.randomUUID() };
const tx = { location: 'server', dbTransaction: { wrappedTransaction: io.sql } } as never;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io.sql.mockResolvedValue([]);
  Object.assign(io.sql, { json: (value: unknown) => value });
});
it('requires an authenticated server actor and rejects operation-ID misuse and expired tokens', async () => {
  const body = vi.fn();
  for (const actor of ['', 'anon'])
    await expect(studioCommandResult(tx, actor, 'create', input, body)).rejects.toThrow(
      encodeAppError('permission_denied')
    );
  await expect(
    studioCommandResult({ location: 'client' } as never, 'actor', 'create', input, body)
  ).rejects.toThrow(encodeAppError('action_blocked'));
  const prior = {
    actor_id: 'actor',
    input_hash: checksum({ command: 'create', input }),
    expires_at: null,
  };
  io.sql.mockResolvedValue([prior]);
  await studioCommandResult(tx, 'actor', 'create', input, body);
  expect(body).not.toHaveBeenCalled();
  for (const changed of [{ actor_id: 'other' }, { input_hash: 'changed' }]) {
    io.sql.mockResolvedValue([{ ...prior, ...changed }]);
    await expect(studioCommandResult(tx, 'actor', 'create', input, body)).rejects.toThrow(
      encodeAppError('already_exists')
    );
  }
  io.sql.mockResolvedValue([{ ...prior, expires_at: Date.now() - 1 }]);
  await expect(studioCommandResult(tx, 'actor', 'create', input, body)).rejects.toThrow(
    encodeAppError('action_blocked')
  );
  io.sql.mockResolvedValue([{ ...prior, expires_at: Date.now() + 100_000 }]);
  await studioCommandResult(tx, 'actor', 'create', input, body);
});
it('writes private results in the exact Zero transaction with upload expiry and serializable null', async () => {
  await studioCommandResult(
    tx,
    'actor',
    'beginUpload',
    { ...input, projectId: 'project' },
    async () => {
      expect(currentStudioTransaction()).toBe(io.sql);
      return { token: 'private' };
    }
  );
  expect(io.sql.mock.lastCall?.slice(1)).toEqual([
    input.operationId,
    'actor',
    'project',
    'beginUpload',
    expect.any(String),
    '{"token":"private"}',
    expect.any(Number),
    expect.any(Number),
  ]);
  await studioCommandResult(tx, 'actor', 'create', input, async () => undefined);
  expect(io.sql.mock.lastCall?.slice(1)).toEqual([
    input.operationId,
    'actor',
    null,
    'create',
    expect.any(String),
    'null',
    expect.any(Number),
    null,
  ]);
});
it('preserves structured errors and translates domain and unknown failures without persisting success', async () => {
  const cases = [
    [new Error(encodeAppError('action_blocked')), 'action_blocked'],
    [new StudioError('denied', 403), 'permission_denied'],
    [new StudioError('absent', 404), 'resource_not_found'],
    [new StudioError('stale', 409), 'project_revision_conflict'],
    [new StudioError('storage', 502), 'external_service_failed'],
    [new StudioError('input'), 'validation_failed'],
    [new StudioError('specific', 400, 'ai_invalid_identifier'), 'ai_invalid_identifier'],
    [new Error('unexpected'), 'mutation_server_failed'],
  ] as const;
  for (const [error, code] of cases)
    await expect(
      studioCommandResult(tx, 'actor', 'create', input, async () => {
        throw error;
      })
    ).rejects.toThrow(encodeAppError(code));
  expect(io.sql.mock.calls.every(([parts]) => !parts.join('').includes('insert'))).toBe(true);
  const confidential = Object.assign(new Error('private-document-and-token'), {
    query: 'secret SQL',
  });
  await studioCommandResult(tx, 'actor', 'create', input, async () => {
    throw confidential;
  }).catch(error => expect(error.cause).toBeUndefined());
  expect(console.error).toHaveBeenLastCalledWith('studio.command_failed', {
    operationId: input.operationId,
    mutator: 'create',
    code: 'mutation_server_failed',
  });
});

it('reuses Canvas receipts in the wrapped transaction and translates its failures', async () => {
  const body = vi.fn(async () => {
    expect(currentStudioTransaction()).toBe(io.sql);
  });
  await studioCommandResult(tx, 'actor', 'canvas', input, body);
  expect(io.sql.mock.calls.every(([parts]) => !parts.join('').includes('insert'))).toBe(true);
  for (const [error, code] of [
    [new StudioError('stale', 409), 'project_revision_conflict'],
    [new StudioError('denied', 403), 'permission_denied'],
    [new StudioError('bad'), 'validation_failed'],
    [new StudioError('specific', 400, 'ai_invalid_identifier'), 'ai_invalid_identifier'],
    [new Error('internal'), 'mutation_server_failed'],
  ] as const)
    await expect(
      studioCommandResult(tx, 'actor', 'canvas', input, async () => {
        throw error;
      })
    ).rejects.toThrow(encodeAppError(code));
});

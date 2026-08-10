import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock('@/zero/db-provider', () => ({
  dbProvider: { transaction: mocks.transaction },
}));

import { encodeAppError } from '@/features/shared/errors/app-error';
import {
  createZeroContext,
  executeZeroMutator,
  executeZeroRead,
  executeZeroTransaction,
  runZeroMutator,
  sanitizeZeroMutationResult,
} from '../zero-mutate';

const tx = { id: 'tx' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async callback => callback(tx));
});

describe('Zero transaction helpers', () => {
  it('creates default and explicit contexts and executes read and contextual transactions', async () => {
    expect(createZeroContext('user-1')).toEqual({ userID: 'user-1', email: '' });
    expect(createZeroContext('user-1', 'user@example.test')).toEqual({
      userID: 'user-1',
      email: 'user@example.test',
    });
    const context = createZeroContext('user-1');
    await expect(
      executeZeroTransaction(context, async (value, received) => [value, received])
    ).resolves.toEqual([tx, context]);
    await expect(executeZeroRead(async value => value)).resolves.toBe(tx);
  });

  it('runs mutators, preserves already-safe Errors and wraps unsafe failures', async () => {
    const context = createZeroContext('user-1');
    const successful = {
      mutator: { fn: vi.fn().mockResolvedValue(undefined) },
      args: { id: 'one' },
    };
    await expect(runZeroMutator(tx as never, successful, context)).resolves.toBeUndefined();
    expect(successful.mutator.fn).toHaveBeenCalledWith({ tx, ctx: context, args: { id: 'one' } });

    const safe = new Error(encodeAppError('permission_denied'));
    await expect(
      runZeroMutator(
        tx as never,
        { mutator: { fn: vi.fn().mockRejectedValue(safe) }, args: {} },
        context
      )
    ).rejects.toBe(safe);

    const unsafe = new Error('database detail');
    await expect(
      runZeroMutator(
        tx as never,
        { mutator: { fn: vi.fn().mockRejectedValue(unsafe) }, args: {} },
        context
      )
    ).rejects.toMatchObject({ message: encodeAppError('mutation_server_failed'), cause: unsafe });

    await expect(
      runZeroMutator(
        tx as never,
        { mutator: { fn: vi.fn().mockRejectedValue('plain detail') }, args: {} },
        context
      )
    ).rejects.toMatchObject({
      message: encodeAppError('mutation_server_failed'),
      cause: 'plain detail',
    });
    await expect(
      runZeroMutator(
        tx as never,
        { mutator: { fn: vi.fn().mockRejectedValue({ message: 42 }) }, args: {} },
        context
      )
    ).rejects.toMatchObject({ message: encodeAppError('mutation_server_failed') });
    await expect(
      runZeroMutator(
        tx as never,
        { mutator: { fn: vi.fn().mockRejectedValue(null) }, args: {} },
        context
      )
    ).rejects.toMatchObject({ message: encodeAppError('mutation_server_failed'), cause: null });
  });

  it('executes mutators inside the provider transaction', async () => {
    const request = { mutator: { fn: vi.fn().mockResolvedValue(undefined) }, args: { id: 'one' } };
    const context = createZeroContext('user-1');
    await executeZeroMutator(request, context);
    expect(request.mutator.fn).toHaveBeenCalledWith({ tx, ctx: context, args: request.args });
  });

  it('sanitizes primitive, nested and malformed error-shaped results', () => {
    expect(sanitizeZeroMutationResult(null)).toBeNull();
    expect(sanitizeZeroMutationResult('value')).toBe('value');
    expect(sanitizeZeroMutationResult(['value', { nested: 1 }])).toEqual(['value', { nested: 1 }]);
    expect(sanitizeZeroMutationResult({ type: 'ok', nested: { value: 1 } })).toEqual({
      type: 'ok',
      nested: { value: 1 },
    });
    expect(sanitizeZeroMutationResult({ type: 'error', error: null })).toEqual({
      type: 'error',
      error: null,
    });
    expect(sanitizeZeroMutationResult({ type: 'error', error: { code: 'x' } })).toEqual({
      type: 'error',
      error: { code: 'x' },
    });
    expect(
      sanitizeZeroMutationResult({ type: 'error', error: { message: { detail: 'x' } } })
    ).toMatchObject({ error: { message: encodeAppError('mutation_server_failed') } });
    expect(
      sanitizeZeroMutationResult({ type: 'error', error: { message: new Error('secret') } })
    ).toMatchObject({ error: { message: encodeAppError('mutation_server_failed') } });
    expect(
      sanitizeZeroMutationResult({ type: 'error', error: { message: { message: 'secret' } } })
    ).toMatchObject({ error: { message: encodeAppError('mutation_server_failed') } });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  encodeGroupConflictResponse,
  GroupConflictError,
} from '@/features/groups/logic/groupConflict';
import {
  isRetryableServerMutationError,
  isZeroClosedMutationCancellation,
  onServerError,
  serverConfirmed,
  toMutationError,
  trackServerFinalization,
  waitForClientApply,
  type MutationResultLike,
} from '../mutate-with-server-check';

const success = (): MutationResultLike => ({ server: Promise.resolve({ type: 'success' }) });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('Zero mutation finalization contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recognizes Zero-close cancellation strings, errors, records, and rejects other values', () => {
    const message = 'Zero was explicitly closed by calling zero.close()';
    expect(isZeroClosedMutationCancellation(message)).toBe(true);
    expect(isZeroClosedMutationCancellation(new Error(message))).toBe(true);
    expect(isZeroClosedMutationCancellation({ message })).toBe(true);
    expect(isZeroClosedMutationCancellation({ message: 42 })).toBe(false);
    expect(isZeroClosedMutationCancellation({})).toBe(false);
    expect(isZeroClosedMutationCancellation(null)).toBe(false);
    expect(isZeroClosedMutationCancellation(42)).toBe(false);
  });

  it('waits for present clients and tolerates absent clients', async () => {
    await expect(waitForClientApply(success())).resolves.toBeUndefined();
    await expect(
      waitForClientApply({ ...success(), client: Promise.resolve('applied') })
    ).resolves.toBeUndefined();
  });

  it('confirms successful servers and maps missing server error messages', async () => {
    await expect(serverConfirmed(success())).resolves.toBeUndefined();
    await expect(
      serverConfirmed({ server: Promise.resolve({ type: 'error', error: undefined }) })
    ).rejects.toThrow('Mutation failed on server');
  });

  it.each([
    [new Error('DEADLOCK DETECTED'), true],
    ['could not serialize access', true],
    [{ message: 'serialization failure' }, true],
    [{ message: null }, false],
    [{}, false],
    [null, false],
    [42, false],
  ])('classifies retryable mutation value %#', (value, expected) => {
    expect(isRetryableServerMutationError(value)).toBe(expected);
  });

  it('tracks success with and without callbacks', async () => {
    const onSuccess = vi.fn();
    trackServerFinalization(success(), { onSuccess });
    trackServerFinalization(success());
    await flush();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('tracks server errors with present and absent messages or callbacks', async () => {
    const onError = vi.fn();
    trackServerFinalization(
      { server: Promise.resolve({ type: 'error', error: { type: 'server', message: 'no' } }) },
      { onError }
    );
    trackServerFinalization(
      { server: Promise.resolve({ type: 'error', error: undefined }) },
      { onError }
    );
    trackServerFinalization({ server: Promise.resolve({ type: 'error', error: undefined }) });
    await flush();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'Mutation failed on server' })
    );
  });

  it('tracks rejected promises, unknown errors, and Zero-close option states', async () => {
    const onError = vi.fn();
    trackServerFinalization({ server: Promise.reject(new Error('network')) }, { onError });
    trackServerFinalization({ server: Promise.reject('unknown') }, { onError });
    trackServerFinalization(
      {
        server: Promise.reject(new Error('Zero was explicitly closed by calling zero.close()')),
      },
      { onError, ignoreZeroClosed: true }
    );
    trackServerFinalization({ server: Promise.reject('ignored callback') });
    await flush();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'Mutation failed on server' })
    );
  });

  it('reports asynchronous server errors and ignores successful results', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = vi.fn();
    onServerError(success(), handler);
    onServerError(
      {
        server: Promise.resolve({ type: 'error', error: { type: 'server', message: 'Rejected' } }),
      },
      handler
    );
    onServerError({ server: Promise.resolve({ type: 'error', error: undefined }) }, handler);
    onServerError({ server: Promise.reject(new Error('Network')) }, handler);
    await flush();
    expect(handler).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('creates generic mutation errors with explicit and fallback messages', () => {
    expect(toMutationError('Explicit').message).toBe('Explicit');
    expect(toMutationError(null).message).toBe('Mutation failed on server');
    expect(
      toMutationError(
        encodeGroupConflictResponse({ blocking: false, summary: null, conflicts: [] })
      )
    ).toBeInstanceOf(GroupConflictError);
  });
});

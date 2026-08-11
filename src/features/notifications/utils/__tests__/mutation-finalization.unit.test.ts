import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gatedToast } from '../gated-toast';
import {
  combineMutationResults,
  getCreationFinalizationMessages,
  getCreationFinalizationToastId,
  trackCreationUnlessSilent,
  trackMutationFinalization,
} from '../mutation-finalization';

vi.mock('../gated-toast', () => ({
  gatedToast: {
    finalizationError: vi.fn(),
    finalizationSuccess: vi.fn(),
    loading: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('trackMutationFinalization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates one stable toast only after client and server success', async () => {
    const client = deferred<unknown>();
    const server = deferred<{ readonly type: 'success' }>();

    const id = trackMutationFinalization({
      result: { client: client.promise, server: server.promise },
      entityKind: 'payment',
      operationId: 'payment-1',
    });

    expect(id).toBe('creation:payment:payment-1');
    expect(gatedToast.loading).toHaveBeenCalledWith(
      'Payment is being finalized in the background…',
      expect.objectContaining({ id })
    );

    server.resolve({ type: 'success' });
    await Promise.resolve();
    expect(gatedToast.finalizationSuccess).not.toHaveBeenCalled();

    client.resolve(undefined);
    await vi.waitFor(() => expect(gatedToast.finalizationSuccess).toHaveBeenCalledOnce());
    expect(gatedToast.finalizationSuccess).toHaveBeenCalledWith(
      'Payment was created successfully.',
      expect.objectContaining({ id })
    );
  });

  it('turns the same toast into an error on server rejection', async () => {
    const client = deferred<unknown>();
    trackMutationFinalization({
      result: {
        client: client.promise,
        server: Promise.resolve({
          type: 'error',
          error: { type: 'server', message: 'Denied' },
        }),
      },
      entityKind: 'payment',
      operationId: 'payment-1',
    });

    await vi.waitFor(() => expect(gatedToast.finalizationError).toHaveBeenCalledOnce());
    expect(gatedToast.finalizationError).toHaveBeenCalledWith(
      'Payment could not be created.',
      expect.objectContaining({
        id: 'creation:payment:payment-1',
        description: 'Something went wrong. Please try again.',
      })
    );
    expect(gatedToast.finalizationSuccess).not.toHaveBeenCalled();
    client.resolve(undefined);
  });

  it('finishes with one error when the optimistic client apply rejects', async () => {
    const server = deferred<{ readonly type: 'success' }>();
    trackMutationFinalization({
      result: { client: Promise.reject(new Error('Client apply failed')), server: server.promise },
      entityKind: 'todo',
      operationId: 'todo-1',
    });

    await vi.waitFor(() => expect(gatedToast.finalizationError).toHaveBeenCalledOnce());
    server.resolve({ type: 'success' });
    await Promise.resolve();

    expect(gatedToast.finalizationError).toHaveBeenCalledOnce();
    expect(gatedToast.finalizationSuccess).not.toHaveBeenCalled();
  });

  it('does not create a toast in silent mode', () => {
    trackCreationUnlessSilent(
      { server: Promise.resolve({ type: 'success' }) },
      'payment',
      { notificationMode: 'silent' },
      'payment-1'
    );

    expect(gatedToast.loading).not.toHaveBeenCalled();
  });

  it('builds generated ids and applies message and toast overrides', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    expect(getCreationFinalizationToastId('blog')).toMatch(/^creation:blog:1234:\d+$/);
    expect(
      getCreationFinalizationMessages('blogEntry', {
        pending: 'pending override',
        success: 'success override',
        error: 'error override',
      })
    ).toEqual({
      pending: 'pending override',
      success: 'success override',
      error: 'error override',
    });

    const onSuccess = vi.fn();
    trackMutationFinalization({
      result: { server: Promise.resolve({ type: 'success' }) },
      entityKind: 'blogEntry',
      operationId: 'custom',
      messages: { pending: 'pending override', success: 'success override' },
      pendingToast: { duration: 25, testId: 'custom-pending' },
      successToast: { duration: 50 },
      onSuccess,
    });
    await vi.waitFor(() => expect(gatedToast.finalizationSuccess).toHaveBeenCalledOnce());
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(gatedToast.loading).toHaveBeenCalledWith(
      'pending override',
      expect.objectContaining({ duration: 25, testId: 'custom-pending' })
    );
    expect(gatedToast.finalizationSuccess).toHaveBeenCalledWith(
      'success override',
      expect.objectContaining({ duration: 50 })
    );
  });

  it('normalizes non-error failures and resolves functional error toast options once', async () => {
    const onError = vi.fn();
    const errorToast = vi.fn(() => ({ duration: 75, testId: 'custom-error' }));
    const server = deferred<{ readonly type: 'success' }>();
    trackMutationFinalization({
      result: { client: Promise.reject('client failed'), server: server.promise },
      entityKind: 'todo',
      operationId: 'todo-functional-error',
      errorToast,
      onError,
    });
    await vi.waitFor(() => expect(gatedToast.finalizationError).toHaveBeenCalledOnce());
    server.reject(new Error('late server failure'));
    await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce();
    expect(errorToast).toHaveBeenCalledOnce();
    expect(gatedToast.finalizationError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        id: 'creation:todo:todo-functional-error',
        duration: 75,
        testId: 'custom-error',
      })
    );
  });

  it('tracks non-silent creations and combines child client and server results', async () => {
    trackCreationUnlessSilent(
      { server: Promise.resolve({ type: 'success' }) },
      'payment',
      { notificationMode: 'background' },
      'background-payment',
      { pending: 'background pending' }
    );
    await vi.waitFor(() => expect(gatedToast.finalizationSuccess).toHaveBeenCalledOnce());

    const combinedSuccess = combineMutationResults([
      { client: Promise.resolve('one'), server: Promise.resolve({ type: 'success' }) },
      { server: Promise.resolve({ type: 'success' }) },
    ]);
    await expect(combinedSuccess.client).resolves.toEqual(['one', undefined]);
    await expect(combinedSuccess.server).resolves.toEqual({ type: 'success' });

    const failure = {
      type: 'error' as const,
      error: { type: 'server' as const, message: 'failed' },
    };
    const combinedFailure = combineMutationResults([
      { server: Promise.resolve({ type: 'success' }) },
      { server: Promise.resolve(failure) },
    ]);
    await expect(combinedFailure.server).resolves.toBe(failure);
  });
});

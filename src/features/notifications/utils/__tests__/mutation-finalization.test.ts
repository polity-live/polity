import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gatedToast } from '../gated-toast';
import { trackCreationUnlessSilent, trackMutationFinalization } from '../mutation-finalization';

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
      expect.objectContaining({ id: 'creation:payment:payment-1', description: 'Denied' })
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
});

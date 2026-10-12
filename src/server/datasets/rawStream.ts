import { DatasetProviderFailure } from './providerError';

/** A single-reader, backpressured stream. Completion includes cancellation and idle timeout. */
export function rawResponseStream(
  response: Response,
  options: {
    signal?: AbortSignal;
    onFinish?: () => void;
    onAbort?: () => void;
    idleMs?: number;
  } = {}
) {
  if (!response.body) {
    options.onFinish?.();
    throw new DatasetProviderFailure('The source returned no file', 'invalid_response');
  }
  const reader = response.body.getReader();
  let finished = false;
  let timer: ReturnType<typeof setTimeout>;
  let output: ReadableStreamDefaultController<Uint8Array> | undefined;
  const finish = () => {
    finished = true;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  };
  const fail = (reason: unknown) => {
    if (finished) return;
    // Upstream cancellation may synchronously abort the same signal.
    finish();
    output?.error(reason);
    void reader.cancel(reason).catch(() => undefined);
    try {
      options.onAbort?.();
    } finally {
      options.onFinish?.();
    }
  };
  const abort = () => fail(options.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => fail(new DatasetProviderFailure('Download stalled', 'timeout', 504)),
      options.idleMs ?? 60_000
    );
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller;
      reset();
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
    },
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (finished) return;
        if (chunk.done) {
          controller.close();
          finish();
          options.onFinish?.();
        } else {
          reset();
          controller.enqueue(chunk.value);
        }
      } catch (error) {
        fail(error);
      }
    },
    async cancel(reason) {
      finish();
      const cancellation = reader.cancel(reason).catch(() => undefined);
      try {
        options.onAbort?.();
      } finally {
        options.onFinish?.();
      }
      await cancellation;
    },
  });
}

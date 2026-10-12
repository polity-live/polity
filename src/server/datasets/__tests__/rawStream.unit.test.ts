import { afterEach, expect, it, vi } from 'vitest';
import { rawResponseStream } from '../rawStream';
afterEach(() => vi.useRealTimers());
it('releases the reader and queue on body completion and cancellation', async () => {
  const finish = vi.fn();
  const stream = rawResponseStream(new Response(new Uint8Array([1, 2, 3])), { onFinish: finish });
  expect(new Uint8Array(await new Response(stream).arrayBuffer())).toEqual(
    new Uint8Array([1, 2, 3])
  );
  expect(finish).toHaveBeenCalledOnce();
  const cancel = vi.fn();
  const abort = vi.fn();
  const done = vi.fn();
  const waiting = rawResponseStream(new Response(new ReadableStream({ cancel })), {
    onFinish: done,
    onAbort: abort,
  });
  await waiting.cancel();
  expect(cancel).toHaveBeenCalledOnce();
  expect(abort).toHaveBeenCalledOnce();
  expect(done).toHaveBeenCalledOnce();
});
it('aborts a stalled stream after sixty seconds and responds to a browser abort', async () => {
  vi.useFakeTimers();
  const done = vi.fn();
  const cancel = vi.fn();
  const stream = rawResponseStream(new Response(new ReadableStream({ cancel })), {
    onFinish: done,
  });
  const rejected = expect(stream.getReader().read()).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(60_000);
  await rejected;
  expect(done).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  const controller = new AbortController();
  const stopped = rawResponseStream(new Response(new ReadableStream()), {
    signal: controller.signal,
  });
  const aborted = expect(stopped.getReader().read()).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await aborted;
});

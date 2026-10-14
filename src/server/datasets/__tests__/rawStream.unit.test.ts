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

it('finishes once when source failure races with caller cancellation', async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const controller = new AbortController();
  const onFinish = vi.fn();
  const onAbort = vi.fn();
  const stream = rawResponseStream(
    new Response(
      new ReadableStream({
        start(value) {
          source = value;
        },
      })
    ),
    { signal: controller.signal, onFinish, onAbort }
  );
  const assertion = expect(stream.getReader().read()).rejects.toThrow('caller stopped');
  await Promise.resolve();
  source.error(new Error('upstream failed'));
  controller.abort(new Error('caller stopped'));
  await assertion;
  await Promise.resolve();
  expect(onFinish).toHaveBeenCalledOnce();
  expect(onAbort).toHaveBeenCalledOnce();
});

it('does not invoke abort callbacks twice when timeout cleanup aborts the same signal', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const onFinish = vi.fn();
  const onAbort = vi.fn(() => controller.abort());
  const stream = rawResponseStream(new Response(new ReadableStream()), {
    signal: controller.signal,
    onFinish,
    onAbort,
    idleMs: 10,
  });
  const assertion = expect(stream.getReader().read()).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(10);
  await assertion;
  expect(onFinish).toHaveBeenCalledOnce();
  expect(onAbort).toHaveBeenCalledOnce();
});

it('finishes once when provider cancellation synchronously aborts the caller signal', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const onFinish = vi.fn();
  const onAbort = vi.fn();
  const cancel = vi.fn(() => controller.abort());
  const stream = rawResponseStream(new Response(new ReadableStream({ cancel })), {
    signal: controller.signal,
    onFinish,
    onAbort,
    idleMs: 1,
  });
  const assertion = expect(stream.getReader().read()).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(cancel).toHaveBeenCalledOnce();
  expect(onFinish).toHaveBeenCalledOnce();
  expect(onAbort).toHaveBeenCalledOnce();
});

it('terminates a stalled download and cancels its source before a finish observer throws', async () => {
  vi.useFakeTimers();
  const failure = new Error('finish observer failed');
  const controller = new AbortController();
  const cancel = vi.fn(() => controller.abort());
  const onAbort = vi.fn();
  const onFinish = vi.fn(() => {
    throw failure;
  });
  const stream = rawResponseStream(new Response(new ReadableStream({ cancel })), {
    signal: controller.signal,
    onFinish,
    onAbort,
    idleMs: 10,
  });
  const assertion = expect(stream.getReader().read()).rejects.toMatchObject({ code: 'timeout' });
  expect(() => vi.advanceTimersByTime(10)).toThrow(failure);
  await assertion;
  expect(cancel).toHaveBeenCalledOnce();
  expect(onAbort).toHaveBeenCalledOnce();
  expect(onFinish).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('starts upstream cancellation even if its finish observer throws', async () => {
  vi.useFakeTimers();
  const failure = new Error('finish observer failed');
  const cancel = vi.fn();
  const onAbort = vi.fn();
  const onFinish = vi.fn(() => {
    throw failure;
  });
  const stream = rawResponseStream(new Response(new ReadableStream({ cancel })), {
    onAbort,
    onFinish,
  });
  await expect(stream.cancel('stopped')).rejects.toBe(failure);
  expect(cancel).toHaveBeenCalledWith('stopped');
  expect(onAbort).toHaveBeenCalledOnce();
  expect(onFinish).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('finishes immediately when the source has no body', () => {
  const onFinish = vi.fn();
  expect(() => rawResponseStream(new Response(null), { onFinish })).toThrow('no file');
  expect(onFinish).toHaveBeenCalledOnce();
});

it('handles pre-cancelled and legacy abort signals with one finish notification', async () => {
  const controller = new AbortController();
  Object.defineProperty(controller.signal, 'reason', { value: undefined });
  controller.abort();
  const onFinish = vi.fn();
  const stream = rawResponseStream(new Response(new ReadableStream()), {
    signal: controller.signal,
    onFinish,
  });
  await expect(stream.getReader().read()).rejects.toMatchObject({ name: 'AbortError' });
  expect(onFinish).toHaveBeenCalledOnce();
});

it('handles reader failures and rejected upstream cancellation without leaking an idle timer', async () => {
  vi.useFakeTimers();
  const onFinish = vi.fn();
  const onAbort = vi.fn();
  const error = new Error('upstream closed');
  const stream = rawResponseStream(
    new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(error);
        },
      })
    ),
    { onFinish, onAbort }
  );
  await expect(stream.getReader().read()).rejects.toBe(error);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(onFinish).toHaveBeenCalledOnce();
  expect(onAbort).toHaveBeenCalledOnce();
  const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
  await expect(
    rawResponseStream(new Response(new ReadableStream({ cancel }))).cancel('stopped')
  ).resolves.toBeUndefined();
  expect(cancel).toHaveBeenCalledWith('stopped');
});

it('ignores a pending source read that completes after the caller has cancelled', async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn().mockRejectedValue(new Error('cannot cancel'));
  const controller = new AbortController();
  const onFinish = vi.fn();
  const stream = rawResponseStream(
    new Response(
      new ReadableStream({
        start(value) {
          source = value;
        },
        cancel,
      })
    ),
    { signal: controller.signal, onFinish }
  );
  const reader = stream.getReader();
  const rejected = expect(reader.read()).rejects.toThrow('caller stopped');
  await Promise.resolve();
  controller.abort(new Error('caller stopped'));
  await rejected;
  await Promise.resolve();
  expect(onFinish).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  expect(source).toBeDefined();
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

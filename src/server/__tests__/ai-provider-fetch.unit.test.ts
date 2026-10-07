import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  current: vi.fn(),
  start: vi.fn(),
  end: vi.fn(),
  log: vi.fn(),
  delay: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('../ai-trace', () => ({
  currentAiTrace: io.current,
  startAiOperation: io.start,
  endAiOperation: io.end,
  logAiEvent: io.log,
}));
vi.mock('node:timers/promises', () => ({ setTimeout: io.delay }));
import { aiProviderFetch, retryAfterMs } from '../ai-provider-fetch';
beforeEach(() => {
  vi.clearAllMocks();
  io.current.mockReturnValue({ traceId: 'trace', retryProvider: true });
  io.start.mockResolvedValue({ operationId: 'operation' });
  io.end.mockResolvedValue(undefined);
  io.delay.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', io.fetch);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([null, '', 'bad', '-1', 'Infinity'])('ignores invalid Retry-After value %s', value => {
  expect(retryAfterMs(value)).toBeUndefined();
});
it('accepts zero, seconds and future dates while rejecting elapsed dates', () => {
  const now = Date.parse('2026-10-07T05:00:00Z');
  expect(retryAfterMs('0', now)).toBe(0);
  expect(retryAfterMs('2', now)).toBe(2000);
  expect(retryAfterMs('Wed, 07 Oct 2026 05:00:05 GMT', now)).toBe(5000);
  expect(retryAfterMs('Wed, 07 Oct 2026 04:59:59 GMT', now)).toBeUndefined();
});

it('passes requests through unchanged when there is no active diagnostic trace', async () => {
  io.current.mockReturnValue(null);
  const response = new Response('Stream');
  io.fetch.mockResolvedValue(response);
  const request = new Request('https://provider.test/model');
  const init = { method: 'POST', body: '{}' };
  expect(await aiProviderFetch(request, init)).toBe(response);
  expect(io.fetch).toHaveBeenCalledWith(request, init);
  expect(io.start).not.toHaveBeenCalled();
});

it.each(['json', 'invalid', 'empty'] as const)(
  'records %s requests in the current model operation and returns accepted responses without consuming them',
  async kind => {
    const context = { traceId: 'model', operationId: 'model-operation' };
    io.current.mockReturnValue({
      traceId: 'root',
      retryProvider: false,
      modelContext: () => context,
    });
    const response = new Response('Unconsumed stream', {
      headers: { 'x-generation-id': 'generation', 'x-provider-name': 'provider' },
    });
    io.fetch.mockResolvedValue(response);
    const init =
      kind === 'json'
        ? { body: JSON.stringify({ model: 'chosen' }) }
        : kind === 'invalid'
          ? { body: 'not JSON' }
          : undefined;
    expect(await aiProviderFetch('https://provider.test', init)).toBe(response);
    expect(response.bodyUsed).toBe(false);
    expect(io.start).toHaveBeenCalledWith(
      'provider',
      'request',
      kind === 'json' ? { model: 'chosen' } : kind === 'invalid' ? { format: 'non-json' } : {},
      { attempt: 1 },
      context
    );
    expect(io.end).toHaveBeenCalledWith(
      { operationId: 'operation' },
      'completed',
      undefined,
      undefined,
      expect.objectContaining({ httpStatus: 200, generationId: 'generation', provider: 'provider' })
    );
  }
);

it('records rejected non-retryable responses with their actual body and headers', async () => {
  io.current.mockReturnValue({ traceId: 'root', modelContext: () => undefined });
  const response = new Response('Denied', { status: 403, headers: { 'x-error': 'denied' } });
  io.fetch.mockResolvedValue(response);
  expect(await aiProviderFetch('https://provider.test')).toBe(response);
  expect(response.bodyUsed).toBe(false);
  expect(io.end).toHaveBeenCalledWith(
    { operationId: 'operation' },
    'failed',
    undefined,
    expect.objectContaining({
      statusCode: 403,
      responseBody: 'Denied',
      responseHeaders: expect.objectContaining({ 'x-error': 'denied' }),
    }),
    expect.objectContaining({ httpStatus: 403 })
  );
  expect(io.delay).not.toHaveBeenCalled();
});

it.each(['init', 'request', 'none'] as const)(
  'retries only rate-limited responses and forwards the %s abort signal',
  async source => {
    const aborted = new AbortController();
    const request =
      source === 'request'
        ? new Request('https://provider.test', { signal: aborted.signal })
        : 'https://provider.test';
    const init = source === 'init' ? { signal: aborted.signal } : undefined;
    const limited = new Response(source === 'none' ? null : 'Limited', {
      status: 429,
      headers: { 'retry-after': '0' },
    });
    const accepted = new Response('Accepted');
    io.fetch.mockResolvedValueOnce(limited).mockResolvedValueOnce(accepted);
    expect(await aiProviderFetch(request, init)).toBe(accepted);
    expect(io.fetch).toHaveBeenCalledTimes(2);
    expect(io.delay).toHaveBeenCalledWith(0, undefined, {
      signal:
        source === 'init'
          ? aborted.signal
          : request instanceof Request
            ? request.signal
            : undefined,
    });
    expect(io.log).toHaveBeenCalledWith(
      'ai.provider.retry',
      { attempt: 1, nextAttempt: 2, delayMs: 0 },
      { operationId: 'operation' }
    );
    expect(accepted.bodyUsed).toBe(false);
  }
);

it('caps retries at three requests and applies exponential delay only to rejected HTTP responses', async () => {
  const responses = [0, 1, 2].map(() => new Response('Limited', { status: 429 }));
  responses.forEach(response => io.fetch.mockResolvedValueOnce(response));
  expect(await aiProviderFetch('https://provider.test')).toBe(responses[2]);
  expect(io.fetch).toHaveBeenCalledTimes(3);
  expect(io.delay.mock.calls.map(call => call[0])).toEqual([1125, 2125]);
  expect(io.end).toHaveBeenCalledTimes(3);
});

it('honors the total retry budget without waiting or replaying an oversized Retry-After', async () => {
  const response = new Response('Limited', { status: 429, headers: { 'retry-after': '31' } });
  io.fetch.mockResolvedValue(response);
  expect(await aiProviderFetch('https://provider.test')).toBe(response);
  expect(io.fetch).toHaveBeenCalledTimes(1);
  expect(io.delay).not.toHaveBeenCalled();
  expect(io.log).not.toHaveBeenCalled();
});

it('returns a rate-limit response immediately when retrying is disabled', async () => {
  io.current.mockReturnValue({ traceId: 'root', retryProvider: false });
  const response = new Response('Limited', { status: 429 });
  io.fetch.mockResolvedValue(response);
  expect(await aiProviderFetch('https://provider.test')).toBe(response);
  expect(io.fetch).toHaveBeenCalledTimes(1);
  expect(io.delay).not.toHaveBeenCalled();
});

it.each([new Error('Network unavailable'), new DOMException('Stopped', 'AbortError'), null])(
  'retains thrown fetch failures without replaying an accepted request (%s)',
  async error => {
    io.fetch.mockRejectedValueOnce(error);
    await expect(aiProviderFetch('https://provider.test')).rejects.toBe(error);
    expect(io.end).toHaveBeenCalledWith(
      { operationId: 'operation' },
      error instanceof DOMException ? 'cancelled' : 'failed',
      undefined,
      error
    );
    expect(io.fetch).toHaveBeenCalledTimes(1);
  }
);

it('stops retrying when the delay is cancelled and retains the cancellation diagnostic', async () => {
  io.fetch.mockResolvedValueOnce(
    new Response('Limited', { status: 429, headers: { 'retry-after': '0' } })
  );
  const error = new DOMException('Stopped', 'AbortError');
  io.delay.mockRejectedValueOnce(error);
  await expect(aiProviderFetch('https://provider.test')).rejects.toBe(error);
  expect(io.fetch).toHaveBeenCalledTimes(1);
  expect(io.end).toHaveBeenLastCalledWith(
    { operationId: 'operation' },
    'cancelled',
    undefined,
    error
  );
});

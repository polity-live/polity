import { setTimeout as delay } from 'node:timers/promises';
import { currentAiTrace, startAiOperation, endAiOperation, logAiEvent } from './ai-trace';

export function retryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const parsed = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Retry only rejected HTTP requests: never consume/replay an accepted stream or execute a tool. */
export const aiProviderFetch: typeof fetch = async (input, init) => {
  const root = currentAiTrace();
  if (!root) return fetch(input, init);
  const context = root.modelContext?.() ?? root;
  let body: unknown;
  try {
    body = JSON.parse(String(init?.body ?? '{}'));
  } catch {
    body = { format: 'non-json' };
  }
  const started = Date.now();
  const maximum = root.retryProvider ? 3 : 1;
  for (let attempt = 1; attempt <= maximum; attempt++) {
    const operation = await startAiOperation('provider', 'request', body, { attempt }, context);
    try {
      const response = await fetch(input, init);
      if (response.status !== 429 || attempt === maximum) {
        let error: unknown;
        if (!response.ok)
          error = {
            statusCode: response.status,
            responseBody: await response.clone().text(),
            responseHeaders: Object.fromEntries(response.headers),
          };
        await endAiOperation(operation, response.ok ? 'completed' : 'failed', undefined, error, {
          httpStatus: response.status,
          generationId: response.headers.get('x-generation-id'),
          provider: response.headers.get('x-provider-name'),
          durationMs: Date.now() - started,
        });
        return response;
      }
      const error = {
        statusCode: 429,
        responseBody: await response.clone().text(),
        responseHeaders: Object.fromEntries(response.headers),
      };
      await endAiOperation(operation, 'failed', undefined, error, { httpStatus: 429 });
      const wait =
        retryAfterMs(response.headers.get('retry-after')) ??
        1000 * 2 ** (attempt - 1) + Math.random() * 250;
      if (Date.now() - started + wait > 30_000) return response;
      await response.body?.cancel();
      logAiEvent(
        'ai.provider.retry',
        { attempt, nextAttempt: attempt + 1, delayMs: Math.round(wait) },
        operation
      );
      await delay(wait, undefined, {
        signal: init?.signal ?? (input instanceof Request ? input.signal : undefined),
      });
    } catch (error) {
      await endAiOperation(
        operation,
        (error as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed',
        undefined,
        error
      );
      throw error;
    }
  }
  throw new Error('Unreachable provider retry state');
};

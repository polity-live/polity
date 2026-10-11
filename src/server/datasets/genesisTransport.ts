import { createStableHash } from '@/server/eurostat/hash';
import { DatasetProviderFailure, providerResponseFailure } from './providerError';
import { readLimitedResponseBytes } from './storage';

export interface GenesisRequestBudget {
  remaining: number;
}
interface Flight {
  controller: AbortController;
  promise: Promise<Response>;
  subscribers: number;
}
const queues = new Map<string, Promise<unknown>>();
const flights = new Map<string, Flight>();

function abortError(signal: AbortSignal) {
  return signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      done();
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      done();
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Read-only GENESIS calls share a credential queue. Subscriber cancellation never cancels another caller. */
export async function postGenesis(
  path: string,
  data: Record<string, string | number | boolean>,
  options: { signal?: AbortSignal; budget?: GenesisRequestBudget; timeoutMs?: number } = {}
): Promise<Response> {
  const token = process.env.GENESIS_API_TOKEN;
  if (!token)
    throw new DatasetProviderFailure('GENESIS_API_TOKEN is not configured', 'authentication', 503);
  const base = (
    process.env.GENESIS_BASE_URL || 'https://genesis.destatis.de/genesisWS/rest/2020/'
  ).replace(/\/?$/, '/');
  const credential = createStableHash({ base, token });
  const key = createStableHash({ credential, path, data });
  if (options.signal?.aborted) throw abortError(options.signal);
  let flight = flights.get(key);
  if (!flight) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () =>
        controller.abort(new DatasetProviderFailure('GENESIS request timed out', 'timeout', 504)),
      options.timeoutMs ?? 8000
    );
    const previous = queues.get(credential) ?? Promise.resolve();
    const promise = previous
      .catch(() => undefined)
      .then(async () => {
        const signal = controller.signal;
        for (let attempt = 0; attempt < 2; attempt++) {
          signal.throwIfAborted();
          if (options.budget && options.budget.remaining <= 0)
            throw new DatasetProviderFailure(
              'GENESIS catalogue request budget exhausted',
              'unavailable'
            );
          if (options.budget) options.budget.remaining--;
          const started = Date.now();
          let response: Response;
          try {
            response = await fetch(`${base}${path}`, {
              method: 'POST',
              signal,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                username: token,
              },
              body: new URLSearchParams(
                Object.fromEntries(Object.entries(data).map(([id, value]) => [id, String(value)]))
              ),
            });
          } catch {
            if (signal.aborted) throw abortError(signal);
            throw new DatasetProviderFailure('GENESIS connection failed', 'unavailable');
          }
          if (process.env.DATASET_PROVIDER_DIAGNOSTICS === '1')
            console.info(
              '[dataset-provider]',
              JSON.stringify({
                provider: 'GENESIS_DESTATIS',
                path,
                term: data.term,
                name: data.name,
                category: data.category,
                language: data.language,
                attempt: attempt + 1,
                status: response.status,
                durationMs: Date.now() - started,
              })
            );
          if (response.ok) {
            // GENESIS work is still active while its response body streams. Keep the queue locked.
            try {
              const bytes = await readLimitedResponseBytes(response, 'GENESIS response');
              signal.throwIfAborted();
              return new Response(bytes, { status: response.status, headers: response.headers });
            } catch (error) {
              if (signal.aborted) throw abortError(signal);
              throw providerResponseFailure(error, 'GENESIS');
            }
          }
          if (response.status === 401 || response.status === 403)
            throw new DatasetProviderFailure(
              'GENESIS authentication failed',
              'authentication',
              503,
              response.status
            );
          if (
            attempt === 0 &&
            [500, 502, 503, 504].includes(response.status) &&
            (!options.budget || options.budget.remaining > 0)
          ) {
            await response.body?.cancel();
            await sleep(300, signal);
            continue;
          }
          throw new DatasetProviderFailure(
            `GENESIS request failed with ${response.status}`,
            'unavailable',
            502,
            response.status
          );
        }
        throw new DatasetProviderFailure('GENESIS unavailable', 'unavailable');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (flights.get(key)?.promise === promise) flights.delete(key);
        if (queues.get(credential) === promise) queues.delete(credential);
      });
    flight = { controller, promise, subscribers: 0 };
    flights.set(key, flight);
    queues.set(credential, promise);
    // A caller may cancel while its task is still waiting for the credential queue.
    void promise.catch(() => undefined);
  }
  flight.subscribers++;
  const active = flight;
  return new Promise<Response>((resolve, reject) => {
    let finished = false;
    const done = () => {
      if (finished) return false;
      finished = true;
      options.signal?.removeEventListener('abort', abort);
      active.controller.signal.removeEventListener('abort', controlAbort);
      active.subscribers--;
      return true;
    };
    const abort = () => {
      if (!options.signal) return;
      if (!done()) return;
      if (active.subscribers === 0) {
        if (flights.get(key) === active) flights.delete(key);
        active.controller.abort(abortError(options.signal));
      }
      reject(abortError(options.signal));
    };
    const controlAbort = () => {
      if (!done()) return;
      if (flights.get(key) === active) flights.delete(key);
      reject(abortError(active.controller.signal));
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    active.controller.signal.addEventListener('abort', controlAbort, { once: true });
    active.promise.then(
      response => {
        if (done()) resolve(response.clone ? response.clone() : response);
      },
      error => {
        if (done()) reject(error);
      }
    );
    if (options.signal?.aborted) abort();
    else if (active.controller.signal.aborted) controlAbort();
  });
}

export async function readGenesisJson(response: Response) {
  try {
    return await response.json();
  } catch (error) {
    throw providerResponseFailure(error, 'GENESIS');
  }
}

export function assertGenesisStatus(body: unknown, strictFilters = false) {
  if (!body || typeof body !== 'object')
    throw new DatasetProviderFailure('GENESIS returned an invalid response', 'invalid_response');
  const status = (body as { Status?: { Code?: number | string; Type?: string; Content?: string } })
    .Status;
  if (
    !status ||
    status.Code == null ||
    String(status.Code).trim() === '' ||
    !Number.isFinite(Number(status.Code))
  )
    throw new DatasetProviderFailure('GENESIS response is missing its status', 'invalid_response');
  const code = Number(status.Code);
  if (code === 0 || code === 104) return;
  const type = String(status.Type ?? '').toLowerCase();
  if (['warning', 'warnung'].includes(type) && !strictFilters) return;
  if (['warning', 'warnung'].includes(type))
    throw new DatasetProviderFailure(
      'GENESIS changed the requested filter parameters',
      'invalid_scope',
      422
    );
  const content = String(status.Content ?? '').toLowerCase();
  if (/token|password|passwort|anmeld|authenti|zugang|login/.test(content))
    throw new DatasetProviderFailure('GENESIS authentication failed', 'authentication', 503);
  if (/job|asynchron|hintergrund|zu groß|too large/.test(content))
    throw new DatasetProviderFailure(
      'GENESIS requires a smaller import selection',
      'too_large',
      413
    );
  throw new DatasetProviderFailure(
    `GENESIS rejected the request (status ${code})`,
    'invalid_response'
  );
}

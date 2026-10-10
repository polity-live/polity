import { subscribe } from 'node:diagnostics_channel';
import { randomUUID } from 'node:crypto';

// Only loaded into the isolated benchmark server, never into the product build.
const original = globalThis.fetch;
globalThis.fetch = async function measuredFetch(input, init) {
  const address = input instanceof Request ? input.url : String(input);
  const auth = new URL(address, 'http://benchmark.local').pathname === '/auth/v1/user';
  const started = performance.now();
  try {
    return await original.call(this, input, init);
  } finally {
    if (auth)
      console.info(
        JSON.stringify({ benchmark: 'supabase-get-user', elapsed: performance.now() - started })
      );
  }
};

// Record arrival before lazy route modules execute, using documented Node channels.
// Only the isolated server imports this probe; request headers/body are never logged.
const incoming = new WeakMap();
subscribe('http.server.request.start', ({ request }) => {
  if (
    request.method !== 'POST' ||
    new URL(request.url, 'http://benchmark.local').pathname !== '/api/query'
  )
    return;
  const externalClientID = request.headers['x-zero-performance-client-id'];
  const clientCorrelationID =
    typeof externalClientID === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(externalClientID)
      ? externalClientID
      : undefined;
  const timing = { requestID: randomUUID(), clientCorrelationID, started: performance.now() };
  incoming.set(request, timing);
  request.headers['x-zero-performance-request-id'] = timing.requestID;
  console.info(
    JSON.stringify({
      benchmark: 'query-http',
      requestID: timing.requestID,
      clientCorrelationID: timing.clientCorrelationID,
      phase: 'arrival',
      at: performance.timeOrigin + timing.started,
    })
  );
});
subscribe('http.server.response.finish', ({ request, response }) => {
  const timing = incoming.get(request);
  if (!timing) return;
  incoming.delete(request);
  const finished = performance.now();
  console.info(
    JSON.stringify({
      benchmark: 'query-http',
      requestID: timing.requestID,
      clientCorrelationID: timing.clientCorrelationID,
      phase: 'response',
      at: performance.timeOrigin + finished,
      elapsed: finished - timing.started,
      status: response.statusCode,
    })
  );
});

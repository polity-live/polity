import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appErrorBody: vi.fn(),
  currencies: vi.fn(),
  dbProvider: { kind: 'db-provider' },
  getAuth: vi.fn(),
  handleQuery: vi.fn(),
  mustGetQuery: vi.fn(),
  process: vi.fn(),
  pushConstructor: vi.fn(),
  queries: { kind: 'queries' },
  queryFn: vi.fn(),
  queue: vi.fn(),
  sanitize: vi.fn(),
  schema: { kind: 'schema' },
  serverMutators: { kind: 'server-mutators' },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('@/server/currency/frankfurter', () => ({
  getFrankfurterCurrencies: mocks.currencies,
}));
vi.mock('@/server/zero-auth', () => ({ getAuthFromRequest: mocks.getAuth }));
vi.mock('@/zero/db-provider', () => ({ dbProvider: mocks.dbProvider }));
vi.mock('@/zero/server-mutators', () => ({ serverMutators: mocks.serverMutators }));
vi.mock('@/zero/server-notify', () => ({
  withNotificationDeliveryQueue: (callback: () => unknown) => {
    mocks.queue();
    return callback();
  },
}));
vi.mock('@/server/zero-mutate', () => ({
  sanitizeZeroMutationResult: mocks.sanitize,
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  appErrorHttpBodyFrom: mocks.appErrorBody,
}));
vi.mock('@/zero/queries', () => ({ queries: mocks.queries }));
vi.mock('@/zero/schema', () => ({ schema: mocks.schema }));
vi.mock('@rocicorp/zero/server', () => ({
  PushProcessor: class {
    constructor(provider: unknown, context: unknown) {
      mocks.pushConstructor(provider, context);
    }

    process(...args: unknown[]) {
      return mocks.process(...args);
    }
  },
  handleQueryRequest: (...args: unknown[]) => mocks.handleQuery(...args),
}));
vi.mock('@rocicorp/zero', () => ({
  mustGetQuery: (...args: unknown[]) => mocks.mustGetQuery(...args),
}));

import { Route as CurrenciesRoute } from '../currency/currencies';
import { Route as MutateRoute } from '../mutate';
import { Route as QueryRoute } from '../query';

type Handler = (args: { request: Request }) => Promise<Response>;

interface ApiRoute {
  readonly server: {
    readonly handlers: Record<string, Handler>;
  };
}

function handlers(route: unknown) {
  return (route as ApiRoute).server.handlers;
}

function request(path: string) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: path }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuth.mockResolvedValue({ userID: 'user-1' });
  mocks.mustGetQuery.mockReturnValue({ fn: mocks.queryFn });
  mocks.queryFn.mockReturnValue({ transformed: true });
  mocks.sanitize.mockImplementation(value => ({ sanitized: value }));
  mocks.appErrorBody.mockImplementation((_error, fallbackCode) => ({ code: fallbackCode }));
});

describe('R02 currency route accountability', () => {
  it('serves live and fallback currency catalogues through GET only', async () => {
    const routeHandlers = handlers(CurrenciesRoute);
    expect(Object.keys(routeHandlers)).toEqual(['GET']);

    mocks.currencies.mockResolvedValueOnce(['EUR', 'USD']);
    const liveResponse = await routeHandlers.GET({ request: request('/api/currency/currencies') });
    expect(liveResponse.status).toBe(200);
    await expect(liveResponse.json()).resolves.toEqual({
      currencies: ['EUR', 'USD'],
      source: 'frankfurter',
    });

    const failure = new Error('currency provider offline');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.currencies.mockRejectedValueOnce(failure);
    const fallbackResponse = await routeHandlers.GET({
      request: request('/api/currency/currencies'),
    });
    expect(fallbackResponse.status).toBe(200);
    await expect(fallbackResponse.json()).resolves.toMatchObject({
      currencies: expect.arrayContaining(['EUR', 'USD']),
      source: 'fallback',
    });
    expect(consoleError).toHaveBeenCalledWith(
      'Frankfurter currency catalogue fetch failed:',
      failure
    );
    consoleError.mockRestore();
  });
});

describe('R02 Zero mutation route accountability', () => {
  it('authenticates and processes Zero mutations through POST only', async () => {
    const routeHandlers = handlers(MutateRoute);
    expect(Object.keys(routeHandlers)).toEqual(['POST']);
    const mutationRequest = request('/api/mutate');
    const rawResult = { mutations: [{ id: 'mutation-1' }] };
    mocks.process.mockResolvedValueOnce(rawResult);

    const response = await routeHandlers.POST({ request: mutationRequest });

    expect(mocks.getAuth).toHaveBeenCalledWith(mutationRequest);
    expect(mocks.pushConstructor).toHaveBeenCalledWith(mocks.dbProvider, { userID: 'user-1' });
    expect(mocks.queue).toHaveBeenCalledOnce();
    expect(mocks.process).toHaveBeenCalledWith(mocks.serverMutators, mutationRequest);
    expect(mocks.sanitize).toHaveBeenCalledWith(rawResult);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sanitized: rawResult });
  });

  it('returns a structured 500 response when Zero mutation processing fails', async () => {
    const failure = new Error('mutation failed');
    mocks.process.mockRejectedValueOnce(failure);

    const response = await handlers(MutateRoute).POST({ request: request('/api/mutate') });

    expect(response.status).toBe(500);
    expect(mocks.appErrorBody).toHaveBeenCalledWith(failure, 'mutation_server_failed');
    await expect(response.json()).resolves.toEqual({ code: 'mutation_server_failed' });
  });

  it('propagates authentication failures before constructing the mutation processor', async () => {
    const failure = new Error('authentication unavailable');
    mocks.getAuth.mockRejectedValueOnce(failure);

    await expect(handlers(MutateRoute).POST({ request: request('/api/mutate') })).rejects.toBe(
      failure
    );
    expect(mocks.pushConstructor).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
});

describe('R02 Zero query route accountability', () => {
  it('authenticates and transforms Zero queries through POST only', async () => {
    const routeHandlers = handlers(QueryRoute);
    expect(Object.keys(routeHandlers)).toEqual(['POST']);
    const queryRequest = request('/api/query');
    mocks.handleQuery.mockImplementationOnce(async (transform, schema, receivedRequest) => {
      expect(schema).toBe(mocks.schema);
      expect(receivedRequest).toBe(queryRequest);
      return { query: transform('groups.by-id', { id: 'group-1' }) };
    });

    const response = await routeHandlers.POST({ request: queryRequest });

    expect(mocks.getAuth).toHaveBeenCalledWith(queryRequest);
    expect(mocks.mustGetQuery).toHaveBeenCalledWith(mocks.queries, 'groups.by-id');
    expect(mocks.queryFn).toHaveBeenCalledWith({
      args: { id: 'group-1' },
      ctx: { userID: 'user-1' },
    });
    await expect(response.json()).resolves.toEqual({ query: { transformed: true } });
  });

  it('propagates an unknown dynamic query without returning a misleading response', async () => {
    const failure = new Error('unknown query');
    mocks.mustGetQuery.mockImplementationOnce(() => {
      throw failure;
    });
    mocks.handleQuery.mockImplementationOnce(async transform => transform('missing-query', {}));

    await expect(handlers(QueryRoute).POST({ request: request('/api/query') })).rejects.toBe(
      failure
    );
  });
});

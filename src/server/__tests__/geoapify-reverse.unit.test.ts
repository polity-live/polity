import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator = (value: unknown) => value;
    const chain = {
      validator(nextValidator: (value: unknown) => unknown) {
        validator = nextValidator;
        return chain;
      },
      handler(handler: (input: any) => unknown) {
        return (input: any) => handler({ ...input, data: validator(input.data) });
      },
    };
    return chain;
  },
}));

import { geoapifyReverseFn } from '../geoapify-reverse';

function response({
  ok = true,
  status = 200,
  payload = {},
}: { ok?: boolean; status?: number; payload?: unknown } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(payload) } as unknown as Response;
}

function reverse(overrides: Record<string, unknown> = {}) {
  return (geoapifyReverseFn as any)({
    data: { latitude: 0, longitude: 0, language: 'de', ...overrides },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  process.env.GEOAPIFY_API_KEY = 'server-key';
  delete process.env.VITE_GEOAPIFY_API_KEY;
  mocks.fetch.mockResolvedValue(response());
});

describe('geoapifyReverseFn', () => {
  it('requires a key and falls back to the Vite key', async () => {
    delete process.env.GEOAPIFY_API_KEY;
    await expect(reverse()).rejects.toThrow('Geoapify API key is not configured');

    process.env.VITE_GEOAPIFY_API_KEY = 'vite-key';
    await reverse();
    const url = new URL(mocks.fetch.mock.calls.at(-1)?.[0]);
    expect(url.searchParams.get('apiKey')).toBe('vite-key');
  });

  it('preserves zero coordinates and sends the expected request contract', async () => {
    await reverse({ language: 'en' });
    const [rawUrl, init] = mocks.fetch.mock.calls[0];
    const url = new URL(rawUrl);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      apiKey: 'server-key',
      format: 'json',
      lat: '0',
      lon: '0',
      lang: 'en',
    });
    expect(init).toEqual({ cache: 'no-store', headers: { Accept: 'application/json' } });
  });

  it('reports failed upstream responses', async () => {
    mocks.fetch.mockResolvedValue(response({ ok: false, status: 503 }));
    await expect(reverse()).rejects.toThrow('Geoapify reverse request failed with status 503');
  });

  it('returns the first result or null when results are empty or omitted', async () => {
    const place = { place_id: 'place-1', country: 'Germany', lat: 52, lon: 13 };
    mocks.fetch
      .mockResolvedValueOnce(response({ payload: { results: [place] } }))
      .mockResolvedValueOnce(response({ payload: { results: [] } }))
      .mockResolvedValueOnce(response());
    await expect(reverse()).resolves.toEqual({ result: place });
    await expect(reverse()).resolves.toEqual({ result: null });
    await expect(reverse()).resolves.toEqual({ result: null });
  });

  it('validates input and upstream response schemas', async () => {
    expect(() => reverse({ language: 'x' })).toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();

    mocks.fetch.mockResolvedValue(response({ payload: { results: [{ country: 'Germany' }] } }));
    await expect(reverse()).rejects.toThrow();
  });
});

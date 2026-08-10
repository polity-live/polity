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

import { geoapifySearchFn } from '../geoapify-search';

const emptyValues = {
  country: '',
  region: '',
  city: '',
  post_code: '',
  street: '',
  house_number: '',
};

const emptyContext = {
  country: null,
  region: null,
  city: null,
  post_code: null,
  street: null,
};

function response({
  ok = true,
  status = 200,
  results,
}: { ok?: boolean; status?: number; results?: unknown } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(results === undefined ? {} : { results }),
  } as unknown as Response;
}

async function search(
  field: 'country' | 'region' | 'city' | 'post_code' | 'street' | 'house_number',
  overrides: {
    query?: string;
    values?: Partial<typeof emptyValues>;
    context?: Record<string, any>;
    language?: string;
  } = {}
) {
  return (geoapifySearchFn as any)({
    data: {
      field,
      query: overrides.query ?? 'Berlin',
      values: { ...emptyValues, ...overrides.values },
      context: { ...emptyContext, ...overrides.context },
      language: overrides.language ?? 'de',
    },
  });
}

function lastUrl() {
  return new URL(mocks.fetch.mock.calls.at(-1)?.[0] as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  process.env.GEOAPIFY_API_KEY = 'server-key';
  delete process.env.VITE_GEOAPIFY_API_KEY;
  mocks.fetch.mockResolvedValue(response({ results: [] }));
});

describe('geoapifySearchFn', () => {
  it('requires either a server or Vite API key', async () => {
    delete process.env.GEOAPIFY_API_KEY;
    delete process.env.VITE_GEOAPIFY_API_KEY;
    await expect(search('country')).rejects.toThrow('Geoapify API key is not configured');
    expect(mocks.fetch).not.toHaveBeenCalled();

    process.env.VITE_GEOAPIFY_API_KEY = 'vite-key';
    await search('country');
    expect(lastUrl().searchParams.get('apiKey')).toBe('vite-key');
  });

  it('reports failed upstream responses and sends a non-cached JSON request', async () => {
    mocks.fetch.mockResolvedValue(response({ ok: false, status: 429 }));
    await expect(search('region')).rejects.toThrow('Geoapify request failed with status 429');
    expect(mocks.fetch).toHaveBeenCalledWith(expect.any(String), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  });

  it('maps country filters and the explicit country bias', async () => {
    await search('country', {
      context: {
        country: { place_id: 'country-1', country_code: 'de' },
      },
      language: 'en',
    });
    const url = lastUrl();
    expect(url.searchParams.get('type')).toBe('country');
    expect(url.searchParams.get('filter')).toBe('countrycode:de');
    expect(url.searchParams.get('bias')).toBe('countrycode:none');
    expect(url.searchParams.get('lang')).toBe('en');
    expect(url.searchParams.get('limit')).toBe('6');
  });

  it('maps regions without a bias or filter', async () => {
    await search('region');
    const url = lastUrl();
    expect(url.searchParams.get('type')).toBe('state');
    expect(url.searchParams.has('filter')).toBe(false);
    expect(url.searchParams.has('bias')).toBe(false);
  });

  it('combines country and regional city filters and preserves zero coordinates', async () => {
    await search('city', {
      context: {
        country: { place_id: 'country-1', country_code: 'de' },
        region: { place_id: 'region-1', lon: 0, lat: 0 },
      },
    });
    const url = lastUrl();
    expect(url.searchParams.get('type')).toBe('city');
    expect(url.searchParams.get('filter')).toBe('countrycode:de|place:region-1');
    expect(url.searchParams.get('bias')).toBe('proximity:0,0');
  });

  it('uses city then region as postcode filter fallbacks', async () => {
    await search('post_code', {
      context: {
        city: { place_id: 'city-1', lon: 13, lat: 52 },
        region: { place_id: 'region-1' },
      },
    });
    expect(lastUrl().searchParams.get('filter')).toBe('place:city-1');
    expect(lastUrl().searchParams.get('bias')).toBe('proximity:13,52');

    await search('post_code', { context: { region: { place_id: 'region-1' } } });
    expect(lastUrl().searchParams.get('filter')).toBe('place:region-1');
    expect(lastUrl().searchParams.has('bias')).toBe(false);

    await search('post_code');
    expect(lastUrl().searchParams.has('filter')).toBe(false);
  });

  it('uses postcode, city and region street filter fallbacks', async () => {
    await search('street', {
      context: {
        post_code: { place_id: 'postcode-1', lon: 1, lat: 2 },
        city: { place_id: 'city-1' },
        region: { place_id: 'region-1' },
      },
    });
    expect(lastUrl().searchParams.get('filter')).toBe('place:postcode-1');
    expect(lastUrl().searchParams.get('bias')).toBe('proximity:1,2');

    await search('street', { context: { city: { place_id: 'city-1' } } });
    expect(lastUrl().searchParams.get('filter')).toBe('place:city-1');

    await search('street', { context: { region: { place_id: 'region-1' } } });
    expect(lastUrl().searchParams.get('filter')).toBe('place:region-1');

    await search('street');
    expect(lastUrl().searchParams.has('filter')).toBe(false);
  });

  it('falls through proximity sources and requires both coordinate components', async () => {
    await search('city', {
      context: { country: { place_id: 'country-1', lon: 4, lat: 5 } },
    });
    expect(lastUrl().searchParams.get('bias')).toBe('proximity:4,5');

    await search('city', {
      context: { city: { place_id: 'city-1', lon: 4 } },
    });
    expect(lastUrl().searchParams.has('bias')).toBe(false);

    await search('city', {
      context: { city: { place_id: 'city-1', lat: 5 } },
    });
    expect(lastUrl().searchParams.has('bias')).toBe(false);
  });

  it('builds a complete house-number text without type, filter or bias', async () => {
    await search('house_number', {
      query: ' 12a ',
      values: {
        street: ' Main Street ',
        post_code: ' 12345 ',
        city: ' Berlin ',
        region: ' Berlin ',
        country: ' Germany ',
      },
    });
    const url = lastUrl();
    expect(url.searchParams.get('text')).toBe('12a Main Street, 12345, Berlin, Berlin, Germany');
    expect(url.searchParams.has('type')).toBe(false);
    expect(url.searchParams.has('filter')).toBe(false);
    expect(url.searchParams.has('bias')).toBe(false);

    await search('house_number', { query: '', values: emptyValues });
    expect(lastUrl().searchParams.get('text')).toBe('');
  });

  it('returns upstream results and normalizes an omitted result list', async () => {
    const place = { place_id: 'place-1', city: 'Berlin' };
    mocks.fetch
      .mockResolvedValueOnce(response({ results: [place] }))
      .mockResolvedValueOnce(response());
    await expect(search('city')).resolves.toEqual({ results: [place] });
    await expect(search('city')).resolves.toEqual({ results: [] });
  });

  it('validates language and address fields before fetching', async () => {
    await expect(search('city', { language: 'x' })).rejects.toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

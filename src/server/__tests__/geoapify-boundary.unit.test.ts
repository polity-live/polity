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

import { geoapifyBoundaryFn } from '../geoapify-boundary';

const values = {
  country: 'Germany',
  region: 'Berlin',
  city: 'Berlin',
  post_code: '10115',
  street: 'Main Street',
  house_number: '1',
};

function boundary(overrides: Record<string, unknown> = {}) {
  return (geoapifyBoundaryFn as any)({
    data: {
      field: 'city',
      placeId: 'place-1',
      latitude: null,
      longitude: null,
      values,
      resolvedAddress: null,
      language: 'de',
      ...overrides,
    },
  });
}

function response({
  ok = true,
  status = 200,
  payload = {},
}: { ok?: boolean; status?: number; payload?: unknown } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(payload) } as unknown as Response;
}

function polygon(
  properties: Record<string, unknown> | undefined,
  bbox?: unknown,
  coordinates: unknown = [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
  ],
  type: 'Polygon' | 'MultiPolygon' = 'Polygon'
) {
  return { type: 'Feature', properties, bbox, geometry: { type, coordinates } };
}

function lastUrl() {
  return new URL(mocks.fetch.mock.calls.at(-1)?.[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  process.env.GEOAPIFY_API_KEY = 'server-key';
  delete process.env.VITE_GEOAPIFY_API_KEY;
  mocks.fetch.mockResolvedValue(response());
});

describe('geoapifyBoundaryFn point and request boundary', () => {
  it('returns point shapes for street and house-number fields with all place-id fallbacks', async () => {
    await expect(boundary({ field: 'street', placeId: 'direct' })).resolves.toEqual({
      shape: {
        kind: 'point',
        placeId: 'direct',
        boundarySource: null,
        geometry: null,
        bounds: null,
      },
    });
    await expect(
      boundary({ field: 'house_number', placeId: null, resolvedAddress: { place_id: 'resolved' } })
    ).resolves.toMatchObject({ shape: { kind: 'point', placeId: 'resolved' } });
    await expect(
      boundary({ field: 'street', placeId: null, resolvedAddress: null })
    ).resolves.toMatchObject({ shape: { kind: 'point', placeId: null } });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('requires a server or Vite API key for boundary-capable fields', async () => {
    delete process.env.GEOAPIFY_API_KEY;
    await expect(boundary()).rejects.toThrow('Geoapify API key is not configured');

    process.env.VITE_GEOAPIFY_API_KEY = 'vite-key';
    await boundary();
    expect(lastUrl().searchParams.get('apiKey')).toBe('vite-key');
  });

  it('returns a typed empty boundary when neither id nor complete coordinates exist', async () => {
    await expect(
      boundary({
        placeId: null,
        latitude: 52,
        longitude: null,
        resolvedAddress: { place_id: 'resolved' },
      })
    ).resolves.toEqual({
      shape: {
        kind: 'city',
        placeId: 'resolved',
        boundarySource: 'geoapify:administrative',
        geometry: null,
        bounds: null,
      },
    });
    await expect(
      boundary({ placeId: null, latitude: null, longitude: 13, resolvedAddress: null })
    ).resolves.toMatchObject({ shape: { placeId: null } });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('builds id and zero-coordinate URLs with field-specific request settings', async () => {
    await boundary({ field: 'post_code' });
    expect(Object.fromEntries(lastUrl().searchParams)).toMatchObject({
      id: 'place-1',
      boundaries: 'postal_code',
      geometry: 'geometry_1000',
    });

    await boundary({ field: 'region', placeId: null, latitude: 0, longitude: 0, language: 'en' });
    expect(Object.fromEntries(lastUrl().searchParams)).toMatchObject({
      lat: '0',
      lon: '0',
      lang: 'en',
      boundaries: 'administrative',
      geometry: 'geometry_10000',
    });
  });

  it('reports upstream failures and validates input before fetching', async () => {
    mocks.fetch.mockResolvedValue(response({ ok: false, status: 429 }));
    await expect(boundary()).rejects.toThrow('Geoapify boundary request failed with status 429');
    expect(mocks.fetch).toHaveBeenCalledWith(expect.any(String), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    expect(() => boundary({ language: 'x' })).toThrow();
  });
});

describe('geoapify boundary feature selection', () => {
  it.each([
    ['post_code', 'postcode', { postcode: 'Resolved Postcode' }, { postcode: 'Resolved Postcode' }],
    ['city', 'city', { city: 'Resolved City' }, { town: 'Resolved City' }],
    ['region', 'region', { state: 'Resolved Region' }, { province: 'Resolved Region' }],
    ['country', 'country', { country: 'Resolved Country' }, { name: 'Resolved Country' }],
  ] as const)(
    'selects a %s feature using resolved target values',
    async (field, kind, resolvedAddress, properties) => {
      mocks.fetch.mockResolvedValue(
        response({ payload: { features: [polygon(properties, [1, 2, 3, 4])] } })
      );
      await expect(boundary({ field, resolvedAddress })).resolves.toMatchObject({
        shape: {
          kind,
          geometry: { type: 'Polygon' },
          bounds: { west: 1, south: 2, east: 3, north: 4 },
        },
      });
    }
  );

  it.each([
    ['post_code', { post_code: '10115' }],
    ['city', { municipality: 'Berlin' }],
    ['region', { region: 'Berlin' }],
    ['country', { country: 'Germany' }],
  ] as const)('falls back to entered values for %s', async (field, properties) => {
    mocks.fetch.mockResolvedValue(
      response({ payload: { features: [polygon(properties, [0, 0, 1, 1])] } })
    );
    await expect(boundary({ field, resolvedAddress: null })).resolves.toMatchObject({
      shape: { geometry: { type: 'Polygon' } },
    });
  });

  it('chooses the smallest matching city and largest unmatched country polygon', async () => {
    const small = polygon({ city: 'Berlin' }, [0, 0, 1, 1]);
    const large = polygon({ name: 'Berlin' }, [0, 0, 10, 10]);
    const nonMatch = polygon({ city: 'Hamburg' }, [0, 0, 0.5, 0.5]);
    const point = {
      type: 'Feature',
      properties: { city: 'Berlin' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    };
    mocks.fetch.mockResolvedValue(
      response({ payload: { features: [large, small, nonMatch, point] } })
    );
    await expect(boundary({ field: 'city' })).resolves.toMatchObject({
      shape: { bounds: { east: 1, north: 1 } },
    });

    const countrySmall = polygon(undefined, [0, 0, 1, 1]);
    const countryLarge = polygon(undefined, [0, 0, 20, 20], [[['invalid']]], 'MultiPolygon');
    mocks.fetch.mockResolvedValue(
      response({ payload: { features: [countrySmall, countryLarge] } })
    );
    await expect(
      boundary({ field: 'country', values: { ...values, country: ' ' } })
    ).resolves.toMatchObject({
      shape: { geometry: { type: 'MultiPolygon' }, bounds: { east: 20, north: 20 } },
    });
  });

  it('uses geometry bounds when bbox is missing, short or malformed', async () => {
    const coordinates = [
      [
        [-2, 4],
        [3, -1],
        [1, 2],
      ],
    ];
    for (const bbox of [undefined, [0, 1], [0, 1, 'bad', 3]]) {
      mocks.fetch.mockResolvedValue(
        response({ payload: { features: [polygon({ city: 'Berlin' }, bbox, coordinates)] } })
      );
      await expect(boundary()).resolves.toMatchObject({
        shape: { bounds: { west: -2, south: -1, east: 3, north: 4 } },
      });
    }
  });

  it('returns null geometry and bounds for omitted, empty and non-polygon features', async () => {
    mocks.fetch
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ payload: { features: [] } }))
      .mockResolvedValueOnce(
        response({
          payload: {
            features: [
              { type: 'Feature', properties: null, geometry: null },
              { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } },
            ],
          },
        })
      );
    for (let index = 0; index < 3; index++) {
      await expect(boundary()).resolves.toMatchObject({
        shape: { geometry: null, bounds: null },
      });
    }
  });

  it('tolerates malformed polygon coordinate leaves by returning null bounds', async () => {
    mocks.fetch.mockResolvedValue(
      response({
        payload: {
          features: [polygon({ city: 'Berlin' }, undefined, [1, ['x'], [2]])],
        },
      })
    );
    await expect(boundary()).resolves.toMatchObject({
      shape: { geometry: { type: 'Polygon' }, bounds: null },
    });
  });

  it('scores missing properties and sorts a missing bound after a finite city bound', async () => {
    const withoutBounds = polygon(undefined, undefined, [1, ['invalid'], [2]]);
    const finite = polygon({ city: 'Hamburg' }, [0, 0, 2, 2]);
    mocks.fetch.mockResolvedValue(response({ payload: { features: [withoutBounds, finite] } }));
    await expect(boundary({ values: { ...values, city: 'Munich' } })).resolves.toMatchObject({
      shape: { bounds: { west: 0, south: 0, east: 2, north: 2 } },
    });
  });
});

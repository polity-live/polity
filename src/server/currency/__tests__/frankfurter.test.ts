import { beforeEach, describe, expect, it, vi } from 'vitest';

interface CacheRow {
  base_currency: string;
  quote_currency: string;
  requested_date: string;
  rate_date: string;
  rate: number;
  fetched_at: Date;
}

const state = vi.hoisted(() => ({ cache: new Map<string, CacheRow>() }));

vi.mock('../db', () => ({
  currencySql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(' ').replace(/\s+/g, ' ').trim();
    if (query.startsWith('SELECT')) {
      const key = `${values[0]}:${values[1]}:${values[2]}`;
      const row = state.cache.get(key);
      return row ? [row] : [];
    }
    if (query.startsWith('INSERT')) {
      const key = `${values[0]}:${values[1]}:${values[2]}`;
      state.cache.set(key, {
        base_currency: String(values[0]),
        quote_currency: String(values[1]),
        requested_date: String(values[2]),
        rate_date: String(values[3]),
        rate: Number(values[4]),
        fetched_at: new Date(),
      });
      return [];
    }
    return [];
  },
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Frankfurter exchange-rate service', () => {
  beforeEach(() => {
    state.cache.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('validates optional ISO exchange-rate dates', async () => {
    const { validateExchangeRateDate } = await import('../frankfurter');
    expect(validateExchangeRateDate()).toBeUndefined();
    expect(validateExchangeRateDate('2026-07-19')).toBe('2026-07-19');
    expect(() => validateExchangeRateDate('19.07.2026')).toThrow('Invalid exchange-rate date');
    expect(() => validateExchangeRateDate('9999-99-99')).toThrow('Invalid exchange-rate date');
  });

  it('batches quotes sharing base and date into one upstream request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        { date: '2026-07-17', base: 'EUR', quote: 'USD', rate: 1.16 },
        { date: '2026-07-17', base: 'EUR', quote: 'GBP', rate: 0.87 },
      ])
    );
    const { getExchangeRates } = await import('../frankfurter');

    const rates = await getExchangeRates([
      { base: 'EUR', quote: 'USD', date: '2026-07-17' },
      { base: 'EUR', quote: 'GBP', date: '2026-07-17' },
    ]);

    expect(rates).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('quotes')).toBe('USD,GBP');
    expect(url.searchParams.get('date')).toBe('2026-07-17');
  });

  it('uses the latest available rate within the ten-day historical window', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([
          { date: '2026-07-16', base: 'EUR', quote: 'USD', rate: 1.15 },
          { date: '2026-07-17', base: 'EUR', quote: 'USD', rate: 1.16 },
        ])
      );
    const { getExchangeRates } = await import('../frankfurter');
    const [rate] = await getExchangeRates([{ base: 'EUR', quote: 'USD', date: '2026-07-19' }]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rate.rateDate).toBe('2026-07-17');
    expect(rate.rate).toBe(1.16);
    const fallbackUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallbackUrl.searchParams.get('from')).toBe('2026-07-09');
    expect(fallbackUrl.searchParams.get('to')).toBe('2026-07-19');
  });

  it('keeps current cache entries for six hours and marks outage fallbacks stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse([{ date: '2026-07-17', base: 'EUR', quote: 'USD', rate: 1.16 }])
      );
    const { getExchangeRates } = await import('../frankfurter');

    expect((await getExchangeRates([{ base: 'EUR', quote: 'USD' }]))[0].cacheStatus).toBe('fresh');
    vi.setSystemTime(new Date('2026-07-19T05:59:00Z'));
    expect((await getExchangeRates([{ base: 'EUR', quote: 'USD' }]))[0].cacheStatus).toBe('cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-07-19T07:00:00Z'));
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect((await getExchangeRates([{ base: 'EUR', quote: 'USD' }]))[0].cacheStatus).toBe('stale');

    vi.setSystemTime(new Date('2026-07-27T00:01:00Z'));
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await getExchangeRates([{ base: 'EUR', quote: 'USD' }])).toEqual([]);
  });

  it('retries only 429/5xx responses once', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(
        jsonResponse([{ date: '2026-07-17', base: 'EUR', quote: 'USD', rate: 1.16 }])
      );
    const { getExchangeRates } = await import('../frankfurter');
    const rates = await getExchangeRates([{ base: 'EUR', quote: 'USD' }]);
    expect(rates).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers identical currencies locally', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const { getExchangeRates } = await import('../frankfurter');
    const [rate] = await getExchangeRates([{ base: 'JPY', quote: 'JPY', date: '2026-07-19' }]);
    expect(rate.rate).toBe(1);
    expect(rate.cacheStatus).toBe('identity');
    expect(fetchMock).not.toHaveBeenCalled();

    const [latest] = await getExchangeRates([{ base: 'EUR', quote: 'EUR' }]);
    expect(latest.rateDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses historical cache entries regardless of age', async () => {
    state.cache.set('EUR:USD:2026-07-19', {
      base_currency: 'EUR',
      quote_currency: 'USD',
      requested_date: '2026-07-19',
      rate_date: '2026-07-18T00:00:00.000Z',
      rate: 1.14,
      fetched_at: new Date('2020-01-01T00:00:00Z'),
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const { getExchangeRates } = await import('../frankfurter');
    await expect(
      getExchangeRates([{ base: 'EUR', quote: 'USD', date: '2026-07-19' }])
    ).resolves.toMatchObject([
      {
        requestedDate: '2026-07-19',
        rateDate: '2026-07-18',
        cacheStatus: 'cached',
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a still-safe stale cache entry when a successful response omits the quote', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    state.cache.set('EUR:USD:latest', {
      base_currency: 'EUR',
      quote_currency: 'USD',
      requested_date: 'latest',
      rate_date: '2026-07-18',
      rate: 1.14,
      fetched_at: new Date('2026-07-18T12:00:00Z'),
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]));
    const { getExchangeRates } = await import('../frankfurter');
    await expect(getExchangeRates([{ base: 'EUR', quote: 'USD' }])).resolves.toMatchObject([
      { cacheStatus: 'stale', rate: 1.14 },
    ]);
  });

  it('omits absent and over-age cache fallbacks after a malformed successful response', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    state.cache.set('EUR:GBP:latest', {
      base_currency: 'EUR',
      quote_currency: 'GBP',
      requested_date: 'latest',
      rate_date: '2026-07-01',
      rate: 0.8,
      fetched_at: new Date('2026-07-01T00:00:00Z'),
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ rates: [] }));
    const { getExchangeRates } = await import('../frankfurter');
    await expect(
      getExchangeRates([
        { base: 'EUR', quote: 'USD' },
        { base: 'EUR', quote: 'GBP' },
      ])
    ).resolves.toEqual([]);
  });

  it('filters malformed rate rows and future historical rows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        null,
        'invalid',
        { date: 1, base: 'EUR', quote: 'USD', rate: 1 },
        { date: '2026-07-18', base: 1, quote: 'USD', rate: 1 },
        { date: '2026-07-18', base: 'EUR', quote: 1, rate: 1 },
        { date: '2026-07-18', base: 'EUR', quote: 'USD', rate: '1' },
        { date: '2026-07-18', base: 'EUR', quote: 'USD', rate: Number.NaN },
        { date: '2026-07-18', base: 'EUR', quote: 'USD', rate: 0 },
        { date: '2026-07-20', base: 'EUR', quote: 'USD', rate: 2 },
        { date: '2026-07-18', base: 'EUR', quote: 'USD', rate: 1.14 },
      ])
    );
    const { getExchangeRates } = await import('../frankfurter');
    const [rate] = await getExchangeRates([{ base: 'EUR', quote: 'USD', date: '2026-07-19' }]);
    expect(rate.rate).toBe(1.14);
  });

  it.each([400, 429, 503])('rejects exhausted or non-retryable HTTP %s responses', async status => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, status));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getExchangeRates } = await import('../frankfurter');
    await expect(getExchangeRates([{ base: 'EUR', quote: 'USD' }])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(status === 400 ? 1 : 2);
    errorSpy.mockRestore();
  });

  it('loads, normalizes, caches, and validates the currency catalogue', async () => {
    const { frankfurterContracts, getFrankfurterCurrencies } = await import('../frankfurter');
    frankfurterContracts.resetCatalogCache();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse([
          null,
          'USD',
          {},
          { iso_code: ' usd ' },
          { iso_code: 'EUR' },
          { iso_code: 'bad' },
        ])
      );
    await expect(getFrankfurterCurrencies()).resolves.toEqual(['EUR', 'USD']);
    await expect(getFrankfurterCurrencies()).resolves.toEqual(['EUR', 'USD']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    frankfurterContracts.resetCatalogCache();
    fetchMock.mockResolvedValueOnce(jsonResponse({ currencies: [] }));
    await expect(getFrankfurterCurrencies()).rejects.toThrow(
      'Frankfurter returned no supported currencies'
    );

    frankfurterContracts.resetCatalogCache();
    fetchMock.mockResolvedValueOnce(jsonResponse([{}, { iso_code: 'invalid' }]));
    await expect(getFrankfurterCurrencies()).rejects.toThrow(
      'Frankfurter returned no supported currencies'
    );
  });

  it('aborts an upstream request after five seconds without retrying', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    const { getExchangeRates } = await import('../frankfurter');
    const pending = getExchangeRates([{ base: 'EUR', quote: 'USD' }]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

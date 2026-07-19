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

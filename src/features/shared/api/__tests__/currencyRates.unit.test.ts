import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const convertCurrencyMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/shared/logic/currency', () => ({
  convertCurrency: convertCurrencyMock,
}));

import { convertCurrencyAmount, fetchExchangeRates, getExchangeRate } from '../currencyRates';
import type { ExchangeRateQuote } from '@/features/shared/logic/currency';

function quote(
  baseCurrency: string,
  quoteCurrency: string,
  requestedDate: string | null
): ExchangeRateQuote {
  return {
    baseCurrency,
    quoteCurrency,
    requestedDate,
    rateDate: requestedDate ?? '2026-08-04',
    rate: 1.25,
    source: 'frankfurter',
    cacheStatus: 'fresh',
  };
}

function response(rates?: ExchangeRateQuote[]) {
  return {
    ok: true,
    json: vi.fn(async () => (rates === undefined ? {} : { rates })),
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  convertCurrencyMock.mockReset();
  convertCurrencyMock.mockImplementation((amount, rate) => ({ amount, rate }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchExchangeRates', () => {
  it('returns immediately for an empty request batch', async () => {
    await expect(fetchExchangeRates([])).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts the batch and returns rates or an empty payload fallback', async () => {
    const rate = quote('EUR', 'USD', '2026-01-01');
    vi.mocked(fetch).mockResolvedValueOnce(response([rate]) as never);
    const controller = new AbortController();

    await expect(
      fetchExchangeRates([{ base: 'EUR', quote: 'USD', date: '2026-01-01' }], controller.signal)
    ).resolves.toEqual([rate]);
    expect(fetch).toHaveBeenCalledWith('/api/currency/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ base: 'EUR', quote: 'USD', date: '2026-01-01' }],
      }),
      signal: controller.signal,
    });

    vi.mocked(fetch).mockResolvedValueOnce(response() as never);
    await expect(
      fetchExchangeRates([{ base: 'GBP', quote: 'CAD', date: '2026-01-02' }])
    ).resolves.toEqual([]);
  });

  it('rejects a failed HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as never);
    await expect(fetchExchangeRates([{ base: 'EUR', quote: 'CHF' }])).rejects.toThrow(
      'Currency conversion is unavailable'
    );
  });
});

describe('getExchangeRate', () => {
  it('coalesces duplicate lookups, resolves missing quotes, and caches dated and latest rates', async () => {
    const dated = quote('EUR', 'USD', '2026-02-01');
    const latest = quote('GBP', 'CHF', null);
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    vi.mocked(fetch).mockResolvedValueOnce(response([dated, latest]) as never);

    const request = { base: 'EUR', quote: 'USD', date: '2026-02-01' };
    const [first, duplicate, second, missing] = await Promise.all([
      getExchangeRate(request),
      getExchangeRate(request),
      getExchangeRate({ base: 'GBP', quote: 'CHF' }),
      getExchangeRate({ base: 'JPY', quote: 'AUD', date: '2026-02-02' }),
    ]);

    expect(first).toBe(dated);
    expect(duplicate).toBe(dated);
    expect(second).toBe(latest);
    expect(missing).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).requests).toHaveLength(3);

    await expect(getExchangeRate(request)).resolves.toBe(dated);
    await expect(getExchangeRate({ base: 'GBP', quote: 'CHF' })).resolves.toBe(latest);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('refreshes an expired cached rate', async () => {
    const request = { base: 'NOK', quote: 'SEK', date: '2026-03-01' };
    const first = quote('NOK', 'SEK', '2026-03-01');
    const refreshed = { ...first, rate: 1.5 };
    const now = vi.spyOn(Date, 'now').mockReturnValue(2_000);
    vi.mocked(fetch).mockResolvedValueOnce(response([first]) as never);
    await expect(getExchangeRate(request)).resolves.toBe(first);

    now.mockReturnValue(2_000 + 24 * 60 * 60 * 1000 + 1);
    vi.mocked(fetch).mockResolvedValueOnce(response([refreshed]) as never);
    await expect(getExchangeRate(request)).resolves.toBe(refreshed);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects every queued lookup when the shared fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    const first = getExchangeRate({ base: 'CAD', quote: 'NZD', date: '2026-04-01' });
    const second = getExchangeRate({ base: 'CAD', quote: 'AUD', date: '2026-04-01' });
    await expect(first).rejects.toThrow('offline');
    await expect(second).rejects.toThrow('offline');
  });
});

describe('convertCurrencyAmount', () => {
  it('does not request a rate for an already aborted conversion', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      convertCurrencyAmount({ amount: 10, base: 'EUR', quote: 'USD', signal: controller.signal })
    ).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null when the API has no matching quote', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response([]) as never);
    await expect(
      convertCurrencyAmount({ amount: 10, base: 'PLN', quote: 'CZK', date: '2026-05-01' })
    ).resolves.toBeNull();
    expect(convertCurrencyMock).not.toHaveBeenCalled();
  });

  it('converts a resolved quote', async () => {
    const rate = quote('DKK', 'EUR', '2026-06-01');
    vi.mocked(fetch).mockResolvedValueOnce(response([rate]) as never);
    await expect(
      convertCurrencyAmount({ amount: 20, base: 'DKK', quote: 'EUR', date: '2026-06-01' })
    ).resolves.toEqual({ amount: 20, rate });
    expect(convertCurrencyMock).toHaveBeenCalledWith(20, rate);
  });

  it('drops a quote when the signal aborts while the request is in flight', async () => {
    const controller = new AbortController();
    const rate = quote('HUF', 'EUR', '2026-07-01');
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        controller.abort();
        return { rates: [rate] };
      },
    } as never);

    await expect(
      convertCurrencyAmount({
        amount: 30,
        base: 'HUF',
        quote: 'EUR',
        date: '2026-07-01',
        signal: controller.signal,
      })
    ).resolves.toBeNull();
    expect(convertCurrencyMock).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));

vi.mock('@/server/currency/frankfurter', () => ({
  getExchangeRates: vi.fn(),
  validateExchangeRateDate: (date?: string) => {
    if (date === undefined) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new Error('Invalid exchange-rate date');
    }
    return date;
  },
}));

import { getExchangeRates } from '@/server/currency/frankfurter';
import { currencyRateRequestSchema, Route } from '../rates';

const post = (
  Route as unknown as {
    server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;

function request(body: unknown) {
  return new Request('http://localhost/api/currency/rates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('currency rate API validation', () => {
  it('accepts up to 100 normalized requests', () => {
    const requests = Array.from({ length: 100 }, () => ({
      base: 'eur',
      quote: 'usd',
      date: '2026-07-19',
    }));
    const parsed = currencyRateRequestSchema.parse({ requests });
    expect(parsed.requests).toHaveLength(100);
    expect(parsed.requests[0]).toMatchObject({ base: 'EUR', quote: 'USD' });
  });

  it('rejects oversized batches, unsupported currencies and invalid dates', () => {
    expect(() =>
      currencyRateRequestSchema.parse({
        requests: Array.from({ length: 101 }, () => ({ base: 'EUR', quote: 'USD' })),
      })
    ).toThrow();
    expect(() =>
      currencyRateRequestSchema.parse({ requests: [{ base: 'NOPE', quote: 'USD' }] })
    ).toThrow();
    expect(() =>
      currencyRateRequestSchema.parse({
        requests: [{ base: 'EUR', quote: 'USD', date: '2026-99-99' }],
      })
    ).toThrow();
  });

  it('returns rates and maps validation and provider failures', async () => {
    const mockedGetExchangeRates = vi.mocked(getExchangeRates);
    mockedGetExchangeRates.mockResolvedValueOnce([
      { base: 'EUR', quote: 'USD', date: null, rate: 1.1 },
    ] as never);
    let response = await post({
      request: request({ requests: [{ base: 'EUR', quote: 'USD' }] }),
    });
    expect(response.status).toBe(200);

    response = await post({ request: request({ requests: [{ base: 'NOPE', quote: 'USD' }] }) });
    expect(response.status).toBe(400);

    mockedGetExchangeRates.mockRejectedValueOnce(new Error('provider failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    response = await post({
      request: request({ requests: [{ base: 'EUR', quote: 'USD' }] }),
    });
    expect(response.status).toBe(502);
    errorSpy.mockRestore();
  });
});

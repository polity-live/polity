import { describe, expect, it, vi } from 'vitest';

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

import { currencyRateRequestSchema } from '../rates';

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
});

import { describe, expect, it } from 'vitest';
import type { GroupPaymentRow } from '@/zero/groups/queries';
import { buildPaymentConversions, buildPaymentRateRequests } from '../usePaymentConversions';
import type { ExchangeRateQuote } from '@/features/shared/logic/currency';

function payment(id: string, amount: number, currency: string, createdAt: string): GroupPaymentRow {
  return {
    id,
    amount,
    currency,
    created_at: Date.parse(createdAt),
  } as GroupPaymentRow;
}

function rate(baseCurrency: string, requestedDate: string, value: number): ExchangeRateQuote {
  return {
    baseCurrency,
    quoteCurrency: 'EUR',
    requestedDate,
    rateDate: requestedDate,
    rate: value,
    source: 'frankfurter',
    cacheStatus: 'cached',
  };
}

describe('group payment conversions', () => {
  const payments = [
    payment('usd-friday', 100, 'USD', '2026-07-17T23:59:59Z'),
    payment('gbp-monday', 100, 'GBP', '2026-07-20T00:00:01Z'),
    payment('usd-friday-2', 50, 'USD', '2026-07-17T08:00:00Z'),
  ];

  it('deduplicates rates by original currency, target and UTC creation date', () => {
    expect(buildPaymentRateRequests(payments, 'EUR')).toEqual([
      { base: 'USD', quote: 'EUR', date: '2026-07-17' },
      { base: 'GBP', quote: 'EUR', date: '2026-07-20' },
    ]);
  });

  it('uses each historical rate and excludes items with a missing rate', () => {
    const conversions = buildPaymentConversions(payments, 'EUR', [rate('USD', '2026-07-17', 0.86)]);

    expect(conversions['usd-friday'].convertedAmount).toBe(86);
    expect(conversions['usd-friday-2'].convertedAmount).toBe(43);
    expect(conversions['gbp-monday']).toBeUndefined();
  });
});

/* @vitest-environment jsdom */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  convert: vi.fn((amount: number, rate: any) => ({ ...rate, convertedAmount: amount * rate.rate })),
}));
vi.mock('@/features/shared/api/currencyRates', () => ({ fetchExchangeRates: mocks.fetch }));
vi.mock('@/features/shared/logic/currency', () => ({ convertCurrency: mocks.convert }));

import {
  buildPaymentConversions,
  buildPaymentRateRequests,
  paymentRateDate,
  usePaymentConversions,
} from '../usePaymentConversions';

const payment = (id: string, amount: number, currency: string | null, day = 1) =>
  ({
    id,
    amount,
    currency,
    created_at: Date.UTC(2026, 0, day),
  }) as any;
const rate = {
  baseCurrency: 'USD',
  quoteCurrency: 'EUR',
  requestedDate: '2026-01-01',
  rateDate: '2026-01-01',
  rate: 2,
  source: 'frankfurter',
  cacheStatus: 'fresh',
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('payment conversion decisions', () => {
  it('uses UTC dates, default currencies, identity rates, remote rates, and skips invalid or missing conversions', () => {
    expect(paymentRateDate(Date.UTC(2026, 0, 2, 23))).toBe('2026-01-02');
    const payments = [
      payment('identity', 10, 'EUR'),
      payment('default', 5, null),
      payment('usd', 3, 'USD'),
      payment('missing', 4, 'GBP'),
      payment('invalid', Number.NaN, 'USD'),
    ];
    expect(buildPaymentRateRequests(payments, 'EUR')).toEqual([
      { base: 'USD', quote: 'EUR', date: '2026-01-01' },
      { base: 'GBP', quote: 'EUR', date: '2026-01-01' },
    ]);
    expect(buildPaymentRateRequests([payment('default-usd', 1, null)], 'USD')).toEqual([
      { base: 'EUR', quote: 'USD', date: '2026-01-01' },
    ]);
    const conversions = buildPaymentConversions(payments, 'EUR', [
      rate as any,
      { ...rate, baseCurrency: 'unused', requestedDate: null } as any,
    ]);
    expect(conversions.identity.convertedAmount).toBe(10);
    expect(conversions.default.convertedAmount).toBe(5);
    expect(conversions.usd.convertedAmount).toBe(6);
    expect(conversions.missing).toBeUndefined();
    expect(conversions.invalid).toBeUndefined();
  });
});

describe('usePaymentConversions', () => {
  it('loads rates and derives converted and missing payment totals', async () => {
    mocks.fetch.mockResolvedValueOnce([rate]);
    const payments = [
      payment('identity', 10, 'EUR'),
      payment('usd', 3, 'USD'),
      payment('missing-a', 4, 'GBP'),
      payment('missing-b', 6, 'GBP'),
      payment('missing-default', 2, null),
      payment('invalid', Number.NaN, 'USD'),
    ];
    const { result } = renderHook(() => usePaymentConversions(payments, 'EUR'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.convertiblePayments.map(item => item.id)).toEqual([
      'identity',
      'usd',
      'missing-default',
    ]);
    expect(result.current.missingPayments.map(item => item.id)).toEqual(['missing-a', 'missing-b']);
    expect(result.current.missingOriginalTotals).toEqual({ GBP: 10 });
  });

  it('ignores abort errors and clears conversions for other failures', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    mocks.fetch.mockRejectedValueOnce(abort);
    const abortedPayments = [payment('usd', 1, 'USD')];
    const aborted = renderHook(() => usePaymentConversions(abortedPayments, 'EUR'));
    await waitFor(() => expect(aborted.result.current.isLoading).toBe(false));
    expect(console.error).not.toHaveBeenCalled();

    mocks.fetch.mockRejectedValueOnce('network');
    const failedPayments = [payment('usd', 1, 'USD')];
    const failed = renderHook(() => usePaymentConversions(failedPayments, 'EUR'));
    await waitFor(() => expect(failed.result.current.isLoading).toBe(false));
    expect(console.error).toHaveBeenCalled();

    mocks.fetch.mockRejectedValueOnce(new Error('network'));
    const failedErrorPayments = [payment('usd', 1, 'USD')];
    const failedError = renderHook(() => usePaymentConversions(failedErrorPayments, 'EUR'));
    await waitFor(() => expect(failedError.result.current.isLoading).toBe(false));
  });

  it('aborts outstanding requests during cleanup without applying their final state', async () => {
    let resolve!: (rates: any[]) => void;
    mocks.fetch.mockReturnValueOnce(
      new Promise<any[]>(done => {
        resolve = done;
      })
    );
    const payments = [payment('usd', 1, 'USD')];
    const hook = renderHook(() => usePaymentConversions(payments, 'EUR'));
    expect(hook.result.current.isLoading).toBe(true);
    hook.unmount();
    resolve([rate]);
    await Promise.resolve();
    await Promise.resolve();
  });
});

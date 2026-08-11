// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  displayCurrency: 'EUR' as string | undefined,
  convertCurrencyAmount: vi.fn(),
  convertCurrency: vi.fn((amount: number, rate: unknown) => ({ amount, rate, identity: true })),
}));

vi.mock('@/features/shared/api/currencyRates', () => ({
  convertCurrencyAmount: mocks.convertCurrencyAmount,
}));

vi.mock('@/features/shared/logic/currency', () => ({
  convertCurrency: mocks.convertCurrency,
}));

vi.mock('@/features/shared/global-state/currency.store', () => ({
  useDisplayCurrencyStore: (
    selector: (state: { displayCurrency: string | undefined }) => unknown
  ) => selector({ displayCurrency: mocks.displayCurrency }),
}));

import { useCurrencyConversion } from '../useCurrencyConversion';

type CurrencyConversionArgs = Parameters<typeof useCurrencyConversion>[0];

beforeEach(() => {
  mocks.displayCurrency = 'EUR';
  mocks.convertCurrencyAmount.mockReset();
  mocks.convertCurrency.mockClear();
});

describe('useCurrencyConversion', () => {
  it('clears conversion for each invalid input boundary', () => {
    const { result, rerender } = renderHook(
      (props: CurrencyConversionArgs) => useCurrencyConversion(props),
      { initialProps: { amount: undefined, currency: 'USD' } as CurrencyConversionArgs }
    );
    expect(result.current).toMatchObject({ conversion: null, isLoading: false });

    rerender({ amount: Number.NaN, currency: 'USD' });
    rerender({ amount: 1, currency: null });
    expect(mocks.convertCurrencyAmount).not.toHaveBeenCalled();

    mocks.displayCurrency = undefined;
    rerender({ amount: 1, currency: 'USD' });
    expect(result.current.targetCurrency).toBeUndefined();
    expect(mocks.convertCurrencyAmount).not.toHaveBeenCalled();
  });

  it('returns identity conversions with and without an explicit date', () => {
    const { result, rerender } = renderHook(
      (props: CurrencyConversionArgs) => useCurrencyConversion(props),
      { initialProps: { amount: 5, currency: 'EUR' } as CurrencyConversionArgs }
    );
    expect(result.current.conversion).toMatchObject({ amount: 5, identity: true });
    expect(mocks.convertCurrency).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining({ requestedDate: null, rate: 1, cacheStatus: 'identity' })
    );

    rerender({ amount: 7, currency: 'USD', targetCurrency: 'USD', date: '2026-01-02' });
    expect(result.current.targetCurrency).toBe('USD');
    expect(mocks.convertCurrency).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ requestedDate: '2026-01-02', rateDate: '2026-01-02' })
    );
  });

  it('loads a remote conversion and handles a non-aborted rejection', async () => {
    const converted = { convertedAmount: 9 };
    mocks.convertCurrencyAmount.mockResolvedValueOnce(converted);
    const success = renderHook(() =>
      useCurrencyConversion({ amount: 5, currency: 'USD', targetCurrency: 'EUR' })
    );
    expect(success.result.current.isLoading).toBe(true);
    await waitFor(() => expect(success.result.current.isLoading).toBe(false));
    expect(success.result.current.conversion).toBe(converted);
    expect(mocks.convertCurrencyAmount).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5, base: 'USD', quote: 'EUR', date: undefined })
    );
    success.unmount();

    mocks.convertCurrencyAmount.mockRejectedValueOnce(new Error('offline'));
    const failure = renderHook(() =>
      useCurrencyConversion({ amount: 2, currency: 'USD', targetCurrency: 'EUR' })
    );
    await waitFor(() => expect(failure.result.current.isLoading).toBe(false));
    expect(failure.result.current.conversion).toBeNull();
    failure.unmount();
  });

  it('ignores resolution and rejection after their request is aborted', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise(value => {
      resolve = value;
    });
    mocks.convertCurrencyAmount.mockReturnValueOnce(pending);
    const resolved = renderHook(() =>
      useCurrencyConversion({ amount: 1, currency: 'USD', targetCurrency: 'EUR' })
    );
    resolved.unmount();
    await act(async () => resolve({ convertedAmount: 1 }));

    let reject!: (reason: unknown) => void;
    const rejectedPending = new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    mocks.convertCurrencyAmount.mockReturnValueOnce(rejectedPending);
    const rejected = renderHook(() =>
      useCurrencyConversion({ amount: 2, currency: 'USD', targetCurrency: 'EUR' })
    );
    rejected.unmount();
    await act(async () => reject(new Error('late failure')));
  });
});

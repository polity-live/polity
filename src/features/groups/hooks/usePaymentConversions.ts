import { useEffect, useMemo, useState } from 'react';
import { fetchExchangeRates } from '@/features/shared/api/currencyRates';
import {
  convertCurrency,
  type CurrencyCode,
  type CurrencyConversionResult,
  type ExchangeRateQuote,
} from '@/features/shared/logic/currency';
import type { GroupPaymentRow } from '@/zero/groups/queries';

export function paymentRateDate(createdAt: number): string {
  return new Date(createdAt).toISOString().slice(0, 10);
}

function requestKey(base: string, quote: string, date: string | null | undefined) {
  return `${base}:${quote}:${date ?? ''}`;
}

export function buildPaymentRateRequests(
  payments: readonly GroupPaymentRow[],
  targetCurrency: CurrencyCode
) {
  return Array.from(
    new Map(
      payments
        .filter(payment => (payment.currency || 'EUR') !== targetCurrency)
        .map(payment => {
          const base = payment.currency || 'EUR';
          const date = paymentRateDate(payment.created_at);
          return [requestKey(base, targetCurrency, date), { base, quote: targetCurrency, date }];
        })
    ).values()
  );
}

export function buildPaymentConversions(
  payments: readonly GroupPaymentRow[],
  targetCurrency: CurrencyCode,
  rates: readonly ExchangeRateQuote[]
) {
  const byRequest = new Map(
    rates.map(rate => [requestKey(rate.baseCurrency, rate.quoteCurrency, rate.requestedDate), rate])
  );
  const next: Record<string, CurrencyConversionResult> = {};
  for (const payment of payments) {
    const amount = payment.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) continue;
    const base = payment.currency || 'EUR';
    const date = paymentRateDate(payment.created_at);
    const rate = byRequest.get(requestKey(base, targetCurrency, date));
    if (base === targetCurrency) {
      next[payment.id] = convertCurrency(amount, {
        baseCurrency: base,
        quoteCurrency: targetCurrency,
        requestedDate: date,
        rateDate: date,
        rate: 1,
        source: 'frankfurter',
        cacheStatus: 'identity',
      });
    } else if (rate) next[payment.id] = convertCurrency(amount, rate);
  }
  return next;
}

export function usePaymentConversions(
  payments: readonly GroupPaymentRow[],
  targetCurrency: CurrencyCode
) {
  const [conversions, setConversions] = useState<Record<string, CurrencyConversionResult>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const requests = buildPaymentRateRequests(payments, targetCurrency);

    setConversions({});
    setIsLoading(true);
    void fetchExchangeRates(requests, controller.signal)
      .then(rates => {
        setConversions(buildPaymentConversions(payments, targetCurrency, rates));
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Payment currency conversion failed:', error);
        setConversions({});
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [payments, targetCurrency]);

  return useMemo(() => {
    const convertiblePayments = payments.flatMap(payment => {
      const conversion = conversions[payment.id];
      return conversion ? [{ ...payment, amount: conversion.convertedAmount }] : [];
    });
    const missingPayments = isLoading
      ? []
      : payments.filter(
          (payment): payment is GroupPaymentRow & { amount: number } =>
            typeof payment.amount === 'number' &&
            Number.isFinite(payment.amount) &&
            !conversions[payment.id]
        );
    const missingOriginalTotals = missingPayments.reduce<Record<string, number>>(
      (totals, payment) => {
        const currency = payment.currency || 'EUR';
        totals[currency] = (totals[currency] ?? 0) + payment.amount;
        return totals;
      },
      {}
    );
    return { conversions, convertiblePayments, missingPayments, missingOriginalTotals, isLoading };
  }, [conversions, isLoading, payments]);
}

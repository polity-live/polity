import { useEffect, useState } from 'react';
import { convertCurrencyAmount } from '@/features/shared/api/currencyRates';
import type { CurrencyCode, CurrencyConversionResult } from '@/features/shared/logic/currency';
import { convertCurrency } from '@/features/shared/logic/currency';
import { useDisplayCurrencyStore } from '@/features/shared/global-state/currency.store';

export function useCurrencyConversion(args: {
  amount: number | null | undefined;
  currency: CurrencyCode | null | undefined;
  date?: string;
  targetCurrency?: CurrencyCode;
}) {
  const displayCurrency = useDisplayCurrencyStore(state => state.displayCurrency);
  const targetCurrency = args.targetCurrency ?? displayCurrency;
  const [conversion, setConversion] = useState<CurrencyConversionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const amount = args.amount;
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      !args.currency ||
      !targetCurrency
    ) {
      setConversion(null);
      setIsLoading(false);
      return;
    }

    if (args.currency === targetCurrency) {
      setConversion(
        convertCurrency(amount, {
          baseCurrency: args.currency,
          quoteCurrency: targetCurrency,
          requestedDate: args.date ?? null,
          rateDate: args.date ?? new Date().toISOString().slice(0, 10),
          rate: 1,
          source: 'frankfurter',
          cacheStatus: 'identity',
        })
      );
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setConversion(null);
    setIsLoading(true);
    void convertCurrencyAmount({
      amount,
      base: args.currency,
      quote: targetCurrency,
      date: args.date,
      signal: controller.signal,
    })
      .then(result => {
        if (!controller.signal.aborted) setConversion(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setConversion(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [args.amount, args.currency, args.date, targetCurrency]);

  return { conversion, isLoading, targetCurrency };
}

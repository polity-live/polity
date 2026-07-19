import { useEffect, useMemo, useState } from 'react';
import {
  getLocalizedCurrencyName,
  FRANKFURTER_FALLBACK_CURRENCY_CODES,
  type CurrencyCode,
  type CurrencyLanguage,
} from '@/features/shared/logic/currency';

let cachedCurrencies: string[] | null = null;

export function useCurrencyCatalog(language: CurrencyLanguage) {
  const [currencies, setCurrencies] = useState<string[]>(
    cachedCurrencies ?? [...FRANKFURTER_FALLBACK_CURRENCY_CODES]
  );

  useEffect(() => {
    if (cachedCurrencies) return;
    const controller = new AbortController();
    void fetch('/api/currency/currencies', { signal: controller.signal })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error('unavailable'))))
      .then((payload: { currencies?: string[] }) => {
        if (!payload.currencies?.length) return;
        cachedCurrencies = payload.currencies;
        setCurrencies(payload.currencies);
      })
      .catch(error => {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Currency catalogue is unavailable:', error);
        }
      });
    return () => controller.abort();
  }, []);

  return useMemo(
    () =>
      currencies.map(code => ({
        code: code as CurrencyCode,
        name: getLocalizedCurrencyName(code, language),
        label: `${getLocalizedCurrencyName(code, language)} (${code})`,
      })),
    [currencies, language]
  );
}

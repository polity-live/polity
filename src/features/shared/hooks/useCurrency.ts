import { useMemo } from 'react';
import { useTranslation } from './use-translation';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import {
  formatCurrencyMajor,
  formatCurrencyMinor,
  type CurrencyCode,
} from '@/features/shared/logic/currency';

export function useCurrency() {
  const { language } = useTranslation();
  const { displayCurrency, isLoading } = usePreferenceState();

  return useMemo(
    () => ({
      displayCurrency,
      isLoading,
      formatMajor: (amount: number, currency: CurrencyCode = displayCurrency) =>
        formatCurrencyMajor(amount, currency, language),
      formatMinor: (amountMinor: number, currency: CurrencyCode = displayCurrency) =>
        formatCurrencyMinor(amountMinor, currency, language),
      formatConvertedMajor: (amount: number, currency: CurrencyCode = displayCurrency) =>
        formatCurrencyMajor(amount, currency, language, { approximate: true }),
      language,
    }),
    [displayCurrency, isLoading, language]
  );
}

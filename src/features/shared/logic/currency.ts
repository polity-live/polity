import { z } from 'zod';

export type CurrencyCode = string;
export type CurrencyLanguage = 'de' | 'en';
export type ExchangeRateCacheStatus = 'identity' | 'fresh' | 'cached' | 'stale';

export interface ExchangeRateQuote {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  requestedDate: string | null;
  rateDate: string;
  rate: number;
  source: 'frankfurter';
  cacheStatus: ExchangeRateCacheStatus;
}

export interface CurrencyConversionResult extends ExchangeRateQuote {
  originalAmount: number;
  convertedAmount: number;
}

export const FRANKFURTER_FALLBACK_CURRENCY_CODES = [
  'AED',
  'AUD',
  'BGN',
  'BRL',
  'CAD',
  'CHF',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'GBP',
  'HKD',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'ISK',
  'JPY',
  'KRW',
  'KWD',
  'MXN',
  'MYR',
  'NOK',
  'NZD',
  'PHP',
  'PLN',
  'RON',
  'SEK',
  'SGD',
  'THB',
  'TRY',
  'USD',
  'ZAR',
] as const;

function runtimeCurrencyCodes(): string[] {
  try {
    return typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('currency')
      : [...FRANKFURTER_FALLBACK_CURRENCY_CODES];
  } catch {
    return [...FRANKFURTER_FALLBACK_CURRENCY_CODES];
  }
}

export const SUPPORTED_CURRENCY_CODES = runtimeCurrencyCodes();
const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);

export function normalizeCurrencyCode(value: string): CurrencyCode {
  return value.trim().toUpperCase();
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  const normalized = normalizeCurrencyCode(value);
  return /^[A-Z]{3}$/.test(normalized) && SUPPORTED_CURRENCY_SET.has(normalized);
}

export const currencyCodeSchema = z
  .string()
  .transform(normalizeCurrencyCode)
  .refine(isCurrencyCode, 'Unsupported ISO 4217 currency code');

export function currencyLocale(language: CurrencyLanguage): string {
  return language === 'de' ? 'de-DE' : 'en-US';
}

export function getCurrencyFractionDigits(currency: CurrencyCode): number {
  return (
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: normalizeCurrencyCode(currency),
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function roundCurrencyAmount(amount: number, currency: CurrencyCode): number {
  const factor = 10 ** getCurrencyFractionDigits(currency);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function majorToMinor(amount: number, currency: CurrencyCode): number {
  return Math.round(amount * 10 ** getCurrencyFractionDigits(currency));
}

export function minorToMajor(amountMinor: number, currency: CurrencyCode): number {
  return amountMinor / 10 ** getCurrencyFractionDigits(currency);
}

export function formatCurrencyMajor(
  amount: number,
  currency: CurrencyCode,
  language: CurrencyLanguage = 'en',
  options?: { approximate?: boolean; currencyDisplay?: 'symbol' | 'code' | 'name' }
): string {
  const formatted = new Intl.NumberFormat(currencyLocale(language), {
    style: 'currency',
    currency: normalizeCurrencyCode(currency),
    currencyDisplay: options?.currencyDisplay ?? 'symbol',
  }).format(amount);
  return options?.approximate ? `≈ ${formatted}` : formatted;
}

export function formatCurrencyMinor(
  amountMinor: number,
  currency: CurrencyCode,
  language: CurrencyLanguage = 'en',
  options?: { approximate?: boolean; currencyDisplay?: 'symbol' | 'code' | 'name' }
): string {
  return formatCurrencyMajor(minorToMajor(amountMinor, currency), currency, language, options);
}

/** Locale-neutral representation for persisted audit and AI text. */
export function formatCurrencyMinorAudit(amountMinor: number, currency: CurrencyCode): string {
  const digits = getCurrencyFractionDigits(currency);
  return `${minorToMajor(amountMinor, currency).toFixed(digits)} ${normalizeCurrencyCode(currency)}`;
}

export function convertCurrency(
  amount: number,
  quote: ExchangeRateQuote
): CurrencyConversionResult {
  return {
    ...quote,
    originalAmount: amount,
    convertedAmount: roundCurrencyAmount(amount * quote.rate, quote.quoteCurrency),
  };
}

export function getLocalizedCurrencyName(
  currency: CurrencyCode,
  language: CurrencyLanguage
): string {
  try {
    return (
      new Intl.DisplayNames([currencyLocale(language)], { type: 'currency' }).of(currency) ??
      currency
    );
  } catch {
    return currency;
  }
}

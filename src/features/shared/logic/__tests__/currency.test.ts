import { describe, expect, it } from 'vitest';
import {
  convertCurrency,
  formatCurrencyMajor,
  formatCurrencyMinorAudit,
  getCurrencyFractionDigits,
  majorToMinor,
  minorToMajor,
} from '../currency';

describe('currency', () => {
  it('uses ISO 4217 precision from Intl', () => {
    expect(getCurrencyFractionDigits('JPY')).toBe(0);
    expect(getCurrencyFractionDigits('EUR')).toBe(2);
    expect(getCurrencyFractionDigits('KWD')).toBe(3);
    expect(getCurrencyFractionDigits('CLF')).toBe(4);
  });

  it('round-trips major and minor amounts using the currency precision', () => {
    expect(majorToMinor(12.3456, 'CLF')).toBe(123456);
    expect(minorToMajor(123456, 'CLF')).toBe(12.3456);
    expect(majorToMinor(12.6, 'JPY')).toBe(13);
  });

  it('multiplies by the rate and rounds only to target precision', () => {
    const result = convertCurrency(10.005, {
      baseCurrency: 'EUR',
      quoteCurrency: 'USD',
      requestedDate: '2026-07-17',
      rateDate: '2026-07-17',
      rate: 1.23456,
      source: 'frankfurter',
      cacheStatus: 'fresh',
    });

    expect(result.originalAmount).toBe(10.005);
    expect(result.convertedAmount).toBe(12.35);
  });

  it('handles identity rates without changing the amount', () => {
    const result = convertCurrency(42.42, {
      baseCurrency: 'EUR',
      quoteCurrency: 'EUR',
      requestedDate: null,
      rateDate: '2026-07-19',
      rate: 1,
      source: 'frankfurter',
      cacheStatus: 'identity',
    });
    expect(result.convertedAmount).toBe(42.42);
  });

  it('formats localized UI values and locale-neutral audit values', () => {
    expect(formatCurrencyMajor(1234.5, 'EUR', 'de')).toContain('1.234,50');
    expect(formatCurrencyMinorAudit(123456, 'CLF')).toBe('12.3456 CLF');
  });
});

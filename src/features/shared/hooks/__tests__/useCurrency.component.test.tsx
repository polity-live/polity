/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCurrency } from '../useCurrency';

const formatMajor = vi.hoisted(() => vi.fn(() => 'major'));
const formatMinor = vi.hoisted(() => vi.fn(() => 'minor'));
vi.mock('../use-translation', () => ({ useTranslation: () => ({ language: 'de' }) }));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency: 'EUR', isLoading: false }),
}));
vi.mock('@/features/shared/logic/currency', () => ({
  formatCurrencyMajor: formatMajor,
  formatCurrencyMinor: formatMinor,
}));

describe('useCurrency', () => {
  it('formats default and explicit currencies including approximate conversions', () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.formatMajor(1)).toBe('major');
    expect(formatMajor).toHaveBeenLastCalledWith(1, 'EUR', 'de');
    result.current.formatMajor(2, 'USD');
    expect(formatMajor).toHaveBeenLastCalledWith(2, 'USD', 'de');
    result.current.formatMinor(300);
    expect(formatMinor).toHaveBeenLastCalledWith(300, 'EUR', 'de');
    result.current.formatMinor(400, 'USD');
    expect(formatMinor).toHaveBeenLastCalledWith(400, 'USD', 'de');
    result.current.formatConvertedMajor(5);
    expect(formatMajor).toHaveBeenLastCalledWith(5, 'EUR', 'de', { approximate: true });
    result.current.formatConvertedMajor(6, 'USD');
    expect(formatMajor).toHaveBeenLastCalledWith(6, 'USD', 'de', { approximate: true });
  });
});

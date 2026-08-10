// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrencyLanguage } from '@/features/shared/logic/currency';

async function loadHook() {
  vi.resetModules();
  return (await import('../useCurrencyCatalog')).useCurrencyCatalog;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useCurrencyCatalog', () => {
  it('loads, caches, localizes, and reuses server currencies', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ currencies: ['EUR', 'USD'] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const useCurrencyCatalog = await loadHook();
    const first = renderHook(
      ({ language }: { language: CurrencyLanguage }) => useCurrencyCatalog(language),
      { initialProps: { language: 'en' } as { language: CurrencyLanguage } }
    );
    await waitFor(() => expect(first.result.current).toHaveLength(2));
    expect(first.result.current.map(currency => currency.code)).toEqual(['EUR', 'USD']);
    expect(first.result.current[0]?.label).toContain('(EUR)');
    first.rerender({ language: 'de' });
    expect(first.result.current[0]?.name).toBeTruthy();
    first.unmount();

    const second = renderHook(() => useCurrencyCatalog('en'));
    expect(second.result.current).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it('keeps fallbacks for missing and empty payloads', async () => {
    for (const payload of [{}, { currencies: [] }]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, json: async () => payload }))
      );
      const useCurrencyCatalog = await loadHook();
      const hook = renderHook(() => useCurrencyCatalog('en'));
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      expect(hook.result.current.length).toBeGreaterThan(2);
      hook.unmount();
    }
  });

  it('reports non-abort HTTP failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }))
    );
    const useCurrencyCatalog = await loadHook();
    const hook = renderHook(() => useCurrencyCatalog('en'));
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(error).toHaveBeenCalledWith('Currency catalogue is unavailable:', expect.any(Error));
    hook.unmount();
  });

  it('silences abort and non-Error rejections and aborts on cleanup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(abortError))
    );
    let useCurrencyCatalog = await loadHook();
    const aborted = renderHook(() => useCurrencyCatalog('en'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    aborted.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject('offline'))
    );
    useCurrencyCatalog = await loadHook();
    const nonError = renderHook(() => useCurrencyCatalog('en'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    nonError.unmount();
    expect(error).not.toHaveBeenCalled();
  });
});

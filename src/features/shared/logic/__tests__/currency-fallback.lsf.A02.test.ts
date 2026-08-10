import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

it('falls back when the runtime currency registry throws', async () => {
  vi.resetModules();
  vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
    throw new Error('registry unavailable');
  });

  const currency = await import('../currency');

  expect(currency.SUPPORTED_CURRENCY_CODES).toEqual(
    expect.arrayContaining([...currency.FRANKFURTER_FALLBACK_CURRENCY_CODES])
  );
});

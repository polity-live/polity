// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  validHouseNumber: true,
}));

vi.mock('@/features/shared/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

vi.mock('@/features/shared/logic/inputValidation', () => ({
  isValidHouseNumberFormat: () => mocks.validHouseNumber,
}));

vi.mock('@/server/geoapify-search', () => ({
  geoapifySearchFn: (...args: unknown[]) => mocks.search(...args),
}));

import {
  useGeoAddressInputFieldController,
  type GeoAddressContext,
  type GeoAddressField,
  type GeoAddressValues,
  type GeoResolvedAddress,
} from '../useGeoAddressInputFieldController';

const emptyContext: GeoAddressContext = {
  country: null,
  region: null,
  city: null,
  post_code: null,
  street: null,
};

const values: GeoAddressValues = {
  country: 'Germany',
  region: 'Berlin',
  city: 'Berlin',
  post_code: '10115',
  street: 'Main Street',
  house_number: '12A',
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    id: 'address',
    field: 'city' as GeoAddressField,
    label: 'City',
    placeholder: 'Enter city',
    value: 'Berlin',
    values,
    context: emptyContext,
    onChange: vi.fn(),
    onResolved: vi.fn(),
    autoComplete: 'address-level2',
    ...overrides,
  };
}

describe('useGeoAddressInputFieldController', () => {
  beforeEach(() => {
    mocks.search.mockReset();
    mocks.validHouseNumber = true;
  });

  it.each([
    ['disabled', { disabled: true }],
    ['empty', { value: '   ' }],
    ['short country', { field: 'country', value: 'G' }],
    ['short region', { field: 'region', value: 'R' }],
    ['short city', { field: 'city', value: 'B' }],
    ['short street', { field: 'street', value: 'S' }],
    [
      'house without street',
      { field: 'house_number', value: '12', values: { ...values, street: ' ' } },
    ],
  ])('clears resolution for %s input before searching', async (_name, overrides) => {
    const input = props(overrides);
    const { result } = renderHook(() => useGeoAddressInputFieldController(input as any));

    await waitFor(() => expect(input.onResolved).toHaveBeenCalledWith(input.field, null));
    expect(result.current.validationState).toBeUndefined();
    expect(result.current.suggestions).toEqual([]);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('rejects an invalid house number before querying', async () => {
    mocks.validHouseNumber = false;
    const input = props({ field: 'house_number', value: '???' });
    const { result } = renderHook(() => useGeoAddressInputFieldController(input as any));

    await waitFor(() => expect(result.current.validationState).toBe('invalid'));
    expect(input.onResolved).toHaveBeenCalledWith('house_number', null);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it.each([
    ['country', 'Germany', { country: 'Germany' }],
    ['region', 'Berlin', { state: 'Berlin' }],
    ['city', 'Berlin', { city: 'Berlin' }],
    ['post_code', '10115', { postcode: '10115' }],
    ['street', 'Main Street', { street: 'Main Street' }],
    ['house_number', '12A', { housenumber: '12A' }],
  ] as const)(
    'resolves exact %s results and removes empty and duplicate suggestions',
    async (field, query, fieldResult) => {
      const exact = {
        place_id: `exact-${field}`,
        formatted: `Formatted ${field}`,
        country_code: 'de',
        state: 'Berlin',
        city: 'Berlin',
        postcode: '10115',
        street: 'Main Street',
        ...fieldResult,
      } satisfies GeoResolvedAddress;
      mocks.search.mockResolvedValue({
        results: [exact, { ...exact, place_id: `duplicate-${field}` }, { place_id: 'empty' }],
      });
      const input = props({ field, value: `  ${query}  ` });
      const { result } = renderHook(() => useGeoAddressInputFieldController(input as any));

      await waitFor(() => expect(result.current.validationState).toBe('valid'));
      expect(result.current.suggestions).toEqual([{ value: query, label: `Formatted ${field}` }]);
      expect(result.current.fieldSuggestions).toBe(result.current.suggestions);
      expect(input.onResolved).toHaveBeenCalledWith(field, exact);
      expect(mocks.search).toHaveBeenCalledWith({
        data: expect.objectContaining({ field, query, language: 'en', values }),
      });
    }
  );

  it.each([
    [
      'country mismatch',
      'city',
      'Berlin',
      { ...emptyContext, country: { place_id: 'country', country_code: 'de' } },
      { city: 'Berlin', country_code: 'fr' },
    ],
    [
      'region mismatch',
      'city',
      'Berlin',
      { ...emptyContext, region: { place_id: 'region', state: 'Berlin' } },
      { city: 'Berlin', state: 'Bavaria' },
    ],
    [
      'city mismatch',
      'post_code',
      '10115',
      { ...emptyContext, city: { place_id: 'city', city: 'Berlin' } },
      { postcode: '10115', city: 'Hamburg' },
    ],
    [
      'post code mismatch',
      'street',
      'Main Street',
      { ...emptyContext, post_code: { place_id: 'postcode', postcode: '10115' } },
      { street: 'Main Street', postcode: '99999' },
    ],
    [
      'street mismatch',
      'house_number',
      '12A',
      { ...emptyContext, street: { place_id: 'street', street: 'Main Street' } },
      { housenumber: '12A', street: 'Other Street' },
    ],
  ] as const)(
    'marks exact text invalid on %s',
    async (_name, field, query, context, resultData) => {
      mocks.search.mockResolvedValue({ results: [{ place_id: 'candidate', ...resultData }] });
      const input = props({ field, value: query, context });
      const hook = renderHook(() => useGeoAddressInputFieldController(input as any));

      await waitFor(() => expect(hook.result.current.validationState).toBe('invalid'));
      expect(input.onResolved).toHaveBeenCalledWith(field, null);
    }
  );

  it('accepts missing optional context fields and normalized punctuation', async () => {
    const context: GeoAddressContext = {
      country: { place_id: 'country', country_code: 'de' },
      region: { place_id: 'region', state: 'Berlin State' },
      city: { place_id: 'city', city: 'Berlin City' },
      post_code: { place_id: 'postcode', postcode: '10 115' },
      street: { place_id: 'street', street: 'Main-Street' },
    };
    const exact = {
      place_id: 'house',
      housenumber: '12-A',
      country_code: 'de',
      state: '',
      city: '',
      postcode: '10115',
      street: 'Main Street',
    };
    mocks.search.mockResolvedValue({ results: [exact] });
    const input = props({ field: 'house_number', value: '12.a', context });
    const hook = renderHook(() => useGeoAddressInputFieldController(input as any));

    await waitFor(() => expect(hook.result.current.validationState).toBe('valid'));
    expect(input.onResolved).toHaveBeenCalledWith('house_number', exact);
  });

  it('accepts a house candidate that omits every optional context value', async () => {
    const context: GeoAddressContext = {
      country: { place_id: 'country', country_code: 'de' },
      region: { place_id: 'region', state: 'Berlin' },
      city: { place_id: 'city', city: 'Berlin' },
      post_code: { place_id: 'postcode', postcode: '10115' },
      street: { place_id: 'street', street: 'Main Street' },
    };
    const exact = { place_id: 'minimal-house', housenumber: '12A', country_code: 'de' };
    mocks.search.mockResolvedValue({ results: [exact] });
    const input = props({ field: 'house_number', value: '12A', context });
    const hook = renderHook(() => useGeoAddressInputFieldController(input as any));

    await waitFor(() => expect(hook.result.current.validationState).toBe('valid'));
    expect(input.onResolved).toHaveBeenCalledWith('house_number', exact);
  });

  it('handles missing result arrays and transport failures', async () => {
    mocks.search.mockResolvedValueOnce({});
    const missing = props({ field: 'post_code', value: '1' });
    const first = renderHook(() => useGeoAddressInputFieldController(missing as any));
    await waitFor(() => expect(first.result.current.validationState).toBe('invalid'));
    expect(first.result.current.suggestions).toEqual([]);
    first.unmount();

    mocks.search.mockRejectedValueOnce(new Error('offline'));
    const failed = props({ field: 'post_code', value: '2' });
    const second = renderHook(() => useGeoAddressInputFieldController(failed as any));
    await waitFor(() => expect(failed.onResolved).toHaveBeenCalledWith('post_code', null));
    expect(second.result.current.validationState).toBeUndefined();
  });

  it('ignores both successful and failed requests after effect cancellation', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise(value => {
      resolve = value;
    });
    mocks.search.mockReturnValueOnce(pending);
    const successful = props({ field: 'city', value: 'Berlin' });
    const first = renderHook(() => useGeoAddressInputFieldController(successful as any));
    first.unmount();
    await act(async () => resolve({ results: [{ place_id: 'late', city: 'Berlin' }] }));
    expect(successful.onResolved).not.toHaveBeenCalled();

    let reject!: (reason: unknown) => void;
    const failing = new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    mocks.search.mockReturnValueOnce(failing);
    const failed = props({ field: 'city', value: 'Berlin' });
    const second = renderHook(() => useGeoAddressInputFieldController(failed as any));
    second.unmount();
    await act(async () => reject(new Error('late failure')));
    expect(failed.onResolved).not.toHaveBeenCalled();
  });

  it('exposes controlled setters and default enabled state', async () => {
    mocks.search.mockResolvedValue({ results: [] });
    const input = props({ field: 'post_code', value: '7' });
    const { result } = renderHook(() => useGeoAddressInputFieldController(input as any));
    await waitFor(() => expect(result.current.validationState).toBe('invalid'));

    act(() => {
      result.current.setValidationState('valid');
      result.current.setSuggestions([{ value: 'manual', label: 'Manual' }]);
    });
    expect(result.current.disabled).toBe(false);
    expect(result.current.validationState).toBe('valid');
    expect(result.current.suggestions).toEqual([{ value: 'manual', label: 'Manual' }]);
    expect(result.current.onChange).toBe(input.onChange);
  });
});

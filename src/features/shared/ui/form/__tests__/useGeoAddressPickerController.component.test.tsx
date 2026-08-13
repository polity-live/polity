// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  boundary: vi.fn(),
  reverse: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

vi.mock('@/server/geoapify-boundary', () => ({
  geoapifyBoundaryFn: (...args: unknown[]) => mocks.boundary(...args),
}));

vi.mock('@/server/geoapify-reverse', () => ({
  geoapifyReverseFn: (...args: unknown[]) => mocks.reverse(...args),
}));

import { useGeoAddressPickerController } from '../useGeoAddressPickerController';

const emptyValues = {
  country: '',
  region: '',
  city: '',
  post_code: '',
  street: '',
  house_number: '',
};

const fullValues = {
  country: 'Germany',
  region: 'Berlin',
  city: 'Berlin',
  post_code: '10115',
  street: 'Main Street',
  house_number: '12',
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    idPrefix: 'geo',
    values: fullValues,
    onFieldChange: vi.fn(),
    labels: {} as any,
    placeholders: {} as any,
    coordinates: { latitude: 52.5, longitude: 13.4 },
    onCoordinatesChange: vi.fn(),
    shape: null,
    onShapeChange: vi.fn(),
    ...overrides,
  };
}

describe('useGeoAddressPickerController', () => {
  beforeEach(() => {
    mocks.boundary.mockReset();
    mocks.reverse.mockReset();
  });

  it('clears coordinates and shape only when every address field is blank', async () => {
    const empty = props({ values: emptyValues });
    renderHook(() => useGeoAddressPickerController(empty as any));
    await waitFor(() => expect(empty.onCoordinatesChange).toHaveBeenCalledWith(null));
    expect(empty.onShapeChange).toHaveBeenCalledWith(null);

    for (const field of Object.keys(emptyValues)) {
      const input = props({ values: { ...emptyValues, [field]: ' value ' } });
      const hook = renderHook(() => useGeoAddressPickerController(input as any));
      expect(input.onCoordinatesChange).not.toHaveBeenCalled();
      hook.unmount();
    }

    const noCoordinates = props({
      values: emptyValues,
      coordinates: null,
      onShapeChange: undefined,
    });
    renderHook(() => useGeoAddressPickerController(noCoordinates as any));
    expect(noCoordinates.onCoordinatesChange).not.toHaveBeenCalled();
  });

  it('clears invalid resolutions and handles non-boundary points', async () => {
    const input = props();
    const { result } = renderHook(() => useGeoAddressPickerController(input as any));

    await act(async () => result.current.handleResolvedAddress(null, 'city'));
    await act(async () =>
      result.current.handleResolvedAddress({ place_id: 'missing-coordinates' }, 'city')
    );
    await act(async () =>
      result.current.handleResolvedAddress({ place_id: 'missing-field', lat: 1, lon: 2 }, null)
    );
    expect(input.onShapeChange).toHaveBeenCalledWith(null);
    expect(mocks.boundary).not.toHaveBeenCalled();

    await act(async () =>
      result.current.handleResolvedAddress(
        { place_id: 'street', street: 'Main Street', lat: 51, lon: 9 },
        'street'
      )
    );
    expect(input.onCoordinatesChange).toHaveBeenCalledWith({ latitude: 51, longitude: 9 });
    expect(input.onShapeChange).toHaveBeenLastCalledWith({
      kind: 'point',
      placeId: 'street',
      boundarySource: null,
      geometry: null,
      bounds: null,
    });

    await act(async () =>
      result.current.handleResolvedAddress(
        { place_id: null as any, housenumber: '12', lat: 51, lon: 9 },
        'house_number'
      )
    );
    expect(input.onShapeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'point', placeId: null })
    );
  });

  it.each([
    ['country', 'country', 'administrative'],
    ['region', 'region', 'administrative'],
    ['city', 'city', 'administrative'],
    ['post_code', 'postcode', 'postal_code'],
  ] as const)('loads and falls back boundary shapes for %s', async (field, kind, boundaryKind) => {
    mocks.boundary.mockResolvedValueOnce({ shape: { kind, placeId: 'resolved-shape' } });
    const input = props({ coordinates: { latitude: 1, longitude: 2 } });
    const hook = renderHook(() => useGeoAddressPickerController(input as any));
    const address = { place_id: `${field}-place`, lat: 1, lon: 2 };

    await act(async () => hook.result.current.handleResolvedAddress(address, field));
    expect(input.onCoordinatesChange).not.toHaveBeenCalled();
    expect(input.onShapeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ placeId: 'resolved-shape' })
    );
    expect(hook.result.current.isBoundaryLoading).toBe(false);

    mocks.boundary.mockResolvedValueOnce({ shape: null });
    await act(async () => hook.result.current.handleResolvedAddress(address, field));
    expect(input.onShapeChange).toHaveBeenLastCalledWith({
      kind,
      placeId: `${field}-place`,
      boundarySource: `geoapify:${boundaryKind}`,
      geometry: null,
      bounds: null,
    });

    mocks.boundary.mockRejectedValueOnce(new Error('boundary unavailable'));
    await act(async () => hook.result.current.handleResolvedAddress(address, field));
    expect(input.onShapeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ boundarySource: `geoapify:${boundaryKind}` })
    );
  });

  it('ignores stale boundary success, failure, and finalization', async () => {
    const pending: { resolve: (value: unknown) => void; reject: (reason: unknown) => void }[] = [];
    mocks.boundary.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          pending.push({ resolve, reject });
        })
    );
    const input = props();
    const hook = renderHook(() => useGeoAddressPickerController(input as any));
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = hook.result.current.handleResolvedAddress(
        { place_id: 'first', city: 'First', lat: 1, lon: 1 },
        'city'
      );
      second = hook.result.current.handleResolvedAddress(
        { place_id: 'second', city: 'Second', lat: 2, lon: 2 },
        'city'
      );
    });
    await act(async () => pending[0]!.resolve({ shape: { kind: 'city', placeId: 'stale' } }));
    await first;
    expect(input.onShapeChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ placeId: 'stale' })
    );
    await act(async () => pending[1]!.reject(new Error('latest failed')));
    await second;
    expect(input.onShapeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'city', placeId: 'second' })
    );

    let third!: Promise<void>;
    let fourth!: Promise<void>;
    await act(async () => {
      third = hook.result.current.handleResolvedAddress(
        { place_id: 'third', city: 'Third', lat: 3, lon: 3 },
        'city'
      );
      fourth = hook.result.current.handleResolvedAddress(
        { place_id: 'fourth', city: 'Fourth', lat: 4, lon: 4 },
        'city'
      );
    });
    await act(async () => pending[2]!.reject(new Error('stale failure')));
    await third;
    await act(async () => pending[3]!.resolve({ shape: { kind: 'city', placeId: 'fourth' } }));
    await fourth;
    expect(input.onShapeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ placeId: 'fourth' })
    );
  });

  it('does not clear shape for reverse-applied fields but resumes on manual changes', async () => {
    mocks.reverse.mockResolvedValue({
      result: {
        place_id: 'reverse',
        country: 'Germany',
        state: 'Berlin',
        city: 'Berlin',
        postcode: '10115',
        street: 'Main Street',
        housenumber: '12',
        lat: 52.6,
        lon: 13.5,
      },
    });
    const input = props();
    const hook = renderHook(() => useGeoAddressPickerController(input as any));

    await act(async () =>
      hook.result.current.handleMapCoordinatesChange({ latitude: 52.5, longitude: 13.4 })
    );
    expect(input.onCoordinatesChange).toHaveBeenCalledWith({ latitude: 52.6, longitude: 13.5 });
    expect(input.onFieldChange).not.toHaveBeenCalled();
    expect(hook.result.current.resetContextKey).toBe(1);
    expect(hook.result.current.ignoreForwardResolutionRef.current).toBe(true);

    await act(async () =>
      hook.result.current.handleResolvedAddress(
        { place_id: 'ignored', city: 'Ignored', lat: 3, lon: 4 },
        'city'
      )
    );
    expect(mocks.boundary).not.toHaveBeenCalled();

    act(() => hook.result.current.handleFieldChange('city', 'Manual'));
    expect(input.onShapeChange).toHaveBeenLastCalledWith(null);
    expect(input.onFieldChange).toHaveBeenLastCalledWith('city', 'Manual');
    expect(hook.result.current.ignoreForwardResolutionRef.current).toBe(false);
  });

  it('maps reverse values, point state, missing results, and failures', async () => {
    mocks.reverse.mockResolvedValueOnce({
      result: { place_id: 'reverse', country: 'France', lat: 1, lon: 2 },
    });
    const input = props({ coordinates: { latitude: 0, longitude: 0 } });
    const hook = renderHook(() => useGeoAddressPickerController(input as any));

    await act(async () =>
      hook.result.current.handleMapCoordinatesChange({ latitude: 3, longitude: 4 })
    );
    expect(input.onCoordinatesChange).toHaveBeenCalledWith({ latitude: 3, longitude: 4 });
    expect(input.onCoordinatesChange).toHaveBeenCalledWith({ latitude: 1, longitude: 2 });
    expect(input.onFieldChange.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'country',
      'region',
      'city',
      'post_code',
      'street',
      'house_number',
    ]);
    expect(input.onShapeChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'point', placeId: null })
    );
    expect(input.onShapeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ placeId: 'reverse' })
    );

    mocks.reverse.mockResolvedValueOnce({ result: null });
    await act(async () =>
      hook.result.current.handleMapCoordinatesChange({ latitude: 5, longitude: 6 })
    );
    expect(hook.result.current.isReverseGeocoding).toBe(false);

    mocks.reverse.mockRejectedValueOnce(new Error('reverse unavailable'));
    await act(async () =>
      hook.result.current.handleMapCoordinatesChange({ latitude: 7, longitude: 8 })
    );
    expect(hook.result.current.ignoreForwardResolutionRef.current).toBe(false);
    expect(hook.result.current.isApplyingReverseSyncRef.current).toBe(false);
  });

  it('handles reverse results without address or coordinate fields and equal normalized coordinates', async () => {
    mocks.reverse
      .mockResolvedValueOnce({ result: { place_id: 'minimal' } })
      .mockResolvedValueOnce({ result: { place_id: 'equal', lat: 9, lon: 9 } });
    const input = props();
    const hook = renderHook(() => useGeoAddressPickerController(input as any));

    await act(async () =>
      hook.result.current.handleMapCoordinatesChange({ latitude: 8, longitude: 8 })
    );
    expect(input.onFieldChange).toHaveBeenCalledWith('country', '');
    expect(input.onShapeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ placeId: 'minimal' })
    );

    input.onCoordinatesChange.mockClear();
    await act(async () =>
      hook.result.current.handleMapCoordinatesChange({ latitude: 9, longitude: 9 })
    );
    expect(input.onCoordinatesChange).toHaveBeenCalledTimes(1);
    expect(input.onCoordinatesChange).toHaveBeenCalledWith({ latitude: 9, longitude: 9 });
  });

  it('ignores stale reverse results and stale finalization', async () => {
    const pending: ((value: unknown) => void)[] = [];
    mocks.reverse.mockImplementation(
      () =>
        new Promise(resolve => {
          pending.push(resolve);
        })
    );
    const input = props();
    const hook = renderHook(() => useGeoAddressPickerController(input as any));
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = hook.result.current.handleMapCoordinatesChange({ latitude: 1, longitude: 1 });
      second = hook.result.current.handleMapCoordinatesChange({ latitude: 2, longitude: 2 });
    });
    await act(async () => pending[0]!({ result: { place_id: 'stale', lat: 1, lon: 1 } }));
    await first;
    expect(input.onShapeChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ placeId: 'stale' })
    );
    await act(async () => pending[1]!({ result: null }));
    await second;
    expect(hook.result.current.isReverseGeocoding).toBe(false);
  });

  it('exposes state controls and supports an omitted shape callback', () => {
    const input = props({ onShapeChange: undefined });
    const { result } = renderHook(() => useGeoAddressPickerController(input as any));
    act(() => {
      result.current.isApplyingReverseSyncRef.current = true;
      result.current.handleFieldChange('street', 'Synchronized');
      result.current.isApplyingReverseSyncRef.current = false;
      result.current.setResetContextKey(4);
      result.current.setIsReverseGeocoding(true);
      result.current.setIsBoundaryLoading(true);
      result.current.handleFieldChange('city', 'Berlin');
    });
    expect(result.current).toMatchObject({
      resetContextKey: 4,
      isReverseGeocoding: true,
      isBoundaryLoading: true,
      shape: null,
      idPrefix: 'geo',
    });
  });
});

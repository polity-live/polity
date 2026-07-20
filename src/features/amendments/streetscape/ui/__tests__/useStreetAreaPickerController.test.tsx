/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStreetAreaPickerController } from '../useStreetAreaPickerController';
import { geoapifyReverseFn } from '@/server/geoapify-reverse';

vi.mock('@/server/geoapify-reverse', () => ({
  geoapifyReverseFn: vi.fn(),
}));

describe('useStreetAreaPickerController', () => {
  beforeEach(() => {
    vi.mocked(geoapifyReverseFn).mockReset();
  });

  it('initializes the search from the persisted address and reverse geocodes once on move end', async () => {
    const onMapSelectionChange = vi.fn();
    const onSelectionAddressChange = vi.fn();
    vi.mocked(geoapifyReverseFn).mockResolvedValue({
      result: {
        place_id: 'place-new',
        formatted: 'Unter den Linden 1, Berlin, Germany',
        country: 'Germany',
        state: 'Berlin',
        city: 'Berlin',
        postcode: '10117',
        street: 'Unter den Linden',
        housenumber: '1',
        lat: 52.517,
        lon: 13.3889,
      },
    });

    const { result } = renderHook(() =>
      useStreetAreaPickerController({
        center: { lat: 52.52, lon: 13.405 },
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        mapSelection: {
          center: { lat: 52.52, lon: 13.405 },
          widthMeters: 100,
          heightMeters: 100,
          rotationDeg: 0,
        },
        selectionAddress: {
          city: 'Berlin',
          street: 'Alexanderplatz',
        },
        isLoadingOsm: false,
        osmError: null,
        readOnly: false,
        onMapSelectionChange,
        onSelectionAddressChange,
        onLoadOsm: vi.fn(),
      })
    );

    expect(result.current.locationSearchValues.city).toBe('Berlin');
    expect(result.current.locationSearchValues.street).toBe('Alexanderplatz');

    await act(async () => {
      await result.current.onBboxMoveEnd({ lat: 52.517, lon: 13.3889 });
    });

    await waitFor(() => expect(onSelectionAddressChange).toHaveBeenCalledTimes(1));
    expect(geoapifyReverseFn).toHaveBeenCalledTimes(1);
    expect(onSelectionAddressChange).toHaveBeenCalledWith(
      expect.objectContaining({
        placeId: 'place-new',
        formatted: 'Unter den Linden 1, Berlin, Germany',
        street: 'Unter den Linden',
        houseNumber: '1',
      })
    );

    act(() => {
      result.current.onLocationSearchResolved(
        {
          place_id: 'programmatic-street-result',
          formatted: 'Unter den Linden, Berlin, Germany',
          street: 'Unter den Linden',
          lat: 52.518,
          lon: 13.39,
        },
        'street'
      );
      result.current.onLocationSearchResolved(
        {
          place_id: 'programmatic-house-result',
          formatted: 'Unter den Linden 1, Berlin, Germany',
          street: 'Unter den Linden',
          housenumber: '1',
          lat: 52.5181,
          lon: 13.3901,
        },
        'house_number'
      );
    });

    expect(onMapSelectionChange).not.toHaveBeenCalled();
  });

  it('moves the selection exactly once for a resolved user-entered address', () => {
    const onMapSelectionChange = vi.fn();
    const onSelectionAddressChange = vi.fn();
    const { result } = renderHook(() =>
      useStreetAreaPickerController({
        center: { lat: 52.52, lon: 13.405 },
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        mapSelection: {
          center: { lat: 52.52, lon: 13.405 },
          widthMeters: 100,
          heightMeters: 100,
          rotationDeg: 0,
        },
        isLoadingOsm: false,
        osmError: null,
        readOnly: false,
        onMapSelectionChange,
        onSelectionAddressChange,
        onLoadOsm: vi.fn(),
      })
    );

    const resolvedAddress = {
      place_id: 'manual-address',
      formatted: 'Unter den Linden 1, Berlin, Germany',
      street: 'Unter den Linden',
      housenumber: '1',
      lat: 52.517,
      lon: 13.3889,
    };

    act(() => {
      result.current.onLocationSearchFieldChange('street', 'Unter den Linden');
      result.current.onLocationSearchResolved(
        {
          ...resolvedAddress,
          place_id: 'unrelated-city-result',
          lat: 52.52,
          lon: 13.405,
        },
        'city'
      );
      result.current.onLocationSearchResolved(resolvedAddress, 'street');
      result.current.onLocationSearchResolved(
        {
          ...resolvedAddress,
          place_id: 'later-programmatic-result',
          lat: 52.518,
          lon: 13.39,
        },
        'house_number'
      );
    });

    expect(onMapSelectionChange).toHaveBeenCalledTimes(1);
    expect(onMapSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ center: { lat: 52.517, lon: 13.3889 } })
    );
    expect(onSelectionAddressChange).toHaveBeenCalledTimes(1);
    expect(result.current.mapViewportFocusKey).toBe(1);
  });

  it('ignores a reverse-geocoding response after the selection moves again', async () => {
    let resolveReverseRequest:
      ((value: Awaited<ReturnType<typeof geoapifyReverseFn>>) => void) | undefined;
    vi.mocked(geoapifyReverseFn).mockImplementation(
      () =>
        new Promise(resolve => {
          resolveReverseRequest = resolve;
        })
    );
    const onSelectionAddressChange = vi.fn();
    const { result } = renderHook(() =>
      useStreetAreaPickerController({
        center: { lat: 52.52, lon: 13.405 },
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        mapSelection: {
          center: { lat: 52.52, lon: 13.405 },
          widthMeters: 100,
          heightMeters: 100,
          rotationDeg: 0,
        },
        isLoadingOsm: false,
        osmError: null,
        readOnly: false,
        onMapSelectionChange: vi.fn(),
        onSelectionAddressChange,
        onLoadOsm: vi.fn(),
      })
    );

    let reverseRequest: Promise<void> | undefined;
    act(() => {
      reverseRequest = result.current.onBboxMoveEnd({ lat: 52.517, lon: 13.3889 });
    });
    act(() => {
      result.current.onBboxMove({ lat: 52.519, lon: 13.4 });
    });
    await act(async () => {
      resolveReverseRequest?.({
        result: {
          place_id: 'stale-place',
          formatted: 'Stale address',
          lat: 52.517,
          lon: 13.3889,
        },
      });
      await reverseRequest;
    });

    expect(onSelectionAddressChange).not.toHaveBeenCalled();
  });

  it('clears a stale address when reverse geocoding fails', async () => {
    const onSelectionAddressChange = vi.fn();
    vi.mocked(geoapifyReverseFn).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useStreetAreaPickerController({
        center: { lat: 52.52, lon: 13.405 },
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        mapSelection: {
          center: { lat: 52.52, lon: 13.405 },
          widthMeters: 100,
          heightMeters: 100,
          rotationDeg: 0,
        },
        isLoadingOsm: false,
        osmError: null,
        readOnly: false,
        onMapSelectionChange: vi.fn(),
        onSelectionAddressChange,
        onLoadOsm: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.onBboxMoveEnd({ lat: 52.517, lon: 13.3889 });
    });

    expect(onSelectionAddressChange).toHaveBeenCalledTimes(1);
    expect(onSelectionAddressChange).toHaveBeenCalledWith(undefined);
  });
});

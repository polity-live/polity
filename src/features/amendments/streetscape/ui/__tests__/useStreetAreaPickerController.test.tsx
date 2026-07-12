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
        onMapSelectionChange: vi.fn(),
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

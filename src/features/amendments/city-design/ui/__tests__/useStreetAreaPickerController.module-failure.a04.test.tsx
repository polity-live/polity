/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStreetAreaPickerController } from '../useStreetAreaPickerController';

vi.mock('react-leaflet', () => {
  throw new Error('react-leaflet failed to load');
});

vi.mock('@/server/geoapify-reverse', () => ({
  geoapifyReverseFn: vi.fn(),
}));

describe('useStreetAreaPickerController module failures', () => {
  it('marks an active dynamic-import failure as unavailable', async () => {
    const { result } = renderHook(() => useStreetAreaPickerController(createControllerOptions()));
    await waitFor(() => expect(result.current.mapUnavailable).toBe(true));
  });

  it('ignores a dynamic-import failure after unmount', async () => {
    const hook = renderHook(() => useStreetAreaPickerController(createControllerOptions()));
    hook.unmount();
    await act(async () => Promise.resolve());
  });
});

function createControllerOptions() {
  return {
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
    onSelectionAddressChange: vi.fn(),
    onLoadOsm: vi.fn(),
  };
}

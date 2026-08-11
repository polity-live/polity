/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/geoapify-reverse', () => ({ geoapifyReverseFn: vi.fn() }));

import { useStreetAreaPickerController } from '../useStreetAreaPickerController';

describe('street area picker LSF action adapters', () => {
  it('dispatches every geometry edit and reset callback', () => {
    const onMapSelectionChange = vi.fn();
    const onSelectionAddressChange = vi.fn();
    const mapSelection = {
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 100,
      heightMeters: 80,
      rotationDeg: 0,
    } as any;
    const { result } = renderHook(() =>
      useStreetAreaPickerController({
        center: mapSelection.center,
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        mapSelection,
        isLoadingOsm: false,
        osmError: null,
        readOnly: false,
        onMapSelectionChange,
        onSelectionAddressChange,
        onLoadOsm: vi.fn(),
      })
    );

    act(() => {
      result.current.onBboxResize('ne', { lat: 52.54, lon: 13.43 });
      result.current.onWidthMetersChange(120);
      result.current.onHeightMetersChange(90);
      result.current.onRotationDegreesChange(30);
      result.current.onSelectionRotate({ lat: 52.53, lon: 13.42 });
      result.current.onLocationSearchReset();
    });

    expect(onMapSelectionChange).toHaveBeenCalledTimes(5);
    expect(onSelectionAddressChange).toHaveBeenCalledWith(undefined);
    expect(result.current.locationSearchResetKey).toBeGreaterThan(0);
  });
});

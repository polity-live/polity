/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  StreetAreaPickerMapViewport,
  streetAreaPickerMapInternals,
} from '../StreetAreaPickerMapController';

afterEach(cleanup);

describe('StreetAreaPickerMapController A04 alternatives', () => {
  it('fits initial and changed bounds', () => {
    const map = { fitBounds: vi.fn(), flyTo: vi.fn() };
    const module = { useMap: () => map } as never;
    const firstBounds = { id: 'first' } as never;
    const nextBounds = { id: 'next' } as never;
    const { rerender } = render(
      <StreetAreaPickerMapViewport
        center={[1, 2]}
        bounds={firstBounds}
        focusKey={0}
        reactLeafletModule={module}
      />
    );
    expect(map.fitBounds).toHaveBeenCalledWith(firstBounds, expect.any(Object));
    rerender(
      <StreetAreaPickerMapViewport
        center={[3, 4]}
        bounds={nextBounds}
        focusKey={1}
        reactLeafletModule={module}
      />
    );
    expect(map.fitBounds).toHaveBeenLastCalledWith(nextBounds, expect.any(Object));
  });

  it('flies to initial and changed centers without bounds', () => {
    const map = { fitBounds: vi.fn(), flyTo: vi.fn() };
    const module = { useMap: () => map } as never;
    const { rerender } = render(
      <StreetAreaPickerMapViewport
        center={[1, 2]}
        bounds={null}
        focusKey={0}
        reactLeafletModule={module}
      />
    );
    expect(map.flyTo).toHaveBeenCalledWith([1, 2], 17, { animate: false });
    rerender(
      <StreetAreaPickerMapViewport
        center={[3, 4]}
        bounds={null}
        focusKey={1}
        reactLeafletModule={module}
      />
    );
    expect(map.flyTo).toHaveBeenLastCalledWith([3, 4], 17, { animate: true });
  });

  it('restores enabled and disabled gesture handlers independently', () => {
    const enabled = { enabled: () => true, disable: vi.fn(), enable: vi.fn() };
    const disabled = { enabled: () => false, disable: vi.fn(), enable: vi.fn() };
    const restore = streetAreaPickerMapInternals.disableMapSelectionConflictingGestures({
      dragging: enabled,
      touchZoom: disabled,
    });
    expect(enabled.disable).toHaveBeenCalled();
    expect(disabled.disable).toHaveBeenCalled();
    restore();
    expect(enabled.enable).toHaveBeenCalled();
    expect(disabled.disable).toHaveBeenCalledTimes(2);
    expect(streetAreaPickerMapInternals.isMapGestureHandler(undefined)).toBe(false);

    const withoutEnabled = { disable: vi.fn(), enable: vi.fn() };
    const restoreWithoutEnabled =
      streetAreaPickerMapInternals.disableMapSelectionConflictingGestures({
        dragging: withoutEnabled,
      });
    restoreWithoutEnabled();
    expect(withoutEnabled.enable).toHaveBeenCalled();
  });
});

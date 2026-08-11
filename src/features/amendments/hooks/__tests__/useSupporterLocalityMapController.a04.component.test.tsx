/* @vitest-environment jsdom */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fitBounds: vi.fn(), divIcon: vi.fn((value: any) => value) }));

vi.mock('leaflet', () => ({ divIcon: mocks.divIcon }));
vi.mock('react-leaflet', () => ({
  GeoJSON: () => null,
  useMap: () => ({ fitBounds: mocks.fitBounds }),
}));

import {
  supporterLocalityMapControllerInternals,
  useSupporterLocalityMapController,
} from '../useSupporterLocalityMapController';

const item = (overrides: Record<string, any> = {}) => ({
  groupId: 'group',
  name: 'Group',
  href: '/group/group',
  memberCount: 1,
  supportStatus: 'active',
  locationLabel: 'Location',
  latitude: 10,
  longitude: 20,
  ...overrides,
});

describe('useSupporterLocalityMapController A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('derives empty, point, and shape centers and bounds', () => {
    expect(supporterLocalityMapControllerInternals.averageCenter([])).toEqual([51.1657, 10.4515]);
    expect(
      supporterLocalityMapControllerInternals.averageCenter([
        item({ latitude: 0, longitude: 10 }),
        item({ latitude: 20, longitude: 30 }),
      ] as any)
    ).toEqual([10, 20]);
    expect(
      supporterLocalityMapControllerInternals.getViewportBounds([
        item(),
        item({
          latitude: 5,
          longitude: 25,
          locationShape: {
            kind: 'bounds',
            bounds: { south: 0, west: 15, north: 30, east: 40 },
          },
        }),
      ] as any)
    ).toEqual({ south: 0, west: 15, north: 30, east: 40 });
  });

  it('loads map capabilities, creates marker icons, and chooses zoom levels', async () => {
    const one = renderHook(() => useSupporterLocalityMapController([item()] as any));
    await waitFor(() => expect(one.result.current.reactLeafletModule).not.toBeNull());
    expect(one.result.current.GeoJSON).toEqual(expect.any(Function));
    expect(one.result.current.markerIcon).not.toBeNull();
    expect(one.result.current.activeMarkerIcon).not.toBeNull();
    expect(one.result.current.zoom).toBe(10);

    const many = renderHook(() =>
      useSupporterLocalityMapController([item(), item({ groupId: 'two' })] as any)
    );
    await waitFor(() => expect(many.result.current.reactLeafletModule).not.toBeNull());
    expect(many.result.current.zoom).toBe(5);
  });

  it('fits viewport bounds and tolerates null bounds', async () => {
    const hook = renderHook(() => useSupporterLocalityMapController([item()] as any));
    await waitFor(() => expect(hook.result.current.reactLeafletModule).not.toBeNull());
    const Viewport = hook.result.current.MapViewportController;
    const viewport = renderHook(({ bounds }) => Viewport({ bounds }), {
      initialProps: { bounds: hook.result.current.viewportBounds },
    });
    expect(mocks.fitBounds).toHaveBeenCalled();
    viewport.rerender({ bounds: null });
  });

  it('does not update module state after immediate unmount', () => {
    const hook = renderHook(() => useSupporterLocalityMapController([]));
    hook.unmount();
  });
});

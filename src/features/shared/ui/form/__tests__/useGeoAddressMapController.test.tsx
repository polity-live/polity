// @vitest-environment jsdom

import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  let resolveModules!: () => void;
  const modulesReady = new Promise<void>(resolve => {
    resolveModules = resolve;
  });
  return {
    modulesReady,
    resolveModules,
    divIcon: vi.fn((_options?: unknown) => ({ marker: true })),
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    mapEvents: vi.fn(),
  };
});

vi.mock('react-leaflet', async () => {
  await mocks.modulesReady;
  return {
    MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Marker: () => <span>marker</span>,
    TileLayer: () => <span>tiles</span>,
    GeoJSON: () => <span>geojson</span>,
    useMap: () => ({ fitBounds: mocks.fitBounds, flyTo: mocks.flyTo }),
    useMapEvents: (events: unknown) => mocks.mapEvents(events),
  };
});

vi.mock('leaflet', async () => {
  await mocks.modulesReady;
  return { divIcon: (...args: unknown[]) => mocks.divIcon(...args) };
});

import { useGeoAddressMapController } from '../useGeoAddressMapController';

function props(overrides: Record<string, unknown> = {}) {
  return {
    coordinates: null,
    onCoordinatesChange: vi.fn(),
    loadingLabel: 'Loading',
    unavailableLabel: 'Unavailable',
    busyLabel: 'Busy',
    emptyMessage: 'Empty',
    moveHint: 'Move',
    ...overrides,
  };
}

describe('useGeoAddressMapController', () => {
  it('ignores module completion after unmount', async () => {
    const hook = renderHook(() => useGeoAddressMapController(props()));
    expect(hook.result.current.reactLeafletModule).toBeNull();
    expect(hook.result.current.leafletModule).toBeNull();
    expect(hook.result.current.markerIcon).toBeNull();
    hook.unmount();

    await act(async () => mocks.resolveModules());
  });

  it('loads map modules and derives point, area, and module fallback state', async () => {
    const input = props();
    const hook = renderHook(current => useGeoAddressMapController(current as any), {
      initialProps: input,
    });
    await waitFor(() => expect(hook.result.current.reactLeafletModule).not.toBeNull());
    expect(hook.result.current).toMatchObject({
      shape: null,
      isBusy: false,
      interactive: true,
      position: [20, 0],
      zoom: 2,
      shapeKey: null,
      loadFailed: false,
    });
    expect(hook.result.current.markerIcon).toEqual({ marker: true });
    expect(hook.result.current.GeoJSON).toBeTypeOf('function');

    hook.rerender(
      props({
        coordinates: { latitude: 52.5, longitude: 13.4 },
        interactive: false,
        isBusy: true,
      }) as any
    );
    expect(hook.result.current.position).toEqual([52.5, 13.4]);
    expect(hook.result.current.zoom).toBe(15);
    expect(hook.result.current.interactive).toBe(false);
    expect(hook.result.current.isBusy).toBe(true);

    hook.rerender(
      props({
        coordinates: { latitude: 1, longitude: 2 },
        shape: {
          kind: 'city',
          placeId: 'berlin',
          boundarySource: 'test',
          geometry: { type: 'Polygon', coordinates: [] },
          bounds: { south: 10, west: 20, north: 30, east: 40 },
        },
      }) as any
    );
    expect(hook.result.current.hasAreaGeometry).toBe(true);
    expect(hook.result.current.viewportBounds).toEqual({
      south: 10,
      west: 20,
      north: 30,
      east: 40,
    });
    expect(hook.result.current.position).toEqual([20, 30]);
    expect(hook.result.current.zoom).toBe(10);
    expect(hook.result.current.shapeKey).toBe('city:berlin:10:20:30:40');

    hook.rerender(
      props({
        shape: {
          kind: 'point',
          placeId: null,
          boundarySource: null,
          geometry: null,
          bounds: null,
        },
      }) as any
    );
    expect(hook.result.current.shapeKey).toBe('point:::::');

    act(() => {
      hook.result.current.setReactLeafletModule({
        MapContainer: hook.result.current.MapContainer,
        Marker: hook.result.current.Marker,
        TileLayer: hook.result.current.TileLayer,
        useMap: hook.result.current.useMap,
        useMapEvents: hook.result.current.useMapEvents,
      } as any);
    });
    expect(hook.result.current.GeoJSON).toBeUndefined();
    act(() => hook.result.current.setLeafletModule(null));
    expect(hook.result.current.markerIcon).toBeNull();
    act(() => hook.result.current.setLoadFailed(true));
    expect(hook.result.current.loadFailed).toBe(true);
  });

  it('drives viewport bounds, point flight, and click selection', async () => {
    const onCoordinatesChange = vi.fn();
    const hook = renderHook(() =>
      useGeoAddressMapController(props({ onCoordinatesChange }) as any)
    );
    await waitFor(() => expect(hook.result.current.reactLeafletModule).not.toBeNull());
    const Viewport = hook.result.current.MapViewportController;
    const ClickHandler = hook.result.current.MapClickHandler;

    const bounds = { south: 1, west: 2, north: 3, east: 4 };
    const viewport = render(<Viewport center={[10, 20]} zoomLevel={7} bounds={bounds} />);
    expect(mocks.fitBounds).toHaveBeenCalledWith(
      [
        [1, 2],
        [3, 4],
      ],
      { animate: true, duration: 0.35, padding: [16, 16] }
    );
    viewport.rerender(<Viewport center={[11, 21]} zoomLevel={8} bounds={null} />);
    expect(mocks.flyTo).toHaveBeenCalledWith([11, 21], 8, { animate: true, duration: 0.35 });

    render(<ClickHandler onSelect={onCoordinatesChange} />);
    const events = mocks.mapEvents.mock.calls.at(-1)?.[0] as any;
    act(() => events.click({ latlng: { lat: 50, lng: 8 } }));
    expect(onCoordinatesChange).toHaveBeenCalledWith({ latitude: 50, longitude: 8 });
  });
});

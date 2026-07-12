/* @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { LatLngBounds } from 'leaflet';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StreetAreaPickerView } from '../StreetAreaPickerView';

describe('StreetAreaPickerView', () => {
  it('renders the compact map fallback', () => {
    render(
      <StreetAreaPickerView
        {...createPickerProps({
          reactLeafletModule: null,
          markerIcon: null,
          resizeMarkerIcon: null,
          rotateMarkerIcon: null,
          bounds: null,
          selectionCorners: [],
          resizeHandles: [],
          mapUnavailable: true,
        })}
      />
    );

    expect(screen.getByText('Map could not be loaded.').className).toContain('h-64');
  });

  it('keeps the viewport stable while the selection changes', () => {
    const { map, reactLeafletModule } = createReactLeafletFixture();
    const initialBounds = createBounds('initial-bounds');
    const changedBounds = createBounds('changed-bounds');
    const props = createPickerProps({ reactLeafletModule, bounds: initialBounds });
    const { rerender } = render(<StreetAreaPickerView {...props} />);

    rerender(
      <StreetAreaPickerView
        {...props}
        bounds={changedBounds}
        selectionCorners={[
          [52.521, 13.404],
          [52.521, 13.407],
          [52.519, 13.407],
          [52.519, 13.404],
        ]}
        rotateHandlePosition={[52.522, 13.4055]}
        resizeHandles={[
          { handle: 'ne', position: [52.521, 13.407] },
          { handle: 'sw', position: [52.519, 13.404] },
        ]}
      />
    );

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledWith(initialBounds, {
      animate: false,
      padding: [18, 18],
      maxZoom: 18,
    });
  });

  it('temporarily disables map gestures while dragging selection handles', () => {
    const { map, markerEventHandlers, reactLeafletModule } = createReactLeafletFixture();
    const onBboxMove = vi.fn();
    const onBboxMoveEnd = vi.fn();
    const onBboxResize = vi.fn();
    const onSelectionRotate = vi.fn();

    render(
      <StreetAreaPickerView
        {...createPickerProps({
          reactLeafletModule,
          onBboxMove,
          onBboxMoveEnd,
          onBboxResize,
          onSelectionRotate,
        })}
      />
    );

    markerEventHandlers.center.dragstart(createLeafletEvent({ lat: 52.5201, lng: 13.4051 }));
    expect(map.dragging.disable).toHaveBeenCalledTimes(1);
    expect(map.touchZoom.disable).toHaveBeenCalledTimes(1);

    markerEventHandlers.center.drag(createLeafletEvent({ lat: 52.5201, lng: 13.4051 }));
    expect(onBboxMove).toHaveBeenCalledWith({ lat: 52.5201, lon: 13.4051 });

    markerEventHandlers.center.dragend(createLeafletEvent({ lat: 52.5201, lng: 13.4051 }));
    expect(onBboxMoveEnd).toHaveBeenCalledTimes(1);
    expect(onBboxMoveEnd).toHaveBeenCalledWith({ lat: 52.5201, lon: 13.4051 });
    expect(map.dragging.enable).toHaveBeenCalledTimes(1);
    expect(map.touchZoom.enable).toHaveBeenCalledTimes(1);

    markerEventHandlers.resize.ne.dragstart(createLeafletEvent({ lat: 52.521, lng: 13.406 }));
    markerEventHandlers.resize.ne.drag(createLeafletEvent({ lat: 52.521, lng: 13.406 }));
    markerEventHandlers.resize.ne.dragend(createLeafletEvent({ lat: 52.521, lng: 13.406 }));
    expect(onBboxResize).toHaveBeenCalledWith('ne', { lat: 52.521, lon: 13.406 });

    markerEventHandlers.rotate.dragstart(createLeafletEvent({ lat: 52.522, lng: 13.405 }));
    markerEventHandlers.rotate.drag(createLeafletEvent({ lat: 52.522, lng: 13.405 }));
    markerEventHandlers.rotate.dragend(createLeafletEvent({ lat: 52.522, lng: 13.405 }));
    expect(onSelectionRotate).toHaveBeenCalledWith({ lat: 52.522, lon: 13.405 });
  });

  it('stops pointer starts on selection handles from reaching the map', () => {
    const { markerEventHandlers, reactLeafletModule } = createReactLeafletFixture();
    const stopPropagation = vi.fn();

    render(<StreetAreaPickerView {...createPickerProps({ reactLeafletModule })} />);

    markerEventHandlers.rotate.pointerdown({
      originalEvent: { stopPropagation },
      target: { getLatLng: () => ({ lat: 52.52, lng: 13.405 }) },
    });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('renders location search fields and forwards reset actions', () => {
    const onLocationSearchReset = vi.fn();

    const { container } = render(
      <StreetAreaPickerView
        {...createPickerProps({
          onLocationSearchReset,
        })}
      />
    );

    const cityInput = within(container).getByPlaceholderText('City');
    expect(cityInput).toBeInstanceOf(HTMLInputElement);

    fireEvent.click(within(container).getByRole('button', { name: 'Reset search' }));

    expect(onLocationSearchReset).toHaveBeenCalledTimes(1);
  });

  it('collapses and expands the map section body', () => {
    const { container } = render(<StreetAreaPickerView {...createPickerProps()} />);

    const trigger = within(container).getByRole('button', { name: 'Map section' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(within(container).getByPlaceholderText('City')).toBeInstanceOf(HTMLInputElement);

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('refits the viewport only when the search focus key changes', () => {
    const { map, reactLeafletModule } = createReactLeafletFixture();
    const initialBounds = createBounds('initial-bounds');
    const changedBounds = createBounds('changed-bounds');
    const props = createPickerProps({ reactLeafletModule, bounds: initialBounds });
    const { rerender } = render(<StreetAreaPickerView {...props} />);

    rerender(<StreetAreaPickerView {...props} bounds={changedBounds} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    rerender(<StreetAreaPickerView {...props} bounds={changedBounds} mapViewportFocusKey={1} />);

    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(map.fitBounds).toHaveBeenLastCalledWith(changedBounds, {
      animate: true,
      padding: [18, 18],
      maxZoom: 18,
    });
  });
});

function createPickerProps(overrides: Record<string, unknown> = {}) {
  return {
    center: { lat: 52.52, lon: 13.405 },
    addressLabel: 'Alexanderplatz, Berlin',
    isLoadingOsm: false,
    osmError: null,
    readOnly: false,
    onLoadOsm: vi.fn(),
    locationSearchValues: {
      country: '',
      region: '',
      city: '',
      post_code: '',
      street: '',
      house_number: '',
    },
    locationSearchLabels: {
      country: 'Country',
      region: 'Region',
      city: 'City',
      post_code: 'Post code',
      street: 'Street',
      house_number: 'House number',
    },
    locationSearchPlaceholders: {
      country: 'Country',
      region: 'Region',
      city: 'City',
      post_code: 'Post code',
      street: 'Street',
      house_number: 'House number',
    },
    locationSearchResetKey: 0,
    mapViewportFocusKey: 0,
    onLocationSearchFieldChange: vi.fn(),
    onLocationSearchResolved: vi.fn(),
    onLocationSearchReset: vi.fn(),
    reactLeafletModule: null,
    markerIcon: {},
    resizeMarkerIcon: {},
    rotateMarkerIcon: {},
    position: [52.52, 13.405],
    bounds: createBounds('initial-bounds'),
    selectionCorners: [
      [52.5205, 13.4045],
      [52.5205, 13.4055],
      [52.5195, 13.4055],
      [52.5195, 13.4045],
    ],
    rotateHandlePosition: [52.521, 13.405],
    resizeHandles: [{ handle: 'ne', position: [52.5205, 13.4055] }],
    widthMeters: 100,
    heightMeters: 100,
    rotationDeg: 0,
    onBboxMove: vi.fn(),
    onBboxMoveEnd: vi.fn(),
    onBboxResize: vi.fn(),
    onSelectionRotate: vi.fn(),
    onWidthMetersChange: vi.fn(),
    onHeightMetersChange: vi.fn(),
    onRotationDegreesChange: vi.fn(),
    mapLoading: false,
    mapUnavailable: false,
    ...overrides,
  } as any;
}

function createBounds(label: string) {
  return { label } as unknown as LatLngBounds;
}

function createReactLeafletFixture() {
  const map = {
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    dragging: createMapHandler(),
    touchZoom: createMapHandler(),
  };
  const markerEventHandlers: {
    center: any;
    resize: Record<string, any>;
    rotate: any;
  } = {
    center: null,
    resize: {},
    rotate: null,
  };
  const reactLeafletModule = {
    MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    Polygon: () => null,
    Marker: ({ title, eventHandlers }: { title?: string; eventHandlers: any }) => {
      if (title === 'Rotate section') {
        markerEventHandlers.rotate = eventHandlers;
      } else if (title?.startsWith('Drag section ')) {
        const handle = title.split(' ')[2];
        markerEventHandlers.resize[handle] = eventHandlers;
      } else {
        markerEventHandlers.center = eventHandlers;
      }

      return null;
    },
    useMap: () => map,
    useMapEvents: vi.fn(),
  };

  return { map, markerEventHandlers, reactLeafletModule };
}

function createMapHandler() {
  return {
    enabled: vi.fn(() => true),
    disable: vi.fn(),
    enable: vi.fn(),
  };
}

function createLeafletEvent(latLng: { lat: number; lng: number }) {
  return {
    originalEvent: { stopPropagation: vi.fn() },
    target: { getLatLng: () => latLng },
  };
}

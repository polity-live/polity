/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { LatLngBounds } from 'leaflet';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_TUTORIAL_ACTION_EVENT } from '@/features/app-tutorial/events';
import { StreetAreaPickerView, streetAreaPickerViewInternals } from '../StreetAreaPickerView';

afterEach(cleanup);

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
    const props = createPickerProps({
      reactLeafletModule,
      bounds: initialBounds,
    });
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
    expect(onBboxResize).toHaveBeenCalledWith('ne', {
      lat: 52.521,
      lon: 13.406,
    });

    markerEventHandlers.rotate.dragstart(createLeafletEvent({ lat: 52.522, lng: 13.405 }));
    markerEventHandlers.rotate.drag(createLeafletEvent({ lat: 52.522, lng: 13.405 }));
    markerEventHandlers.rotate.dragend(createLeafletEvent({ lat: 52.522, lng: 13.405 }));
    expect(onSelectionRotate).toHaveBeenCalledWith({
      lat: 52.522,
      lon: 13.405,
    });
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
    const onLoadOsm = vi.fn();

    const props = createPickerProps({ onLocationSearchReset, onLoadOsm });
    const { container, rerender } = render(<StreetAreaPickerView {...props} />);

    const cityInput = within(container).getByPlaceholderText('City');
    expect(cityInput).toBeInstanceOf(HTMLInputElement);
    expect(
      container
        .querySelector('[data-tutorial-anchor="city-design-location-search"]')
        ?.contains(cityInput)
    ).toBe(true);
    expect(
      within(container)
        .getByRole('button', { name: 'Load OSM' })
        .getAttribute('data-tutorial-anchor')
    ).toBe('city-design-load-osm');
    const searchAnchor = container.querySelector(
      '[data-tutorial-anchor="city-design-location-search"]'
    );
    expect(searchAnchor?.getAttribute('data-location-search-ready')).toBe('false');

    rerender(<StreetAreaPickerView {...props} locationSearchResetKey={1} />);
    expect(searchAnchor?.getAttribute('data-location-search-ready')).toBe('true');

    const loadOsm = within(container).getByRole('button', { name: 'Load OSM' });
    const resetSearch = within(container).getByRole('button', { name: 'Reset search' });
    expect(loadOsm.getAttribute('data-action-id')).toBe('amendments.street-area.load.osm');
    expect(resetSearch.getAttribute('data-action-id')).toBe(
      'amendments.street-area.reset.location-search'
    );

    fireEvent.click(loadOsm);
    fireEvent.click(resetSearch);

    expect(onLoadOsm).toHaveBeenCalledTimes(1);
    expect(onLocationSearchReset).toHaveBeenCalledTimes(1);
  });

  it('advances only after selecting Euckenstraße 38 from the dropdown', () => {
    const actionHandler = vi.fn();
    window.addEventListener(APP_TUTORIAL_ACTION_EVENT, actionHandler);
    const { container } = render(
      <StreetAreaPickerView
        {...createPickerProps({
          tutorialActive: true,
          locationSearchValues: {
            country: 'Deutschland',
            region: 'Bayern',
            city: 'München',
            post_code: '',
            street: 'Euckenstraße',
            house_number: '38',
          },
        })}
      />
    );
    const locationSearch = container.querySelector(
      '[data-tutorial-anchor="city-design-location-search"]'
    );
    const houseNumberInput = within(container).getByPlaceholderText('House number');
    const listbox = document.createElement('div');
    const option = document.createElement('button');
    const optionValue = document.createElement('span');
    listbox.id = 'tutorial-house-number-options';
    listbox.setAttribute('role', 'listbox');
    option.setAttribute('role', 'option');
    optionValue.textContent = '38';
    option.append(optionValue);
    listbox.append(option);
    locationSearch?.append(listbox);
    houseNumberInput.setAttribute('aria-controls', listbox.id);

    fireEvent.mouseDown(option);

    expect(actionHandler).toHaveBeenCalledTimes(1);
    const dispatchedEvent = actionHandler.mock.calls[0]?.[0] as CustomEvent;
    expect(dispatchedEvent.detail).toEqual({
      type: 'action',
      event: 'city-design.location-selected',
    });
    window.removeEventListener(APP_TUTORIAL_ACTION_EVENT, actionHandler);
  });

  it('collapses and expands the map section body', () => {
    const { container } = render(<StreetAreaPickerView {...createPickerProps()} />);

    const trigger = within(container).getByRole('button', {
      name: 'Map section',
    });
    expect(trigger.getAttribute('data-action-id')).toBe(
      'amendments.street-area.toggle.map-section'
    );
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
    const props = createPickerProps({
      reactLeafletModule,
      bounds: initialBounds,
    });
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

  it('accepts finite dimensions and ignores invalid numeric input', () => {
    const onWidthMetersChange = vi.fn();
    const onHeightMetersChange = vi.fn();
    const onRotationDegreesChange = vi.fn();
    render(
      <StreetAreaPickerView
        {...createPickerProps({
          onWidthMetersChange,
          onHeightMetersChange,
          onRotationDegreesChange,
        })}
      />
    );
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '120' } });
    fireEvent.change(inputs[1], { target: { value: '130' } });
    fireEvent.change(inputs[2], { target: { value: '15' } });
    expect(onWidthMetersChange).toHaveBeenCalledWith(120);
    expect(onHeightMetersChange).toHaveBeenCalledWith(130);
    expect(onRotationDegreesChange).toHaveBeenCalledWith(15);
    streetAreaPickerViewInternals.applyFiniteMapDimension(Number.NaN, onWidthMetersChange);
    streetAreaPickerViewInternals.applyFiniteMapDimension(Number.NaN, onHeightMetersChange);
    streetAreaPickerViewInternals.applyFiniteMapDimension(Number.NaN, onRotationDegreesChange);
    expect(onWidthMetersChange).toHaveBeenCalledTimes(1);
    expect(onHeightMetersChange).toHaveBeenCalledTimes(1);
    expect(onRotationDegreesChange).toHaveBeenCalledTimes(1);
  });

  it('renders panel loading and error states', () => {
    const { container, rerender } = render(
      <StreetAreaPickerView
        {...createPickerProps({ variant: 'panel', mapLoading: true, isLoadingOsm: true })}
      />
    );
    expect(screen.getByText(/loading map/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /loading/i }).hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('section')?.className).toContain('rounded-none');
    rerender(
      <StreetAreaPickerView
        {...createPickerProps({
          reactLeafletModule: createReactLeafletFixture().reactLeafletModule,
          selectionCorners: [],
          osmError: 'Overpass failed',
        })}
      />
    );
    expect(screen.getByText('Overpass failed')).toBeTruthy();
  });

  it('ignores non-tutorial and mismatched tutorial option interactions', () => {
    const actionHandler = vi.fn();
    window.addEventListener(APP_TUTORIAL_ACTION_EVENT, actionHandler);
    const { container, rerender } = render(<StreetAreaPickerView {...createPickerProps()} />);
    const anchor = container.querySelector('[data-tutorial-anchor="city-design-location-search"]')!;
    fireEvent.mouseDown(anchor);

    rerender(
      <StreetAreaPickerView
        {...createPickerProps({
          tutorialActive: true,
          locationSearchValues: {
            country: '',
            region: '',
            city: '',
            post_code: '',
            street: 'Different street',
            house_number: '',
          },
        })}
      />
    );
    const listbox = document.createElement('div');
    listbox.id = 'mismatched-list';
    listbox.setAttribute('role', 'listbox');
    const option = document.createElement('button');
    option.setAttribute('role', 'option');
    listbox.append(option);
    anchor.append(listbox);
    fireEvent.mouseDown(option);
    within(container)
      .getByPlaceholderText('House number')
      .setAttribute('aria-controls', listbox.id);
    fireEvent.mouseDown(option);
    expect(actionHandler).not.toHaveBeenCalled();
    window.removeEventListener(APP_TUTORIAL_ACTION_EVENT, actionHandler);
  });

  it('guards read-only map clicks and forwards editable map clicks', () => {
    let clickHandler: ((event: { latlng: { lat: number; lng: number } }) => void) | undefined;
    const fixture = createReactLeafletFixture();
    fixture.reactLeafletModule.useMapEvents = vi.fn(handlers => {
      clickHandler = handlers.click;
    });
    const onBboxMove = vi.fn();
    const onBboxMoveEnd = vi.fn();
    const { rerender } = render(
      <StreetAreaPickerView
        {...createPickerProps({
          reactLeafletModule: fixture.reactLeafletModule,
          readOnly: true,
          onBboxMove,
          onBboxMoveEnd,
        })}
      />
    );
    clickHandler?.({ latlng: { lat: 1, lng: 2 } });
    expect(onBboxMove).not.toHaveBeenCalled();
    rerender(
      <StreetAreaPickerView
        {...createPickerProps({
          reactLeafletModule: fixture.reactLeafletModule,
          readOnly: false,
          onBboxMove,
          onBboxMoveEnd,
        })}
      />
    );
    clickHandler?.({ latlng: { lat: 3, lng: 4 } });
    expect(onBboxMove).toHaveBeenCalledWith({ lat: 3, lon: 4 });
    expect(onBboxMoveEnd).toHaveBeenCalledWith({ lat: 3, lon: 4 });
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

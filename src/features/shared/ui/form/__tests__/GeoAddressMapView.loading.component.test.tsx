/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GeoAddressMapView } from '../GeoAddressMapView';

const baseProps = {
  coordinates: null,
  onCoordinatesChange: vi.fn(),
  isBusy: false,
  loadingLabel: 'Loading map',
  unavailableLabel: 'Map unavailable',
  busyLabel: 'Syncing map',
  emptyMessage: 'Choose a place',
  moveHint: 'Move the marker',
  interactive: true,
  reactLeafletModule: null,
  setReactLeafletModule: vi.fn(),
  leafletModule: null,
  setLeafletModule: vi.fn(),
  loadFailed: false,
  setLoadFailed: vi.fn(),
  markerIcon: null,
  position: [20, 0],
  zoom: 2,
  MapContainer: undefined,
  Marker: undefined,
  TileLayer: undefined,
  useMap: undefined,
  useMapEvents: undefined,
  MapViewportController: () => null,
  MapClickHandler: () => null,
};

afterEach(() => {
  cleanup();
});

describe('GeoAddressMapView loading states', () => {
  it('shows a map skeleton while map modules are loading', () => {
    render(<GeoAddressMapView {...baseProps} />);

    expect(screen.getByText('Loading map')).toBeTruthy();
    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeTruthy();
  });

  it('shows unavailable copy after map modules fail', () => {
    render(<GeoAddressMapView {...baseProps} loadFailed />);

    expect(screen.getByText('Map unavailable')).toBeTruthy();
    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeNull();
  });
});

// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupporterMapItem } from '@/features/amendments/logic/supporterDirectory';
import { SupporterLocalityMap } from '@/features/amendments/ui/SupporterLocalityMap';
import { SupporterLocalityMapView } from '@/features/amendments/ui/SupporterLocalityMapView';
import { Button } from '@/features/shared/ui/ui/button';

vi.mock('leaflet', () => ({
  divIcon: vi.fn(() => ({ icon: true })),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    children,
    position,
    eventHandlers,
  }: {
    children?: ReactNode;
    position: [number, number];
    eventHandlers?: {
      mouseover?: () => void;
      mouseout?: () => void;
      click?: () => void;
    };
  }) => (
    <Button
      type="button"
      data-testid={`marker-${position[0]}-${position[1]}`}
      onMouseEnter={() => eventHandlers?.mouseover?.()}
      onMouseLeave={() => eventHandlers?.mouseout?.()}
      onClick={() => eventHandlers?.click?.()}
    >
      {children}
    </Button>
  ),
  Tooltip: ({ children }: { children: ReactNode }) => (
    <div data-testid="marker-tooltip">{children}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

function createMapItem(overrides?: Partial<SupporterMapItem>): SupporterMapItem {
  return {
    groupId: overrides?.groupId ?? 'group-a',
    name: overrides?.name ?? 'Alpha Circle',
    href: overrides?.href ?? '/group/group-a',
    memberCount: overrides?.memberCount ?? 12,
    supportStatus: overrides?.supportStatus ?? 'active',
    locationLabel: overrides?.locationLabel ?? 'Berlin, Germany',
    latitude: overrides?.latitude ?? 52.52,
    longitude: overrides?.longitude ?? 13.405,
  };
}

describe('SupporterLocalityMap', () => {
  it('renders a map skeleton while map modules load', () => {
    render(
      <SupporterLocalityMapView
        items={[createMapItem()]}
        activeMarkerIcon={null}
        center={[52.52, 13.405]}
        loadFailed={false}
        markerIcon={null}
        reactLeafletModule={null}
        zoom={10}
      />
    );

    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeTruthy();
    expect(
      screen.queryByText('generated.inline.0175_supporter_map_is_loading_3dbf4547')
    ).toBeNull();
  });

  it('renders an unavailable message when map modules fail', () => {
    render(
      <SupporterLocalityMapView
        items={[createMapItem()]}
        activeMarkerIcon={null}
        center={[52.52, 13.405]}
        loadFailed
        markerIcon={null}
        reactLeafletModule={null}
        zoom={10}
      />
    );

    expect(screen.getByText('Map could not be loaded.')).toBeTruthy();
    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeNull();
  });

  it('shows supporter details for the active marker', async () => {
    render(<SupporterLocalityMap items={[createMapItem()]} activeGroupId="group-a" />);

    await waitFor(() => expect(screen.getByTestId('map-container')).toBeTruthy());

    expect(screen.getByTestId('marker-tooltip').textContent).toContain('Alpha Circle');
    expect(screen.getByTestId('marker-tooltip').textContent).toContain('Berlin, Germany');
    expect(screen.getByTestId('marker-tooltip').textContent?.replace(/\s+/g, '')).toContain(
      '12members'
    );
  });

  it('emits hover and click callbacks for markers', async () => {
    const hoverChange = vi.fn();
    const select = vi.fn();

    render(
      <SupporterLocalityMap
        items={[createMapItem()]}
        onHoverChange={hoverChange}
        onSelect={select}
      />
    );

    const marker = await screen.findByTestId('marker-52.52-13.405');

    fireEvent.mouseEnter(marker);
    fireEvent.mouseLeave(marker);
    fireEvent.click(marker);

    expect(hoverChange).toHaveBeenNthCalledWith(1, 'group-a');
    expect(hoverChange).toHaveBeenNthCalledWith(2, null);
    expect(select).toHaveBeenCalledWith('group-a');
  });
});

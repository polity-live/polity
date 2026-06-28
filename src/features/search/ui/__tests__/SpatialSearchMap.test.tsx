// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchDocument } from '../../types/search-document.types';
import type { SearchSpatialItem } from '../../logic/searchSpatial';
import { SpatialSearchMap } from '../SpatialSearchMap';

const { mockClusterProps, mockDivIcon, mockFlyTo, mockGetZoom, mockStopPropagation } = vi.hoisted(
  () => ({
    mockClusterProps: vi.fn(),
    mockDivIcon: vi.fn((options: unknown) => ({ options })),
    mockFlyTo: vi.fn(),
    mockGetZoom: vi.fn(() => 6),
    mockStopPropagation: vi.fn(),
  })
);

vi.mock('leaflet', () => ({
  DomEvent: {
    stopPropagation: mockStopPropagation,
  },
  default: {
    DomEvent: {
      stopPropagation: mockStopPropagation,
    },
    divIcon: mockDivIcon,
  },
  divIcon: mockDivIcon,
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children, ...props }: { children: ReactNode }) => {
    mockClusterProps(props);
    return <div data-testid="mock-marker-cluster-group">{children}</div>;
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-map-container">{children}</div>
  ),
  Marker: ({
    children,
    eventHandlers,
  }: {
    children?: ReactNode;
    eventHandlers?: {
      click?: (event: { originalEvent: Event }) => void;
      mouseover?: () => void;
    };
  }) => (
    <button
      type="button"
      data-testid="mock-spatial-marker"
      onClick={() => eventHandlers?.click?.({ originalEvent: new Event('click') })}
      onMouseEnter={() => eventHandlers?.mouseover?.()}
    >
      {children}
    </button>
  ),
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => ({
    flyTo: mockFlyTo,
    getBounds: () => ({
      getEast: () => 15.5,
      getNorth: () => 55.2,
      getSouth: () => 47.2,
      getWest: () => 5.5,
    }),
    getZoom: mockGetZoom,
  }),
  useMapEvents: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function createSpatialItem(overrides?: Partial<SearchSpatialItem>): SearchSpatialItem {
  const id = overrides?.id ?? 'event:event-1';

  return {
    id,
    document: { id, title: overrides?.title ?? 'Town hall' } as SearchDocument,
    type: overrides?.type ?? 'event',
    title: overrides?.title ?? 'Town hall',
    locationLabel: overrides?.locationLabel ?? 'Berlin',
    locationSource: overrides?.locationSource ?? 'event',
    coordinates: overrides?.coordinates ?? {
      latitude: 52.52,
      longitude: 13.405,
    },
  };
}

describe('SpatialSearchMap', () => {
  it('renders a map skeleton while map modules load', () => {
    render(
      <SpatialSearchMap
        items={[createSpatialItem()]}
        activeItem={null}
        center={[51.1657, 10.4515]}
        onBoundsChange={vi.fn()}
        onItemSelect={vi.fn()}
      />
    );

    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('generated.inline.1166_map_is_loading_5299ec7c')).toBeNull();
  });

  it('renders search markers through MarkerClusterGroup and forwards marker clicks', async () => {
    const onItemSelect = vi.fn();
    const onActiveDocumentChange = vi.fn();

    render(
      <SpatialSearchMap
        items={[createSpatialItem()]}
        activeItem={null}
        center={[51.1657, 10.4515]}
        onBoundsChange={vi.fn()}
        onActiveDocumentChange={onActiveDocumentChange}
        onItemSelect={onItemSelect}
      />
    );

    await screen.findByTestId('mock-marker-cluster-group');

    const clusterProps = mockClusterProps.mock.calls.at(-1)?.[0];
    expect(clusterProps).toMatchObject({
      chunkedLoading: true,
      maxClusterRadius: 44,
      showCoverageOnHover: false,
      spiderfyDistanceMultiplier: 1.15,
      spiderfyOnEveryZoom: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
    });

    clusterProps.iconCreateFunction({ getChildCount: () => 12 });
    expect(mockDivIcon).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('12') })
    );

    const marker = screen.getByTestId('mock-spatial-marker');
    fireEvent.mouseEnter(marker);
    expect(onActiveDocumentChange).not.toHaveBeenCalled();

    fireEvent.click(marker);

    expect(mockStopPropagation).toHaveBeenCalled();
    expect(onActiveDocumentChange).toHaveBeenCalledWith('event:event-1');
    expect(onItemSelect).toHaveBeenCalledWith('event:event-1');
  });

  it('centers the map when a list selection activates an item', async () => {
    const activeItem = createSpatialItem();

    render(
      <SpatialSearchMap
        items={[activeItem]}
        activeItem={activeItem}
        activeDocumentId={activeItem.id}
        center={[51.1657, 10.4515]}
        onBoundsChange={vi.fn()}
        onItemSelect={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(mockFlyTo).toHaveBeenCalledWith([52.52, 13.405], 9, {
        animate: true,
        duration: 0.35,
      })
    );
  });
});

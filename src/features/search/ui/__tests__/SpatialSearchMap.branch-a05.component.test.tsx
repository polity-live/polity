// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpatialSearchMap } from '../SpatialSearchMap';

const mocks = vi.hoisted(() => ({
  divIcon: vi.fn(),
  flyTo: vi.fn(),
  getZoom: vi.fn(),
  stopPropagation: vi.fn(),
  mapEvents: null as any,
  clusterProps: null as any,
  mapContainerProps: null as any,
  missingFirstMarkerIcon: false,
  markerIconCalls: 0,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeMarkup: (key: string) => `markup:${key}`,
  featureThemeValue: (key: string) => `color:${key}`,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: ({ label }: any) => <div data-testid="skeleton">{label}</div>,
}));

vi.mock('leaflet', () => ({
  DomEvent: { stopPropagation: mocks.stopPropagation },
  default: {
    DomEvent: { stopPropagation: mocks.stopPropagation },
    divIcon: (...args: any[]) => mocks.divIcon(...args),
  },
  divIcon: (...args: any[]) => mocks.divIcon(...args),
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children, ...props }: { children: ReactNode }) => {
    mocks.clusterProps = props;
    return <div data-testid="cluster">{children}</div>;
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => {
    mocks.mapContainerProps = props;
    return <div data-testid="map">{children}</div>;
  },
  TileLayer: () => <div />,
  Marker: ({ children, eventHandlers }: any) => (
    <div>
      <button type="button" data-testid="marker-no-event" onClick={() => eventHandlers.click()}>
        no event
      </button>
      <button
        type="button"
        data-testid="marker-event"
        onClick={() => eventHandlers.click({ originalEvent: new Event('click') })}
      >
        event
      </button>
      {children}
    </div>
  ),
  Tooltip: ({ children }: any) => <div>{children}</div>,
  useMap: () => ({
    flyTo: mocks.flyTo,
    getZoom: mocks.getZoom,
    getBounds: () => ({
      getNorth: () => 10,
      getSouth: () => -10,
      getEast: () => 20,
      getWest: () => -20,
    }),
  }),
  useMapEvents: (events: any) => {
    mocks.mapEvents = events;
    return null;
  },
}));

function item(type: string, index: number, locationLabel: string | null = `Location ${index}`) {
  return {
    id: `${type}:${index}`,
    type,
    title: `${type} ${index}`,
    locationLabel,
    coordinates: { latitude: index, longitude: -index },
    document: { id: `${type}:${index}` },
    locationSource: 'event',
  } as any;
}

describe('SpatialSearchMap remaining branches', () => {
  beforeEach(() => {
    mocks.divIcon.mockReset().mockImplementation((options: any) => {
      const isMarker = String(options.html).includes('display:block');
      if (isMarker) {
        mocks.markerIconCalls += 1;
        if (mocks.missingFirstMarkerIcon && mocks.markerIconCalls === 1) return undefined;
      }
      return { options };
    });
    mocks.flyTo.mockReset();
    mocks.getZoom.mockReset().mockReturnValue(12);
    mocks.stopPropagation.mockReset();
    mocks.mapEvents = null;
    mocks.clusterProps = null;
    mocks.mapContainerProps = null;
    mocks.missingFirstMarkerIcon = false;
    mocks.markerIconCalls = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('creates every marker color, skips duplicate icon work, reports bounds, and covers cluster sizes', async () => {
    const types = [
      'vote',
      'election',
      'event',
      'agenda_item',
      'amendment',
      'workflow',
      'todo',
      'group',
      'statement',
      'blog',
      'user',
      'unknown',
      'event',
    ];
    const items = types.map((type, index) => item(type, index, index === 0 ? null : undefined));
    const onBoundsChange = vi.fn();
    const onItemSelect = vi.fn();
    render(
      <SpatialSearchMap
        items={items}
        activeItem={null}
        center={[0, 0]}
        onBoundsChange={onBoundsChange}
        onItemSelect={onItemSelect}
      />
    );

    await waitFor(() => expect(mocks.clusterProps).toBeTruthy());
    expect(mocks.mapContainerProps.zoom).toBe(6);
    mocks.clusterProps.iconCreateFunction({ getChildCount: () => 100 });
    mocks.clusterProps.iconCreateFunction({ getChildCount: () => 12 });
    mocks.clusterProps.iconCreateFunction({ getChildCount: () => 5 });
    expect(mocks.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('99+') })
    );
    expect(mocks.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('34px') })
    );
    expect(mocks.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('40px') })
    );

    act(() => mocks.mapEvents.moveend());
    await waitFor(() =>
      expect(onBoundsChange).toHaveBeenCalledWith({
        north: 10,
        south: -10,
        east: 20,
        west: -20,
      })
    );
    act(() => mocks.mapEvents.zoomend());

    fireEvent.click(screen.getAllByTestId('marker-no-event')[0]);
    expect(mocks.stopPropagation).not.toHaveBeenCalled();
    expect(onItemSelect).toHaveBeenCalledWith('vote:0');
  });

  it('uses the active icon, preserves high zoom, stops propagation, and calls the optional callback', async () => {
    const active = item('event', 1);
    const onActiveDocumentChange = vi.fn();
    render(
      <SpatialSearchMap
        items={[active]}
        activeItem={active}
        activeDocumentId={active.id}
        center={[0, 0]}
        onBoundsChange={vi.fn()}
        onActiveDocumentChange={onActiveDocumentChange}
        onItemSelect={vi.fn()}
      />
    );
    await waitFor(() => expect(mocks.flyTo).toHaveBeenCalledWith([1, -1], 12, expect.any(Object)));
    expect(mocks.mapContainerProps.zoom).toBe(10);
    fireEvent.click(screen.getByTestId('marker-event'));
    expect(mocks.stopPropagation).toHaveBeenCalled();
    expect(onActiveDocumentChange).toHaveBeenCalledWith(active.id);
  });

  it('omits a marker when its icon factory yields no icon', async () => {
    mocks.missingFirstMarkerIcon = true;
    render(
      <SpatialSearchMap
        items={[item('event', 1)]}
        activeItem={null}
        center={[0, 0]}
        onBoundsChange={vi.fn()}
        onItemSelect={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByTestId('cluster')).toBeTruthy());
    expect(screen.queryByTestId('marker-event')).toBeNull();
  });

  it('ignores resolved dynamic modules after immediate unmount', () => {
    const rendered = render(
      <SpatialSearchMap
        items={[]}
        activeItem={null}
        center={[0, 0]}
        onBoundsChange={vi.fn()}
        onItemSelect={vi.fn()}
      />
    );
    rendered.unmount();
  });
});

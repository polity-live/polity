/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/amendments/ui/SupporterDirectoryDetails', () => ({
  SupporterDirectoryDetails: ({ item }: any) => <span>details:{item.groupId}</span>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: () => <div>map skeleton</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback: string) => fallback,
}));

import { SupporterLocalityMapView } from '../SupporterLocalityMapView';

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

const components = {
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => <div />,
  Marker: ({ children, icon }: any) => <div data-icon={icon?.id}>{children}</div>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
};

const GeoJSON = ({ children, style }: any) => (
  <div data-testid="geojson" data-weight={style.weight}>
    {children}
  </div>
);
const Viewport = ({ bounds }: any) => <div data-testid="viewport">{JSON.stringify(bounds)}</div>;

function common(overrides: Record<string, any> = {}) {
  return {
    items: [item()],
    activeMarkerIcon: { id: 'active' },
    center: [10, 20] as [number, number],
    loadFailed: false,
    markerIcon: { id: 'idle' },
    reactLeafletModule: components as any,
    zoom: 10,
    ...overrides,
  } as unknown as ComponentProps<typeof SupporterLocalityMapView>;
}

describe('SupporterLocalityMapView A04 branch accountability', () => {
  afterEach(() => cleanup());

  it('returns null without items', () => {
    const { container } = render(<SupporterLocalityMapView {...common({ items: [] })} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the skeleton for each missing module or icon dependency', () => {
    const { rerender } = render(
      <SupporterLocalityMapView {...common({ reactLeafletModule: null })} />
    );
    expect(screen.getByText('map skeleton')).toBeTruthy();
    rerender(<SupporterLocalityMapView {...common({ markerIcon: null })} />);
    expect(screen.getByText('map skeleton')).toBeTruthy();
    rerender(<SupporterLocalityMapView {...common({ activeMarkerIcon: null })} />);
    expect(screen.getByText('map skeleton')).toBeTruthy();
  });

  it('renders active and idle areas, idle markers, and viewport bounds', () => {
    const areaShape = {
      kind: 'city',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    };
    const { rerender } = render(
      <SupporterLocalityMapView
        {...common({
          items: [
            item({ groupId: 'active-area', locationShape: areaShape }),
            item({ groupId: 'idle-area', locationShape: areaShape }),
            item({ groupId: 'idle-marker' }),
          ],
          activeGroupId: 'active-area',
          GeoJSON,
          MapViewportController: Viewport,
          viewportBounds: undefined,
        })}
      />
    );
    expect(screen.getAllByTestId('geojson')).toHaveLength(2);
    expect(screen.getByText('details:active-area')).toBeTruthy();
    expect(screen.queryByText('details:idle-area')).toBeNull();
    expect(screen.getByTestId('viewport').textContent).toBe('null');

    rerender(
      <SupporterLocalityMapView
        {...common({
          items: [item({ groupId: 'area-as-marker', locationShape: areaShape })],
          activeGroupId: null,
          GeoJSON: undefined,
          MapViewportController: Viewport,
          viewportBounds: { south: 0, west: 0, north: 1, east: 1 },
        })}
      />
    );
    expect(screen.queryByTestId('geojson')).toBeNull();
    expect(screen.getByTestId('viewport').textContent).toContain('south');
  });

  it('omits a viewport controller when none is supplied', () => {
    render(<SupporterLocalityMapView {...common()} />);
    expect(screen.queryByTestId('viewport')).toBeNull();
  });
});

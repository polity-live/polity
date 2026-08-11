/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  markers: [] as Record<string, any>[],
}));

vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (name: string) => name }));
vi.mock('../CivicTimelineActiveMarkerContainer', () => ({
  CivicTimelineActiveMarkerContainer: () => <div>Active marker</div>,
}));

import { CivicTimelineMapView } from '../CivicTimelineMapView';

const reactLeafletModule = {
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => <div>Tiles</div>,
  Marker: (props: Record<string, any>) => {
    mocks.markers.push(props);
    return <div>{props.children}</div>;
  },
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: vi.fn(),
} as any;

const base = {
  id: 'item-1',
  type: 'event',
  title: 'Assembly',
  timestamp: Date.now(),
  coordinates: { latitude: 52.5, longitude: 13.4 },
} as any;

beforeEach(() => {
  mocks.markers = [];
});
afterEach(cleanup);

describe('CivicTimelineMapView', () => {
  it('skips items without coordinates or icons', () => {
    render(
      <CivicTimelineMapView
        items={[
          { ...base, id: 'no-coordinates', coordinates: undefined },
          { ...base, id: 'no-icon', type: 'blog' },
        ]}
        activeItemId={null}
        activeItem={null}
        reactLeafletModule={reactLeafletModule}
        iconsByType={new Map()}
        activeIcon={{ active: true } as any}
        center={[52.5, 13.4]}
        zoom={10}
      />
    );
    expect(mocks.markers).toHaveLength(0);
  });

  it('renders active and inactive markers with optional location labels', () => {
    const iconsByType = new Map([['event', { event: true } as any]]);
    render(
      <CivicTimelineMapView
        items={[
          { ...base, locationLabel: 'Berlin' },
          { ...base, id: 'item-2', title: 'Second' },
        ]}
        activeItemId="item-1"
        activeItem={base}
        reactLeafletModule={reactLeafletModule}
        iconsByType={iconsByType}
        activeIcon={{ active: true } as any}
        center={[52.5, 13.4]}
        zoom={10}
      />
    );
    expect(mocks.markers).toHaveLength(2);
    expect(mocks.markers[0].icon).toEqual({ active: true });
    expect(mocks.markers[1].icon).toEqual({ event: true });
    expect(mocks.markers[0].children.props.permanent).toBe(true);
    expect(mocks.markers[1].children.props.permanent).toBe(false);
  });

  it('dispatches marker callbacks and tolerates absent callbacks', () => {
    const onActiveItemChange = vi.fn();
    const onItemSelect = vi.fn();
    const iconsByType = new Map([['event', { event: true } as any]]);
    const { rerender } = render(
      <CivicTimelineMapView
        items={[base]}
        activeItemId={null}
        activeItem={null}
        onActiveItemChange={onActiveItemChange}
        onItemSelect={onItemSelect}
        reactLeafletModule={reactLeafletModule}
        iconsByType={iconsByType}
        activeIcon={{ active: true } as any}
        center={[52.5, 13.4]}
        zoom={10}
      />
    );
    mocks.markers[0].eventHandlers.mouseover();
    mocks.markers[0].eventHandlers.mouseout();
    mocks.markers[0].eventHandlers.click();
    expect(onActiveItemChange).toHaveBeenNthCalledWith(1, 'item-1');
    expect(onActiveItemChange).toHaveBeenNthCalledWith(2, null);
    expect(onItemSelect).toHaveBeenCalledWith(base);

    mocks.markers = [];
    rerender(
      <CivicTimelineMapView
        items={[base]}
        activeItemId={null}
        activeItem={null}
        reactLeafletModule={reactLeafletModule}
        iconsByType={iconsByType}
        activeIcon={{ active: true } as any}
        center={[52.5, 13.4]}
        zoom={10}
      />
    );
    expect(() => {
      mocks.markers[0].eventHandlers.mouseover();
      mocks.markers[0].eventHandlers.mouseout();
      mocks.markers[0].eventHandlers.click();
    }).not.toThrow();
  });
});

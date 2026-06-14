/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CivicTimelineItem, CivicTimelineSection } from '../../logic/civicTimeline';
import { CivicTimelineMap } from '../CivicTimelineMap';
import { CivicTimelineRail } from '../CivicTimelineRail';
import { Button } from '@/features/shared/ui/ui/button';

const { mockFlyTo, mockGetZoom } = vi.hoisted(() => ({
  mockFlyTo: vi.fn(),
  mockGetZoom: vi.fn(() => 7),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: (options: unknown) => ({ options }),
  },
  divIcon: (options: unknown) => ({ options }),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-map-container">{children}</div>
  ),
  Marker: ({
    children,
    eventHandlers,
  }: {
    children: ReactNode;
    eventHandlers?: {
      click?: () => void;
      mouseout?: () => void;
      mouseover?: () => void;
    };
  }) => (
    <Button
      type="button"
      data-testid="mock-marker"
      onClick={() => eventHandlers?.click?.()}
      onMouseEnter={() => eventHandlers?.mouseover?.()}
      onMouseLeave={() => eventHandlers?.mouseout?.()}
    >
      {children}
    </Button>
  ),
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => ({
    flyTo: mockFlyTo,
    getZoom: mockGetZoom,
  }),
}));

const item: CivicTimelineItem = {
  id: 'event-1',
  entityId: 'event-1',
  type: 'event',
  title: 'Town hall vote',
  description: 'A relevant civic event nearby.',
  href: '/event/event-1',
  sourceName: 'City Assembly',
  sourceHref: '/group/group-1',
  timestamp: new Date('2026-06-13T10:00:00Z'),
  startDate: new Date('2026-06-13T18:00:00Z'),
  locationLabel: 'Berlin',
  coordinates: {
    latitude: 52.52,
    longitude: 13.405,
  },
  distanceKm: 2.4,
  reason: 'near_you',
  stats: {
    participants: 14,
  },
  statsLabel: '14 attending',
  tags: ['mobility'],
};

const sections: CivicTimelineSection[] = [
  {
    id: 'today',
    labelKey: 'features.timeline.around.sections.today',
    items: [item],
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CivicTimelineRail', () => {
  it('shows an empty state when no timeline sections exist', () => {
    render(<CivicTimelineRail sections={[]} />);

    expect(screen.getByText('No activity yet')).toBeTruthy();
    expect(
      screen.getByText('When civic activity appears around you, it will show up here.')
    ).toBeTruthy();
  });

  it('syncs item hover and click with the active timeline item', () => {
    const onActiveItemChange = vi.fn();
    const onItemSelect = vi.fn();

    render(
      <CivicTimelineRail
        sections={sections}
        onActiveItemChange={onActiveItemChange}
        onItemSelect={onItemSelect}
      />
    );

    const timelineItem = document.querySelector('[data-timeline-item-id="event-1"]');
    expect(timelineItem).toBeTruthy();

    fireEvent.mouseEnter(timelineItem as Element);
    expect(onActiveItemChange).toHaveBeenCalledWith('event-1');

    fireEvent.click(timelineItem as Element);
    expect(onActiveItemChange).toHaveBeenCalledWith('event-1');

    fireEvent.mouseLeave(timelineItem as Element);
    expect(onActiveItemChange).toHaveBeenCalledWith(null);

    const titleLink = screen.getByRole('link', { name: 'Town hall vote' });
    titleLink.addEventListener('click', event => event.preventDefault());

    fireEvent.click(titleLink);
    expect(onItemSelect).toHaveBeenCalledWith(item);
  });
});

describe('CivicTimelineMap', () => {
  it('syncs marker hover and click with the timeline rail', async () => {
    const onActiveItemChange = vi.fn();
    const onItemSelect = vi.fn();

    render(
      <CivicTimelineMap
        items={[item]}
        onActiveItemChange={onActiveItemChange}
        onItemSelect={onItemSelect}
      />
    );

    const marker = await screen.findByTestId('mock-marker');

    fireEvent.mouseEnter(marker);
    expect(onActiveItemChange).toHaveBeenCalledWith('event-1');

    fireEvent.click(marker);
    expect(onItemSelect).toHaveBeenCalledWith(item);

    fireEvent.mouseLeave(marker);
    expect(onActiveItemChange).toHaveBeenCalledWith(null);
  });

  it('centers the map when a rail item is active', async () => {
    render(<CivicTimelineMap items={[item]} activeItemId="event-1" />);

    await screen.findByTestId('mock-marker');

    expect(mockFlyTo).toHaveBeenCalledWith([52.52, 13.405], 9, {
      animate: true,
      duration: 0.35,
    });
  });
});

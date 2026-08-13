/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CivicTimelineItem, CivicTimelineSection } from '../../logic/civicTimeline';
import { CivicTimelineMap } from '../CivicTimelineMap';
import { CivicTimelineRail } from '../CivicTimelineRail';
import { ModernTimelineView } from '../ModernTimelineView';
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

vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[], { type: 'complete' }],
  useZero: () => ({ mutate: {} }),
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

function createTimelineViewProps(): ComponentProps<typeof ModernTimelineView> {
  return {
    userId: 'user-1',
    mode: 'timeline',
    setMode: vi.fn(),
    filters: {
      contentTypes: ['event'],
      dateRange: 'all',
      topics: [],
      engagement: 'all',
      sortBy: 'recent',
      searchQuery: '',
    },
    setContentTypes: vi.fn(),
    toggleContentType: vi.fn(),
    setDateRange: vi.fn(),
    toggleTopic: vi.fn(),
    setEngagement: vi.fn(),
    showFilterPanel: false,
    setShowFilterPanel: vi.fn(),
    radiusKm: 'all',
    setRadiusKm: vi.fn(),
    activeItemId: null,
    setActiveItemId: vi.fn(),
    decisionTerminal: {
      decisions: [],
      isLoading: false,
      urgentCount: 0,
    },
    civicTimeline: {
      items: [item],
      sections,
      mapItems: [item],
      availableTopics: ['mobility'],
      discoverCount: 0,
      isLoading: false,
      userCoordinates: item.coordinates,
    },
    activeFilterCount: 0,
    hasActiveFilters: false,
    handleSortChange: vi.fn(),
    handleResetFilters: vi.fn(),
    handleMapItemSelect: vi.fn(),
    handleRailItemSelect: vi.fn(),
  } as unknown as ComponentProps<typeof ModernTimelineView>;
}

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

  it('uses the full card width for main content on mobile and restores the desktop column', () => {
    render(<CivicTimelineRail sections={sections} />);

    const timelineItem = document.querySelector('[data-timeline-item-id="event-1"]') as HTMLElement;
    const layout = timelineItem.querySelector('[data-slot="timeline-item-layout"]') as HTMLElement;
    const contentColumn = timelineItem.querySelector(
      '[data-slot="timeline-item-content-column"]'
    ) as HTMLElement;
    const metadata = timelineItem.querySelector('[data-slot="timeline-item-meta"]') as HTMLElement;
    const mainContent = timelineItem.querySelector(
      '[data-slot="timeline-item-main-content"]'
    ) as HTMLElement;

    expect(layout.className).toContain('grid');
    expect(layout.className).toContain('min-w-0');
    expect(layout.className).toContain('grid-cols-[auto_minmax(0,1fr)_auto]');
    expect(contentColumn.className).toContain('contents');
    expect(contentColumn.className).toContain('sm:block');
    expect(contentColumn.className).toContain('sm:col-start-2');
    expect(metadata.className).toContain('col-start-2');
    expect(metadata.className).toContain('row-start-1');
    expect(mainContent.className).toContain('col-span-3');
    expect(mainContent.className).toContain('row-start-2');
    expect(mainContent.className).toContain('min-w-0');
    expect(mainContent.className).toContain('max-w-full');
    expect(mainContent.className).toContain('sm:col-auto');
    expect(mainContent.className).toContain('sm:row-auto');
    expect(screen.getByRole('heading', { name: 'Town hall vote' }).className).toContain(
      'break-words'
    );
  });

  it('staggers load reveal indexes across timeline sections', () => {
    const secondItem: CivicTimelineItem = {
      ...item,
      id: 'group-1',
      entityId: 'group-1',
      type: 'group',
      title: 'Neighborhood working group',
      href: '/group/group-1',
      reason: 'member_context',
    };
    const thirdItem: CivicTimelineItem = {
      ...item,
      id: 'amendment-1',
      entityId: 'amendment-1',
      type: 'amendment',
      title: 'Climate reporting amendment',
      href: '/amendment/amendment-1',
      reason: 'urgent_decision',
    };
    const multiSectionTimeline: CivicTimelineSection[] = [
      {
        id: 'today',
        labelKey: 'features.timeline.around.sections.today',
        items: [item, secondItem],
      },
      {
        id: 'this_week',
        labelKey: 'features.timeline.around.sections.thisWeek',
        items: [thirdItem],
      },
    ];

    render(<CivicTimelineRail sections={multiSectionTimeline} />);

    const firstItem = document.querySelector('[data-timeline-item-id="event-1"]') as HTMLElement;
    const secondTimelineItem = document.querySelector(
      '[data-timeline-item-id="group-1"]'
    ) as HTMLElement;
    const thirdTimelineItem = document.querySelector(
      '[data-timeline-item-id="amendment-1"]'
    ) as HTMLElement;

    expect(firstItem.className).toContain('civic-load-card-reveal');
    expect(secondTimelineItem.className).toContain('civic-load-card-reveal');
    expect(thirdTimelineItem.className).toContain('civic-load-card-reveal');
    expect(firstItem.style.getPropertyValue('--civic-load-index')).toBe('0');
    expect(secondTimelineItem.style.getPropertyValue('--civic-load-index')).toBe('1');
    expect(thirdTimelineItem.style.getPropertyValue('--civic-load-index')).toBe('2');
  });
});

describe('CivicTimelineMap', () => {
  it('renders a map skeleton while map modules load', () => {
    render(<CivicTimelineMap items={[item]} activeItemId="event-1" />);

    expect(document.querySelector('[data-slot="map-panel-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('generated.inline.1166_map_is_loading_5299ec7c')).toBeNull();
  });

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

    await waitFor(() => {
      expect(mockFlyTo).toHaveBeenCalledWith([52.52, 13.405], 9, {
        animate: true,
        duration: 0.35,
      });
    });
  });
});

describe('ModernTimelineView', () => {
  it('hides the page title and subtitle while keeping the mode tabs', () => {
    render(<ModernTimelineView {...createTimelineViewProps()} />);

    expect(screen.getByRole('heading', { name: 'Timeline' }).className).toContain('sr-only');
    expect(
      screen.queryByText('What is happening around you, ranked by relevance and proximity.')
    ).toBeNull();
    expect(screen.getByRole('radio', { name: 'features.timeline.modes.timeline' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'features.timeline.modes.decisions' })).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-surface')).toBeTruthy();
  });

  it('places the live timeline rail on the same subtle card surface as the landing preview', () => {
    render(<ModernTimelineView {...createTimelineViewProps()} />);

    const surface = screen.getByTestId('timeline-rail-surface');

    expect(surface.className).toContain('bg-card');
    expect(surface.className).toContain('rounded-lg');
    expect(surface.className).toContain('border');
    expect(surface.className).toContain('shadow-sm');
    expect(screen.getByTestId('civic-timeline-rail')).toBeTruthy();
  });

  it('uses shrinkable map and rail columns in a single-column mobile grid', () => {
    render(<ModernTimelineView {...createTimelineViewProps()} />);

    const grid = screen.getByTestId('timeline-map-rail-grid');
    const mapColumn = screen.getByTestId('timeline-map-column');
    const railColumn = screen.getByTestId('timeline-rail-column');

    expect(grid.className).toContain('min-w-0');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]');
    expect(mapColumn.className).toContain('min-w-0');
    expect(mapColumn.className).toContain('max-w-full');
    expect(railColumn.className).toContain('min-w-0');
    expect(railColumn.className).toContain('max-w-full');
  });

  it('shows discoverable activity only when a discover count exists', () => {
    const props = createTimelineViewProps();
    props.civicTimeline.discoverCount = 3;
    render(<ModernTimelineView {...props} />);

    expect(screen.getByText('{{count}} discover')).toBeTruthy();
  });
});

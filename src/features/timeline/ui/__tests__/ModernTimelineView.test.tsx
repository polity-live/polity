/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  headerProps: undefined as Record<string, any> | undefined,
  filterProps: undefined as Record<string, any> | undefined,
  railProps: undefined as Record<string, any> | undefined,
  mapProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: any) =>
      values?.count !== undefined ? `${key}:${values.count}` : key,
  }),
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: () => ({ handlers: { 'data-swipe-handler': 'yes' } }),
}));
vi.mock('@/features/decision-terminal/ui/DecisionTerminal', () => ({
  DecisionTerminal: () => <div>Decision terminal</div>,
}));
vi.mock('@/features/statements/ui/StatementStoryCarousel', () => ({
  StatementStoryCarousel: () => <div>Stories</div>,
}));
vi.mock('../TimelineHeader', () => ({
  TimelineHeader: (props: Record<string, any>) => {
    mocks.headerProps = props;
    return <div>Header</div>;
  },
}));
vi.mock('../TimelineFilterPanel', () => ({
  TimelineFilterPanel: (props: Record<string, any>) => {
    mocks.filterProps = props;
    return <div>Filters</div>;
  },
}));
vi.mock('../CivicTimelineRail', () => ({
  CivicTimelineRail: (props: Record<string, any>) => {
    mocks.railProps = props;
    return <div>Rail</div>;
  },
}));
vi.mock('../CivicTimelineMap', () => ({
  CivicTimelineMap: (props: Record<string, any>) => {
    mocks.mapProps = props;
    return <div>Map</div>;
  },
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));

import { ModernTimelineView } from '../ModernTimelineView';

function props(overrides: Record<string, any> = {}) {
  return {
    userId: 'user-1',
    mode: 'timeline',
    setMode: vi.fn(),
    filters: {
      sortBy: 'recent',
      contentTypes: ['event'],
      dateRange: 'all',
      topics: [],
      engagement: 'all',
    },
    setContentTypes: vi.fn(),
    toggleContentType: vi.fn(),
    setDateRange: vi.fn(),
    toggleTopic: vi.fn(),
    setEngagement: vi.fn(),
    showFilterPanel: false,
    setShowFilterPanel: vi.fn(),
    radiusKm: 25,
    setRadiusKm: vi.fn(),
    activeItemId: null,
    setActiveItemId: vi.fn(),
    decisionTerminal: { urgentCount: 2, decisions: [], isLoading: false },
    civicTimeline: {
      availableTopics: [],
      mapItems: [],
      discoverCount: 0,
      userCoordinates: { lat: 1, lng: 2 },
      sections: [],
      isLoading: false,
      items: [],
    },
    activeFilterCount: 0,
    hasActiveFilters: false,
    handleSortChange: vi.fn(),
    handleResetFilters: vi.fn(),
    handleMapItemSelect: vi.fn(),
    handleRailItemSelect: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.headerProps = undefined;
  mocks.filterProps = undefined;
  mocks.railProps = undefined;
  mocks.mapProps = undefined;
});
afterEach(cleanup);

describe('ModernTimelineView', () => {
  it('renders nothing without a user', () => {
    const { container } = render(<ModernTimelineView {...(props({ userId: undefined }) as any)} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders decisions mode', () => {
    render(<ModernTimelineView {...(props({ mode: 'decisions', className: 'custom' }) as any)} />);
    expect(screen.getByText('Decision terminal')).toBeTruthy();
    expect(mocks.headerProps?.subtitle).toBe('features.timeline.header.decisionsSubtitle');
  });

  it('renders rich timeline state, filters, discovery, and virtualized query context', () => {
    const viewProps = props({
      showFilterPanel: true,
      civicTimeline: {
        availableTopics: ['climate'],
        mapItems: [{ id: 'one' }],
        discoverCount: 3,
        userCoordinates: undefined,
        sections: [],
        isLoading: true,
        items: [{ id: 'one' }],
      },
      activeFilterCount: 2,
      hasActiveFilters: true,
      virtualizeTimeline: true,
    });
    render(<ModernTimelineView {...(viewProps as any)} />);
    expect(screen.getByText('Filters')).toBeTruthy();
    expect(screen.getByText('features.timeline.around.discoverCount:3')).toBeTruthy();
    expect(screen.getByText('features.timeline.around.noUserLocation')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/search');
    expect(mocks.railProps?.queryContext).toEqual({ contentTypes: ['event'] });
    mocks.headerProps?.onFilterClick();
    expect(viewProps.setShowFilterPanel).toHaveBeenCalledWith(expect.any(Function));
    mocks.filterProps?.onClose();
    expect(viewProps.setShowFilterPanel).toHaveBeenCalledWith(false);
  });

  it('renders lean timeline state without optional panels or links', () => {
    const { container } = render(<ModernTimelineView {...(props() as any)} />);
    expect(screen.queryByText('Filters')).toBeNull();
    expect(screen.queryByText('features.timeline.around.noUserLocation')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(mocks.railProps?.queryContext).toBeUndefined();
  });
});

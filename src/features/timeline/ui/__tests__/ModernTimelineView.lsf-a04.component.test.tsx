/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  filterProps: undefined as any,
  headerProps: undefined as any,
  swipeOptions: undefined as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: (options: any) => {
    mocks.swipeOptions = options;
    return { handlers: {} };
  },
}));
vi.mock('@/features/decision-terminal/ui/DecisionTerminal', () => ({
  DecisionTerminal: () => null,
}));
vi.mock('@/features/statements/ui/StatementStoryCarousel', () => ({
  StatementStoryCarousel: () => null,
}));
vi.mock('../TimelineHeader', () => ({
  TimelineHeader: (props: any) => {
    mocks.headerProps = props;
    return null;
  },
}));
vi.mock('../TimelineFilterPanel', () => ({
  TimelineFilterPanel: (props: any) => {
    mocks.filterProps = props;
    return null;
  },
}));
vi.mock('../CivicTimelineRail', () => ({ CivicTimelineRail: () => null }));
vi.mock('../CivicTimelineMap', () => ({ CivicTimelineMap: () => null }));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <>{children}</>,
}));

import { ModernTimelineView } from '../ModernTimelineView';

afterEach(cleanup);

describe('ModernTimelineView LSF callback contract', () => {
  it('wires swipe, filter toggle, and close callbacks to page state', () => {
    const setMode = vi.fn();
    const setShowFilterPanel = vi.fn();
    render(
      <ModernTimelineView
        {...({
          userId: 'user-1',
          mode: 'timeline',
          setMode,
          filters: {
            sortBy: 'recent',
            contentTypes: [],
            dateRange: 'all',
            topics: [],
            engagement: 'all',
          },
          setContentTypes: vi.fn(),
          toggleContentType: vi.fn(),
          setDateRange: vi.fn(),
          toggleTopic: vi.fn(),
          setEngagement: vi.fn(),
          showFilterPanel: true,
          setShowFilterPanel,
          radiusKm: 25,
          setRadiusKm: vi.fn(),
          activeItemId: null,
          setActiveItemId: vi.fn(),
          decisionTerminal: { urgentCount: 0, decisions: [], isLoading: false },
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
        } as any)}
      />
    );

    mocks.swipeOptions.onSwipePrev();
    mocks.swipeOptions.onSwipeNext();
    mocks.headerProps.onFilterClick();
    const toggle = setShowFilterPanel.mock.calls[0][0];
    expect(toggle(true)).toBe(false);
    mocks.filterProps.onClose();
    expect(setMode.mock.calls).toEqual([['timeline'], ['decisions']]);
    expect(setShowFilterPanel).toHaveBeenLastCalledWith(false);
  });
});

/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ label }: { label?: string }) => <div>{label ?? 'Group card'}</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

import { DynamicTimelineCard, preloadCard, withLazyLoading } from '../LazyCardComponents';
import { InfiniteScrollSentinel } from '../InfiniteScrollSentinel';
import { FocusRing, SkipToTimeline, TimelineRegion } from '../AccessibilityComponents';

afterEach(cleanup);

describe('timeline infrastructure components', () => {
  it('renders custom and default lazy fallbacks', () => {
    const { rerender } = render(
      <DynamicTimelineCard
        cardType="group"
        cardProps={{ label: 'Loaded' }}
        fallback={<div>Custom loading</div>}
      />
    );
    expect(screen.getByText('Custom loading')).toBeTruthy();

    rerender(<DynamicTimelineCard cardType="event" cardProps={{}} className="custom" />);
    expect(screen.getByTestId('skeleton').className).toContain('custom');
  });

  it('rejects unknown cards and safely ignores unknown preloads', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(
      <DynamicTimelineCard cardType={'unknown' as any} cardProps={{}} />
    );
    expect(container.firstChild).toBeNull();
    expect(warning).toHaveBeenCalledWith('Unknown card type: unknown');
    preloadCard('unknown' as any);
    preloadCard('group');
    warning.mockRestore();
  });

  it('wraps arbitrary lazy components with custom and default fallbacks', () => {
    const Custom = withLazyLoading(
      () => Promise.resolve({ default: ({ name }: { name: string }) => <div>Hello {name}</div> }),
      <div>Custom wrapper loading</div>
    );
    const Default = withLazyLoading(() => new Promise<any>(() => undefined));
    const { rerender } = render(<Custom name="Ada" />);
    expect(screen.getByText('Custom wrapper loading')).toBeTruthy();
    rerender(<Default />);
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });

  it('hides or renders the infinite sentinel and loading spinner', () => {
    const sentinelRef = { current: null };
    const { container, rerender } = render(
      <InfiniteScrollSentinel sentinelRef={sentinelRef} isLoading={false} hasMore={false} />
    );
    expect(container.firstChild).toBeNull();
    rerender(<InfiniteScrollSentinel sentinelRef={sentinelRef} isLoading={false} hasMore />);
    expect(container.querySelector('.animate-spin')).toBeNull();
    rerender(<InfiniteScrollSentinel sentinelRef={sentinelRef} isLoading hasMore />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders accessibility defaults and explicit overrides', () => {
    const { rerender } = render(
      <>
        <FocusRing>Focus child</FocusRing>
        <SkipToTimeline />
        <TimelineRegion>Timeline child</TimelineRegion>
      </>
    );
    expect(screen.getByText('Focus child').className).not.toContain('custom');
    expect(screen.getByRole('link').getAttribute('href')).toBe('#timeline-content');
    expect(screen.getByRole('main').getAttribute('aria-label')).toBe(
      'generated.inline.0172_timeline_content_f22c74a4'
    );

    rerender(
      <>
        <FocusRing className="custom">Focus child</FocusRing>
        <TimelineRegion label="Custom timeline" className="region">
          Timeline child
        </TimelineRegion>
      </>
    );
    expect(screen.getByText('Focus child').className).toContain('custom');
    expect(screen.getByRole('main').getAttribute('aria-label')).toBe('Custom timeline');
  });
});

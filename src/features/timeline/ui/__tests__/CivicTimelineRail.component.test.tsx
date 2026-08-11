/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProps: undefined as Record<string, any> | undefined,
  mappedItem: undefined as any,
  pageArgs: [] as any[],
  singleArgs: [] as any[],
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (name: string) => name,
  getContentTypeToneClasses: () => ({ text: 'type-text', border: 'type-border' }),
  getEntityGradientClasses: () => 'type-gradient',
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: any) => (values?.tag ? `${key}:${values.tag}` : key),
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild }: any) =>
    asChild ? children : <button type="button">{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: Record<string, any>) => {
    mocks.listProps = props;
    return <div>Virtual list</div>;
  },
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    common: {
      timelineFeedPage: (args: any) => {
        mocks.pageArgs.push(args);
        return { page: args };
      },
      timelineFeedById: (args: any) => {
        mocks.singleArgs.push(args);
        return { single: args };
      },
    },
  },
}));
vi.mock('../../hooks/useCivicTimeline', () => ({
  mapTimelineEvent: () => mocks.mappedItem,
}));

import { Radio } from 'lucide-react';
import {
  CivicTimelineRail,
  formatDateTime,
  getItemTime,
  getReasonLabel,
  getTypeIcon,
} from '../CivicTimelineRail';
import { CONTENT_TYPE_CONFIG } from '../../constants/content-type-config';

const base = {
  id: 'item-1',
  type: 'event',
  title: 'Assembly',
  href: '/event/event-1',
  timestamp: new Date('2026-08-09T10:00:00Z'),
  reason: 'subscribed',
  isDiscover: false,
} as any;

function section(items: any[]) {
  return [{ id: 'today', labelKey: 'section.today', items }] as any;
}

beforeEach(() => {
  mocks.listProps = undefined;
  mocks.mappedItem = undefined;
  mocks.pageArgs = [];
  mocks.singleArgs = [];
});
afterEach(cleanup);

describe('CivicTimelineRail helpers', () => {
  it('formats time, selects start dates, and falls back for unknown icons', () => {
    const startDate = new Date('2026-08-10T10:00:00Z');
    expect(formatDateTime(startDate)).toEqual(expect.any(String));
    expect(getItemTime({ ...base, startDate })).toBe(startDate);
    expect(getItemTime(base)).toBe(base.timestamp);
    expect(getTypeIcon(base)).toBe(CONTENT_TYPE_CONFIG.event.icon);
    expect(getTypeIcon({ ...base, type: 'unknown' })).toBe(Radio);
  });

  it('formats tagged, untagged, and ordinary reason labels', () => {
    const t = (key: string, values?: any) => (values?.tag ? `${key}:${values.tag}` : key);
    expect(getReasonLabel({ ...base, reason: 'interest_match', reasonTags: ['climate'] }, t)).toBe(
      'features.timeline.around.reasons.interestMatchTag:climate'
    );
    expect(getReasonLabel({ ...base, reason: 'interest_match', reasonTags: [] }, t)).toBe(
      'features.timeline.around.reasons.interestMatch'
    );
    expect(getReasonLabel(base, t)).toBe('features.timeline.around.reasons.subscribed');
  });
});

describe('CivicTimelineRail', () => {
  it('renders loading and empty non-virtual states', () => {
    const { rerender } = render(<CivicTimelineRail sections={[]} isLoading />);
    expect(screen.getAllByTestId('skeleton')).toHaveLength(25);
    rerender(<CivicTimelineRail sections={[]} isLoading={false} />);
    expect(screen.getByText('features.timeline.empty.title')).toBeTruthy();
  });

  it('renders all article variants and dispatches interactions', () => {
    const onActiveItemChange = vi.fn();
    const onItemSelect = vi.fn();
    const urgent = {
      ...base,
      id: 'urgent',
      title: 'Urgent vote',
      href: '/vote/urgent',
      reason: 'urgent_decision',
      startDate: new Date('2026-08-09T11:00:00Z'),
      distanceKm: 1.2,
      sourceName: 'Council',
      sourceHref: '/group/council',
      locationLabel: 'Berlin',
      description: 'Vote now',
      status: 'in_progress',
      statsLabel: '7 votes',
      tags: ['one', 'two', 'three', 'four'],
      primaryActionLabel: 'Open vote',
    };
    const discover = {
      ...base,
      id: 'discover',
      title: 'Discover group',
      type: 'group',
      href: '/group/discover',
      reason: 'public_discovery',
      isDiscover: true,
      sourceName: 'Network',
      sourceHref: undefined,
    };
    const interest = {
      ...base,
      id: 'interest',
      title: 'Climate note',
      reason: 'interest_match',
      reasonTags: ['climate'],
      locationLabel: 'Hamburg',
    };
    const lean = {
      ...base,
      id: 'lean',
      title: 'Lean item',
      type: 'unknown',
      reason: 'active_now',
      tags: undefined,
    };
    const { container } = render(
      <CivicTimelineRail
        sections={section([urgent, discover, interest, lean])}
        activeItemId="urgent"
        isLoading
        onActiveItemChange={onActiveItemChange}
        onItemSelect={onItemSelect}
      />
    );
    const article = container.querySelector('[data-timeline-item-id="urgent"]')!;
    fireEvent.mouseEnter(article);
    fireEvent.mouseLeave(article);
    fireEvent.focus(article);
    fireEvent.click(article);
    fireEvent.click(screen.getByRole('link', { name: 'Urgent vote' }));
    expect(onActiveItemChange).toHaveBeenNthCalledWith(1, 'urgent');
    expect(onActiveItemChange).toHaveBeenNthCalledWith(2, null);
    expect(onActiveItemChange).toHaveBeenCalledTimes(5);
    expect(onItemSelect).toHaveBeenCalledWith(urgent);
    expect(screen.getByText('in progress')).toBeTruthy();
    expect(screen.getByText('#three')).toBeTruthy();
    expect(screen.queryByText('#four')).toBeNull();
    expect(screen.getByRole('link', { name: 'Network' }).getAttribute('href')).toBe(
      '/group/discover'
    );
    expect(screen.getByRole('link', { name: 'Open vote' })).toBeTruthy();

    cleanup();
    const leanView = render(<CivicTimelineRail sections={section([lean])} />);
    const leanArticle = leanView.container.querySelector('[data-timeline-item-id="lean"]')!;
    expect(() => {
      fireEvent.mouseEnter(leanArticle);
      fireEvent.mouseLeave(leanArticle);
      fireEvent.focus(leanArticle);
      fireEvent.click(leanArticle);
      fireEvent.click(screen.getByRole('link', { name: 'Lean item' }));
    }).not.toThrow();
  });

  it('projects virtual queries, cursors, permalink ids, rows, skeletons, and empty states', () => {
    const viewProps = {
      sections: [],
      activeItemId: 'timeline-event:event-1',
      isLoading: true,
      queryContext: { contentTypes: ['event'] },
    };
    const { rerender } = render(<CivicTimelineRail {...(viewProps as any)} />);
    expect(mocks.listProps?.context.entityIds).toEqual([]);
    expect(mocks.listProps?.permalinkID).toBe('event-1');
    expect(mocks.listProps?.getRowKey({ id: 'row-1' })).toBe('row-1');
    expect(mocks.listProps?.toStartRow({ id: 'row-1', created_at: 10 })).toEqual({
      id: 'row-1',
      created_at: 10,
    });
    expect(
      mocks.listProps?.getPageQuery({ limit: 20, start: null, dir: 'forward', settled: true })
        .options.ttl
    ).toBe('5m');
    expect(
      mocks.listProps?.getPageQuery({ limit: 20, start: null, dir: 'forward', settled: false })
        .options.ttl
    ).toBe('none');
    expect(mocks.listProps?.getSingleQuery({ id: 'row-1', settled: true }).options.ttl).toBe('5m');
    expect(mocks.listProps?.getSingleQuery({ id: 'row-1', settled: false }).options.ttl).toBe(
      'none'
    );
    expect(mocks.listProps?.renderSkeleton(1).props.className).toContain('h-44');
    render(mocks.listProps?.renderEmpty());
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    mocks.mappedItem = base;
    expect(mocks.listProps?.renderRow({ id: 'row-1' }, 2)).toBeTruthy();
    mocks.mappedItem = null;
    expect(mocks.listProps?.renderRow({ id: 'row-2' }, 3)).toBeNull();

    rerender(
      <CivicTimelineRail
        sections={[]}
        activeItemId="other"
        isLoading={false}
        queryContext={{ entityIds: ['entity-1'], contentTypes: ['blog'] }}
      />
    );
    expect(mocks.listProps?.context.entityIds).toEqual(['entity-1']);
    expect(mocks.listProps?.permalinkID).toBeUndefined();
    render(mocks.listProps?.renderEmpty());
    expect(screen.getByText('features.timeline.around.empty')).toBeTruthy();

    rerender(
      <CivicTimelineRail
        sections={[]}
        activeItemId={undefined}
        queryContext={{ contentTypes: [] }}
      />
    );
    expect(mocks.listProps?.permalinkID).toBeUndefined();
  });
});

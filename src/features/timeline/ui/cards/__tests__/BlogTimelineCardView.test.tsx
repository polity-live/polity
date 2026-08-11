/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
  hashtagProps: undefined as Record<string, any> | undefined,
  progressProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  getEntityGradientClasses: () => 'fallback-gradient',
  getEntityToneClasses: () => ({ text: 'blog-text' }),
  getHashtagToneClasses: () => ({ badge: 'hashtag-badge' }),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: (props: any) => <img {...props} />,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/progress', () => ({
  Progress: (props: Record<string, any>) => {
    mocks.progressProps = props;
    return <div>Progress</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, loading: _loading, loadingLabel: _loadingLabel, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: (props: Record<string, any>) => {
    mocks.hashtagProps = props;
    return <div>Hashtags</div>;
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { BlogTimelineCardView, formatReadingTime } from '../BlogTimelineCardView';

const Icon = () => <span>Stat</span>;
function props(overrides: Record<string, any> = {}) {
  return {
    blog: { id: 'blog-1', title: 'Policy note' },
    className: undefined,
    t: (key: string, values?: any) => (values ? `${key}:${values.count}` : key),
    gradient: undefined,
    subscription: { isSubscribed: false, isLoading: false, toggleSubscribe: vi.fn() },
    blogUrl: '/blog/blog-1',
    stats: [],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
  mocks.hashtagProps = undefined;
  mocks.progressProps = undefined;
});
afterEach(cleanup);

describe('BlogTimelineCardView', () => {
  it('formats both reading-time labels', () => {
    const t = (key: string, values?: any) => (values ? `${key}:${values.count}` : key);
    expect(formatReadingTime(0.5, t)).toBe('features.timeline.readingTime.underMinute');
    expect(formatReadingTime(4, t)).toBe('features.timeline.readingTime.minutes:4');
  });

  it('renders the gradient fallback and empty optional metadata', () => {
    const viewProps = props();
    const { container } = render(<BlogTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(
      container.querySelector('[data-action-id="timeline.blog.subscription.toggle"]')!
    );
    expect(viewProps.subscription.toggleSubscribe).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-timeline-card-header]')?.className).toContain(
      'fallback-gradient'
    );
    expect(mocks.shareProps?.description).toBe('');
    expect(mocks.shareProps?.shareContextItem.groupId).toBeUndefined();
    expect(mocks.shareProps?.shareContextItem.tags).toEqual([]);
    expect(mocks.shareProps?.shareContextItem.createdAt).toEqual(expect.any(Date));
  });

  it('renders cover, rich metadata, stats, progress, and explicit gradient', () => {
    const hashtags = Array.from({ length: 4 }, (_, index) => ({
      id: `${index}`,
      tag: `tag-${index}`,
    }));
    const viewProps = props({
      blog: {
        id: 'blog-1',
        title: 'Policy note',
        coverImageUrl: '/cover.jpg',
        excerpt: 'Summary',
        readingTimeMinutes: 4,
        readProgress: 42,
        authorName: 'Ada',
        authorAvatar: '/ada.jpg',
        authorId: 'user-1',
        groupId: 'group-1',
        publishedAt: '2026-08-09T10:00:00Z',
        commentCount: 3,
        hashtags,
      },
      gradient: 'explicit-gradient',
      subscription: { isSubscribed: true, isLoading: true, toggleSubscribe: vi.fn() },
      stats: [{ icon: Icon, value: 7, label: 'readers' }],
    });
    const { container } = render(<BlogTimelineCardView {...(viewProps as any)} />);
    expect(container.querySelector('[data-timeline-card-media]')).toBeTruthy();
    expect(container.textContent).toContain('Summary');
    expect(container.textContent).toContain('features.timeline.readingTime.minutes:4');
    expect(mocks.progressProps?.value).toBe(42);
    expect(mocks.hashtagProps?.hashtags).toEqual(hashtags.slice(0, 3));
    expect(mocks.shareProps?.shareContextItem.groupId).toBe('group-1');
    expect(mocks.shareProps?.shareContextItem.tags).toEqual(hashtags.map(item => item.tag));
    expect(mocks.shareProps?.shareContextItem.createdAt).toEqual(new Date('2026-08-09T10:00:00Z'));
  });

  it('renders the under-minute label and omits zero progress', () => {
    const { container } = render(
      <BlogTimelineCardView
        {...(props({
          blog: { id: 'blog-1', title: 'Short', readingTimeMinutes: 0.5, readProgress: 0 },
        }) as any)}
      />
    );
    expect(container.textContent).toContain('features.timeline.readingTime.underMinute');
    expect(mocks.progressProps).toBeUndefined();
  });
});

/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  subscription: {} as Record<string, unknown>,
  viewProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: unknown) => (values ? `${key}:${JSON.stringify(values)}` : key),
  }),
}));
vi.mock('@/features/blogs/hooks/useSubscribeBlog', () => ({
  useSubscribeBlog: () => mocks.subscription,
}));
vi.mock('../../../constants/content-type-config', () => ({
  getContentTypeGradient: () => 'blog-gradient',
}));
vi.mock('../BlogTimelineCardView', () => ({
  BlogTimelineCardView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return <div />;
  },
}));

import { BlogTimelineCard, type BlogTimelineCardProps } from '../BlogTimelineCard';

const blog: BlogTimelineCardProps['blog'] = { id: 'blog-1', title: 'Article' };

function renderBlog(overrides: Partial<BlogTimelineCardProps['blog']> = {}, props = {}) {
  render(<BlogTimelineCard blog={{ ...blog, ...overrides }} {...props} />);
  return mocks.viewProps!;
}

beforeEach(() => {
  mocks.subscription = { subscriberCount: undefined };
  mocks.viewProps = undefined;
});

afterEach(cleanup);

describe('BlogTimelineCard controller', () => {
  it('uses the standalone route and zero subscriber defaults', () => {
    const props = renderBlog();
    expect(props.blogUrl).toBe('/blog/blog-1');
    expect(props.gradient).toBe('blog-gradient');
    expect(props.stats).toHaveLength(1);
    expect(props.stats[0]).toMatchObject({
      value: 0,
      label: 'features.timeline.cards.subscribers:{"count":0}',
    });
  });

  it('prioritizes explicit, group, and author blog destinations', () => {
    expect(
      renderBlog({ groupId: 'group-1', authorId: 'user-1' }, { href: '/custom' }).blogUrl
    ).toBe('/custom');
    cleanup();
    expect(renderBlog({ groupId: 'group-1', authorId: 'user-1' }).blogUrl).toBe(
      '/group/group-1/blog/blog-1'
    );
    cleanup();
    expect(renderBlog({ groupId: null, authorId: 'user-1' }).blogUrl).toBe(
      '/user/user-1/blog/blog-1'
    );
  });

  it('uses subscriber data and includes present comment counts including zero', () => {
    mocks.subscription = { subscriberCount: 7 };
    let props = renderBlog({ commentCount: 0 });
    expect(props.stats.map((stat: any) => stat.value)).toEqual([7, 0]);
    expect(props.stats[1].label).toBe('features.timeline.cards.comments:{"count":0}');

    cleanup();
    props = renderBlog({ commentCount: 3 });
    expect(props.stats.map((stat: any) => stat.value)).toEqual([7, 3]);
  });

  it('forwards class and projected subscription state', () => {
    const projectedSubscriptionState = { isSubscribed: true } as any;
    const props = renderBlog({}, { className: 'custom', projectedSubscriptionState });
    expect(props.className).toBe('custom');
    expect(props.subscription).toBe(mocks.subscription);
  });
});

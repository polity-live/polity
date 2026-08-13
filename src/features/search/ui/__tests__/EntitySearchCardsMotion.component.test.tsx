/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ className }: { className?: string }) => (
    <div data-testid="group-card" data-card-class={className ?? ''} />
  ),
}));

vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: ({ className }: { className?: string }) => (
    <div data-testid="event-card" data-card-class={className ?? ''} />
  ),
}));

vi.mock('@/features/timeline/ui/cards/UserTimelineCard', () => ({
  UserTimelineCard: ({ className }: { className?: string }) => (
    <div data-testid="user-card" data-card-class={className ?? ''} />
  ),
}));

vi.mock('@/features/timeline/ui/cards/AmendmentTimelineCard', () => ({
  AmendmentTimelineCard: ({ className }: { className?: string }) => (
    <div data-testid="amendment-card" data-card-class={className ?? ''} />
  ),
}));

vi.mock('@/features/users/ui/BlogsCard', () => ({
  BlogsCard: () => <div data-testid="blog-card" />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: () => <div data-testid="hashtags" />,
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtags: () => [],
}));

import { AmendmentSearchCardView } from '../AmendmentSearchCardView';
import { BlogSearchCard } from '../BlogSearchCard';
import { EventSearchCard } from '../EventSearchCard';
import { GroupSearchCardView } from '../GroupSearchCardView';
import { UserSearchCard } from '../UserSearchCard';

const NO_SPOTLIGHT_CLASS = 'entity-search-card-no-spotlight';

afterEach(cleanup);

describe('entity search card motion', () => {
  it('marks group, event, user, and amendment search cards as no-spotlight surfaces', () => {
    render(
      <>
        <GroupSearchCardView group={{ id: 'group-1', name: 'Group One' }} />
        <EventSearchCard event={{ id: 'event-1', title: 'Event One' } as never} />
        <UserSearchCard user={{ id: 'user-1', first_name: 'Ari' }} />
        <AmendmentSearchCardView
          amendment={{ id: 'amendment-1', title: 'Amendment One', status: 'view' }}
        />
      </>
    );

    expect(screen.getByTestId('group-card').getAttribute('data-card-class')).toContain(
      NO_SPOTLIGHT_CLASS
    );
    expect(screen.getByTestId('event-card').getAttribute('data-card-class')).toContain(
      NO_SPOTLIGHT_CLASS
    );
    expect(screen.getByTestId('user-card').getAttribute('data-card-class')).toContain(
      NO_SPOTLIGHT_CLASS
    );
    expect(screen.getByTestId('amendment-card').getAttribute('data-card-class')).toContain(
      NO_SPOTLIGHT_CLASS
    );
  });

  it('preserves custom event search card classes while adding the no-spotlight marker', () => {
    render(
      <EventSearchCard
        className="custom-event-card"
        event={{ id: 'event-1', title: 'Event One' } as never}
      />
    );

    const className = screen.getByTestId('event-card').getAttribute('data-card-class');

    expect(className).toContain(NO_SPOTLIGHT_CLASS);
    expect(className).toContain('custom-event-card');
  });

  it('marks blog search cards as no-spotlight containers for future nested card motion', () => {
    const { container } = render(
      <BlogSearchCard
        blog={
          {
            id: 'blog-1',
            title: 'Blog One',
            created_at: Date.now(),
            upvotes: 0,
            downvotes: 0,
            comment_count: 0,
            blog_hashtags: [],
            bloggers: [],
          } as never
        }
      />
    );

    expect(container.firstElementChild?.className).toContain(NO_SPOTLIGHT_CLASS);
  });
});

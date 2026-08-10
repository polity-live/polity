/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: (rows: any) =>
    rows?.map((row: any) => row.hashtag?.tag).filter(Boolean) ?? [],
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { GroupBlogCard } from '../GroupBlogCard';

afterEach(cleanup);

describe('GroupBlogCard', () => {
  it('renders populated metadata and prefers the owner full name', () => {
    const { container } = render(
      <GroupBlogCard
        groupId="g"
        className="custom"
        blog={{
          id: 'b',
          title: 'Title',
          description: 'Description',
          date: '2026-01-01',
          upvotes: 5,
          downvotes: 2,
          commentCount: 4,
          blog_hashtags: [{ hashtag: { tag: 'news' } }],
          bloggers: [
            { status: 'writer', user: { handle: 'writer' } },
            { status: 'owner', user: { first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' } },
          ],
        }}
      />
    );
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('#news')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(container.querySelector('a')?.className).toContain('custom');
  });

  it('falls back to the first author handle and default numeric metadata', () => {
    render(
      <GroupBlogCard
        groupId="g"
        blog={{
          id: 'b',
          title: null,
          upvotes: null as any,
          downvotes: null as any,
          commentCount: undefined,
          bloggers: [{ user: { first_name: '', last_name: '', handle: 'fallback' } }],
        }}
      />
    );
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(document.body.textContent).toContain('untitled');
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('omits optional sections and supports an author without a usable name', () => {
    const { rerender } = render(<GroupBlogCard groupId="g" blog={{ id: 'b', title: 'Bare' }} />);
    expect(screen.queryByText('#news')).toBeNull();
    rerender(
      <GroupBlogCard
        groupId="g"
        blog={{ id: 'b', title: 'Anonymous', bloggers: [{ user: { first_name: '', handle: '' } }] }}
      />
    );
    expect(screen.getByText('Anonymous')).toBeTruthy();
  });
});

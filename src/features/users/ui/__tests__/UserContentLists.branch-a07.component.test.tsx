/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentRows: [] as any[],
  blogRows: [] as any[],
  amendmentCards: [] as any[],
  blogCards: [] as any[],
  pageByUser: vi.fn((args: unknown) => ({ kind: 'blog-page', args })),
  blogById: vi.fn((args: unknown) => ({ kind: 'blog-single', args })),
  collaborationPageByUser: vi.fn((args: unknown) => ({ kind: 'amendment-page', args })),
  collaboratorById: vi.fn((args: unknown) => ({ kind: 'amendment-single', args })),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
}));
vi.mock('@/features/timeline/ui/cards/AmendmentTimelineCard', () => ({
  AmendmentTimelineCard: ({ amendment }: any) => {
    mocks.amendmentCards.push(amendment);
    return <div data-testid="amendment-card">{JSON.stringify(amendment)}</div>;
  },
}));
vi.mock('@/features/timeline/ui/cards/BlogTimelineCard', () => ({
  BlogTimelineCard: ({ blog }: any) => {
    mocks.blogCards.push(blog);
    return <div data-testid="blog-card">{JSON.stringify(blog)}</div>;
  },
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: {
      collaborationPageByUser: mocks.collaborationPageByUser,
      collaboratorById: mocks.collaboratorById,
    },
    blogs: { pageByUser: mocks.pageByUser, byIdWithHashtags: mocks.blogById },
  },
}));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: any) => {
    const rows = props.historyKey.includes('amendments') ? mocks.amendmentRows : mocks.blogRows;
    props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false });
    props.getPageQuery({
      limit: 10,
      start: { created_at: 1, id: 'start' },
      dir: 'backward',
      settled: true,
    });
    props.getSingleQuery({ id: 'single', settled: false });
    props.getSingleQuery({ id: 'single', settled: true });
    for (const width of [500, 800, 1200]) props.getLanes(width);
    return (
      <div>
        {rows.map((row: any, index: number) => (
          <div key={`row-${index}`}>
            {String(props.getRowKey(row))}
            {JSON.stringify(props.toStartRow(row))}
            {props.renderRow(row, index === rows.length - 1 ? 20 : index)}
          </div>
        ))}
        {props.renderSkeleton()}
        {props.renderEmpty()}
      </div>
    );
  },
}));

import { AmendmentListTab } from '../AmendmentListTab';
import { BlogListTab } from '../BlogListTab';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.amendmentCards.length = 0;
  mocks.blogCards.length = 0;
  mocks.amendmentRows = [
    { id: 'missing', created_at: 1, amendment: null },
    {
      id: 'hashtags',
      created_at: 2,
      amendment: {
        id: 42,
        title: 'Amendment',
        reason: 'Reason',
        amendment_hashtags: [{ hashtag: { tag: 'one' } }, { hashtag: null }],
        tags: ['ignored'],
        current_process_run: { branches: [{ id: 'branch-1', editing_mode: 'internal_editing' }] },
        group: { id: 'group-1', name: 'Group' },
      },
    },
    {
      id: 'raw-tags',
      created_at: 3,
      amendment: {
        id: 'raw',
        title: null,
        reason: null,
        amendment_hashtags: [],
        tags: ['raw', 4, null],
        current_process_run: null,
        group: null,
      },
    },
    {
      id: 'no-tags',
      created_at: 4,
      amendment: {
        id: 'none',
        amendment_hashtags: null,
        tags: 'not-an-array',
      },
    },
  ];
  mocks.blogRows = [
    {
      id: 'full',
      created_at: 1,
      title: 'Blog',
      description: 'Description',
      image_url: 'cover.png',
      comment_count: 4,
      group_id: 'group-1',
      date: '2026-01-01',
      blog_hashtags: [{ hashtag: { id: 'tag-1', tag: 'tag' } }, { hashtag: null }],
    },
    {
      id: 2,
      created_at: 2,
      title: null,
      description: null,
      image_url: null,
      comment_count: null,
      group_id: null,
      date: null,
      blog_hashtags: null,
    },
  ];
});

afterEach(cleanup);

describe('profile content list branch contracts', () => {
  it('executes all amendment grid contracts and mapping fallbacks', () => {
    const onSearchChange = vi.fn();
    render(
      <AmendmentListTab userId="user-1" searchValue="  climate  " onSearchChange={onSearchChange} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });

    expect(onSearchChange).toHaveBeenCalledWith('new');
    expect(mocks.collaborationPageByUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', query: 'climate' })
    );
    expect(mocks.amendmentCards).toHaveLength(3);
    expect(mocks.amendmentCards[0].hashtags).toEqual([expect.objectContaining({ tag: 'one' })]);
    expect(mocks.amendmentCards[1]).toEqual(
      expect.objectContaining({ title: '', subtitle: undefined, groupName: undefined })
    );
    expect(screen.getByText(/No amendments found/)).toBeTruthy();
  });

  it('executes all blog grid contracts and card fallbacks', () => {
    const onSearchChange = vi.fn();
    render(
      <BlogListTab
        authorName=""
        authorAvatar="avatar.png"
        userId="user-1"
        searchValue="  notes "
        onSearchChange={onSearchChange}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'other' } });

    expect(onSearchChange).toHaveBeenCalledWith('other');
    expect(mocks.pageByUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', query: 'notes' })
    );
    expect(mocks.blogCards).toHaveLength(2);
    expect(mocks.blogCards[0]).toEqual(
      expect.objectContaining({ title: 'Blog', commentCount: 4, groupId: 'group-1' })
    );
    expect(mocks.blogCards[1]).toEqual(
      expect.objectContaining({
        title: '',
        excerpt: undefined,
        coverImageUrl: undefined,
        commentCount: 0,
        groupId: undefined,
        publishedAt: '',
      })
    );
    expect(screen.getByText(/No blogs found/)).toBeTruthy();
  });
});

/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BlogsAndStatementsView } from '../BlogsAndStatementsView';

const mocks = vi.hoisted(() => ({
  grids: [] as any[],
  blogCards: [] as any[],
  statementCards: [] as any[],
  blogPage: vi.fn((args: unknown) => ({ kind: 'blog-page', args })),
  blogById: vi.fn((args: unknown) => ({ kind: 'blog-by-id', args })),
  statementPage: vi.fn((args: unknown) => ({ kind: 'statement-page', args })),
  statementById: vi.fn((args: unknown) => ({ kind: 'statement-by-id', args })),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search, to, ...props }: any) => (
    <a href={`${to}${search ? `?${new URLSearchParams(search).toString()}` : ''}`} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterButton: ({ active, children, ...props }: any) => (
    <button aria-pressed={active} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/timeline/ui/cards/BlogTimelineCard', () => ({
  BlogTimelineCard: ({ blog }: any) => {
    mocks.blogCards.push(blog);
    return <article>blog:{blog.title}</article>;
  },
}));

vi.mock('@/features/timeline/ui/cards/StatementTimelineCard', () => ({
  StatementTimelineCard: ({ statement }: any) => {
    mocks.statementCards.push(statement);
    return <article>statement:{statement.content}</article>;
  },
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: any) => {
    mocks.grids.push(props);
    const row = props.historyKey.endsWith('-blogs')
      ? {
          id: 'blog-1',
          created_at: 10,
          title: 'Budget',
          description: 'Description',
          blog_hashtags: [{ hashtag: { id: 'tag-1', tag: 'budget' } }, { hashtag: null }],
        }
      : {
          id: 'statement-1',
          created_at: 20,
          text: 'Council statement',
          user: { first_name: 'Ada', last_name: 'Lovelace' },
          statement_hashtags: [],
        };
    return <div data-testid={props.historyKey}>{props.renderRow(row)}</div>;
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    blogs: { pageByGroup: mocks.blogPage, byIdWithHashtags: mocks.blogById },
    statements: { pageByGroup: mocks.statementPage, byIdWithDetails: mocks.statementById },
  },
}));

const baseProps = {
  groupId: 'group-1',
  blogs: [{ id: 'blog-1', created_at: 10 }],
  statements: [{ id: 'statement-1', created_at: 20 }],
  filter: 'all' as const,
  setFilter: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  canManage: true,
  canCreateBlog: true,
  canCreateStatement: true,
  getEditorUrl: (id: string) => `/editor/${id}`,
  onDeleteBlog: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.grids.length = 0;
  mocks.blogCards.length = 0;
  mocks.statementCards.length = 0;
});

afterEach(() => cleanup());

describe('BlogsAndStatementsView', () => {
  it('supports search, filter selection, keyboard focus, and permission-scoped creation deep links', () => {
    render(<BlogsAndStatementsView {...baseProps} />);

    const search = screen.getByPlaceholderText('generated.inline.0299_search_6d7a30a9');
    fireEvent.change(search, { target: { value: 'climate' } });
    expect(baseProps.setSearchQuery).toHaveBeenCalledWith('climate');

    const statementsFilter = screen.getByRole('button', { name: 'features.statements.title' });
    statementsFilter.focus();
    expect(document.activeElement).toBe(statementsFilter);
    fireEvent.keyDown(statementsFilter, { key: 'Enter' });
    fireEvent.click(statementsFilter);
    expect(baseProps.setFilter).toHaveBeenCalledWith('statements');

    expect(
      screen.getByRole('link', { name: 'generated.inline.0297_blog_0b9d2b23' }).getAttribute('href')
    ).toBe('/create/blog-entry?groupId=group-1');
    expect(
      screen
        .getByRole('link', { name: 'generated.inline.0298_statement_a72ca256' })
        .getAttribute('href')
    ).toBe('/create/statement?groupId=group-1');
  });

  it('maps virtual rows and queries while preserving edit and delete handler effects', () => {
    render(<BlogsAndStatementsView {...baseProps} searchQuery=" budget " />);

    const edit = document.querySelector<HTMLAnchorElement>(
      'a[data-action-id="content.blogs-and-statements.blog.edit"]'
    );
    expect(edit).toBeTruthy();
    expect(edit!.getAttribute('href')).toBe('/editor/blog-1');
    const deleteButton = screen
      .getAllByRole('button')
      .find(button => button.getAttribute('data-action-id')?.endsWith('blog.delete'));
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton!);
    expect(baseProps.onDeleteBlog).toHaveBeenCalledWith('blog-1', 'Budget');
    expect(screen.getByText('blog:Budget')).toBeTruthy();
    expect(screen.getByText('statement:Council statement')).toBeTruthy();

    const blogGrid = mocks.grids.find(grid => grid.historyKey.endsWith('-blogs'));
    expect(blogGrid.getLanes(639)).toBe(1);
    expect(blogGrid.getLanes(640)).toBe(2);
    expect(blogGrid.toStartRow({ id: 'blog-2', created_at: 30 })).toEqual({
      id: 'blog-2',
      created_at: 30,
    });
    expect(
      blogGrid.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: false })
    ).toMatchObject({
      options: { ttl: 'none' },
    });
    expect(mocks.blogPage).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'group-1', query: 'budget', limit: 5 })
    );
    expect(blogGrid.getSingleQuery({ id: 'blog-2', settled: true })).toMatchObject({
      options: { ttl: '5m' },
    });
    expect(mocks.blogById).toHaveBeenCalledWith({ id: 'blog-2' });
  });

  it('renders empty and restricted states without leaking management or creation actions', () => {
    const { rerender } = render(
      <BlogsAndStatementsView
        {...baseProps}
        blogs={[]}
        statements={[]}
        canManage={false}
        canCreateBlog={false}
        canCreateStatement={false}
      />
    );

    expect(screen.getByText('generated.inline.0301_no_content_yet_f4efebd0')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();

    rerender(
      <BlogsAndStatementsView
        {...baseProps}
        filter="blogs"
        statements={[]}
        canManage={false}
        canCreateBlog={false}
        canCreateStatement={false}
      />
    );
    expect(screen.getByText('blog:Budget')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'generated.inline.0298_statement_a72ca256' })
    ).toBeNull();
  });

  it('renders each creation permission independently', () => {
    const view = render(
      <BlogsAndStatementsView {...baseProps} canCreateBlog={false} canCreateStatement />
    );
    expect(screen.queryByRole('link', { name: 'generated.inline.0297_blog_0b9d2b23' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'generated.inline.0298_statement_a72ca256' })
    ).toBeTruthy();

    view.rerender(
      <BlogsAndStatementsView {...baseProps} canCreateBlog canCreateStatement={false} />
    );
    expect(screen.getByRole('link', { name: 'generated.inline.0297_blog_0b9d2b23' })).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'generated.inline.0298_statement_a72ca256' })
    ).toBeNull();
  });

  it('covers all virtual query modes, callbacks, and optional row fields', () => {
    const view = render(<BlogsAndStatementsView {...baseProps} />);
    const blogGrid = mocks.grids.find(grid => grid.historyKey.endsWith('-blogs'));
    const statementGrid = mocks.grids.find(grid => grid.historyKey.endsWith('-statements'));

    expect(blogGrid.getRowKey({ id: 'blog-key' })).toBe('blog-key');
    expect(blogGrid.getPageQuery({ limit: 1, start: null, dir: 'forward', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(blogGrid.getSingleQuery({ id: 'blog-key', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(blogGrid.renderEmpty()).toBeNull();
    expect(blogGrid.renderSkeleton()).toBeTruthy();

    const optionalBlog = render(
      blogGrid.renderRow({
        blog_hashtags: undefined,
        comment_count: 4,
        created_at: 1,
        date: '2030-01-01',
        description: null,
        group_id: 'group-1',
        id: 'blog-optional',
        image_url: 'cover.png',
        title: null,
        user_id: 'user-1',
      })
    );
    fireEvent.click(
      optionalBlog.container.querySelector<HTMLButtonElement>(
        '[data-action-id="content.blogs-and-statements.blog.delete"]'
      )!
    );
    expect(baseProps.onDeleteBlog).toHaveBeenCalledWith('blog-optional', '');
    expect(mocks.blogCards.at(-1)).toMatchObject({
      authorId: 'user-1',
      commentCount: 4,
      coverImageUrl: 'cover.png',
      excerpt: undefined,
      hashtags: [],
      publishedAt: '2030-01-01',
      title: '',
    });

    expect(statementGrid.getLanes(639)).toBe(1);
    expect(statementGrid.getLanes(640)).toBe(2);
    expect(statementGrid.getRowKey({ id: 'statement-key' })).toBe('statement-key');
    expect(statementGrid.toStartRow({ id: 'statement-key', created_at: 2 })).toEqual({
      id: 'statement-key',
      created_at: 2,
    });
    expect(
      statementGrid.getPageQuery({ limit: 2, start: null, dir: 'backward', settled: false })
    ).toEqual(expect.objectContaining({ options: { ttl: 'none' } }));
    expect(
      statementGrid.getPageQuery({ limit: 2, start: null, dir: 'forward', settled: true })
    ).toEqual(expect.objectContaining({ options: { ttl: '5m' } }));
    expect(statementGrid.getSingleQuery({ id: 'statement-key', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(statementGrid.getSingleQuery({ id: 'statement-key', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(statementGrid.renderEmpty()).toBeNull();
    expect(statementGrid.renderSkeleton()).toBeTruthy();

    const statementBase = { created_at: 2, id: 'statement-optional' };
    const statementVariant = render(
      statementGrid.renderRow({
        ...statementBase,
        comment_count: 3,
        downvotes: 2,
        group_id: 'group-1',
        image_url: 'image.png',
        statement_hashtags: [{ hashtag: { id: 'tag-1', tag: 'civic' } }, { hashtag: null }],
        text: null,
        upvotes: 5,
        user: { avatar: 'avatar.png', first_name: null, handle: 'ada', last_name: null },
        video_url: 'video.mp4',
      })
    );
    expect(mocks.statementCards.at(-1)).toMatchObject({
      authorAvatar: 'avatar.png',
      authorName: 'ada',
      commentCount: 3,
      content: '',
      hashtags: [{ id: 'tag-1', tag: 'civic' }],
      opposeCount: 2,
      supportCount: 5,
    });
    statementVariant.rerender(
      statementGrid.renderRow({
        ...statementBase,
        id: 'statement-empty-user',
        statement_hashtags: undefined,
        user: { first_name: null, handle: null, last_name: null },
      })
    );
    expect(mocks.statementCards.at(-1).authorName).toBe('');
    statementVariant.rerender(
      statementGrid.renderRow({ ...statementBase, id: 'statement-no-user', user: null })
    );
    expect(mocks.statementCards.at(-1).authorName).toBe('');

    view.rerender(<BlogsAndStatementsView {...baseProps} filter="blogs" statements={[]} />);
    expect(mocks.grids.at(-1).viewportClassName).toBeUndefined();
    view.rerender(<BlogsAndStatementsView {...baseProps} filter="statements" blogs={[]} />);
    expect(mocks.grids.at(-1).viewportClassName).toBeUndefined();
  });
});

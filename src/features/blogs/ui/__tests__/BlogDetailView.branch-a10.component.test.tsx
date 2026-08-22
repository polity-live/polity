/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  virtualSource: undefined as
    | {
        getPageQuery: (args: Record<string, unknown>) => unknown;
        getSingleQuery: (args: Record<string, unknown>) => unknown;
        getRowKey: (row: { id: string }) => string;
        mapRow: (row: any) => any;
      }
    | undefined,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('lucide-react', () => ({
  BookOpen: () => <i data-icon="book" />,
  Calendar: () => <i data-icon="calendar" />,
  Edit: () => <i data-icon="edit" />,
  Trash2: () => <i data-icon="trash" />,
}));

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? `translated:${key}`,
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-state="loading" />,
}));

vi.mock('@/features/shared/ui/status', () => ({
  VisibilityBadge: ({ children, ...props }: { children: ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div data-state="denied" />,
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div data-action-bar>{children}</div>,
  StatsBar: ({ items }: { items: { value: number; label: string }[] }) => (
    <div data-stats={items.map(item => `${item.value}:${item.label}`).join('|')} />
  ),
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  SubscribeButton: ({ onToggleSubscribe }: { onToggleSubscribe: () => void }) => (
    <button type="button" onClick={onToggleSubscribe}>
      subscribe
    </button>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">share</button>,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ badgeClassName }: { badgeClassName?: string }) => (
    <div data-hashtags={badgeClassName ?? 'desktop'} />
  ),
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div data-avatar>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span data-fallback>{children}</span>,
  AvatarImage: ({ src }: { src?: string }) => <span data-avatar-src={src ?? 'none'} />,
}));

vi.mock('@/features/shared/ui/voting', () => ({
  VoteButtons: () => <div data-votes />,
}));

vi.mock('@/features/shared/ui/comments', () => ({
  CommentThread: () => <div data-comments />,
}));

vi.mock('@/features/shared/ui/rich-text', () => ({
  RichTextPreview: ({ content }: { content: unknown[] }) => <div data-rich-text={content.length} />,
}));

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: ({ alt }: { alt: string }) => <div data-media={alt} />,
  WikiParticipationDirectory: ({
    virtualSource,
  }: {
    virtualSource?: typeof state.virtualSource;
  }) => {
    state.virtualSource = virtualSource;
    return <div data-directory />;
  },
  getWikiParticipationName: (user?: { name?: string }) => user?.name ?? 'Unknown user',
  isVisibleWikiParticipationStatus: (status?: string) => status !== 'hidden',
  normalizeWikiParticipationRole: (role?: { id?: string; name?: string } | null) =>
    role?.id && role.name ? { id: role.id, name: role.name } : null,
}));

vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({
    asChild,
    children,
    onClick,
  }: {
    asChild?: boolean;
    children: ReactNode;
    onClick?: () => void;
  }) =>
    asChild ? (
      children
    ) : (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableAlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    blogs: {
      bloggerPage: (args: unknown) => ({ kind: 'page', args }),
      bloggerPageById: (args: unknown) => ({ kind: 'single', args }),
    },
  },
}));

import { BlogDetailView } from '../BlogDetailView';

const baseProps = (
  overrides: Partial<ComponentProps<typeof BlogDetailView>> = {}
): ComponentProps<typeof BlogDetailView> => ({
  author: { id: 'author', avatar: 'avatar.png', firstName: 'Ada', handle: 'ada', name: 'Ada' },
  blogId: 'blog',
  bloggers: [],
  canDelete: false,
  canEdit: false,
  commentCount: 3,
  comments: [],
  content: null,
  currentUserId: 'viewer',
  currentVoteValue: 0,
  date: 'today',
  deleteOpen: false,
  downvotes: 1,
  editorUrl: '/edit',
  hashtags: [{ id: 'tag', tag: 'policy' }],
  imageUrl: null,
  isLoaded: true,
  isSubscribed: false,
  onAddComment: vi.fn(),
  onCommentVote: vi.fn(),
  onConfirmDelete: vi.fn(),
  onDeleteOpenChange: vi.fn(),
  onSubscribeToggle: vi.fn(),
  onVote: vi.fn(),
  shareContextItem: {
    id: 'blog',
    type: 'blog',
    title: 'Blog',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    commentCount: 3,
  },
  subscriberCount: 2,
  subscribeLoading: false,
  supporterCount: 4,
  title: 'Blog',
  upvotes: 5,
  videoUrl: null,
  viewUrl: '/blog',
  ...overrides,
});

afterEach(cleanup);
beforeEach(() => {
  state.virtualSource = undefined;
});

describe('BlogDetailView branch contracts', () => {
  it.each([
    ['public', 'public'],
    ['authenticated', 'authenticated'],
    ['private', 'private'],
    [null, 'public'],
    ['unexpected', 'private'],
  ])('normalizes the %s visibility to one %s badge', (visibility, expected) => {
    const { container } = render(<BlogDetailView {...baseProps({ visibility })} />);

    const badges = container.querySelectorAll('[data-entity-visibility]');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.getAttribute('data-entity-visibility')).toBe(expected);
    expect(badges[0]?.textContent).toBe(`t:common.visibility.${expected}`);
  });

  it('renders loading and missing states in priority order', () => {
    const view = render(<BlogDetailView {...baseProps({ isLoaded: false, title: null })} />);
    expect(document.querySelector('[data-state="loading"]')).not.toBeNull();

    view.rerender(<BlogDetailView {...baseProps({ title: '' })} />);
    expect(screen.getByText('t:features.blogs.detail.notFound')).toBeDefined();
  });

  it('renders complete optional content, visible bloggers, editing, and deletion actions', async () => {
    const onDeleteOpenChange = vi.fn();
    const onConfirmDelete = vi.fn();
    render(
      <BlogDetailView
        {...baseProps({
          bloggers: [
            {
              id: 'owner-row',
              status: 'owner',
              role: null,
              user: {
                id: 'owner',
                name: 'Owner',
                handle: 'owner',
                email: 'owner@example.com',
                avatar: 'owner.png',
              },
            },
            {
              id: null,
              status: 'active',
              role: { id: 'editor', name: 'Editor' },
              user: { id: 'editor', name: 'Editor' },
            },
            { id: 'no-status', status: undefined, role: null, user: { id: 'no-status' } },
            {
              id: 'duplicate-role',
              status: 'active',
              role: { id: 'editor', name: 'Editor' },
              user: { id: 'duplicate' },
            },
            { id: 'hidden', status: 'hidden', user: { id: 'hidden' } },
            { id: 'missing-user', status: 'active', user: null },
          ],
          canDelete: true,
          canEdit: true,
          content: [{ type: 'p', children: [{ text: 'Body' }] }] as never,
          onConfirmDelete,
          onDeleteOpenChange,
        })}
      />
    );

    expect(document.querySelector('[data-rich-text="1"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-hashtags]')).toHaveLength(2);
    expect(screen.getByText('@ada')).toBeDefined();
    expect(document.querySelector('[data-avatar-src="avatar.png"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="calendar"]')).not.toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /t:features.blogs.delete/ }));
    expect(onDeleteOpenChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /t:common.actions.delete/ }));
    expect(onDeleteOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });

  it('renders anonymous empty-content fallbacks without optional metadata', () => {
    const view = render(
      <BlogDetailView
        {...baseProps({
          author: { name: '' },
          bloggers: null as never,
          canEdit: true,
          content: [] as never,
          currentUserId: undefined,
          date: null,
          hashtags: [],
        })}
      />
    );
    expect(document.querySelector('[data-fallback]')?.textContent).toBe('U');
    expect(document.body.textContent).toContain(
      'translated:generated.inline.0031_unknown_bc7819b3'
    );
    expect(screen.queryByText('subscribe')).toBeNull();
    expect(document.querySelector('[data-icon="calendar"]')).toBeNull();
    expect(document.querySelector('[data-hashtags]')).toBeNull();
    expect(
      screen.getByRole('link', { name: /t:features.blogs.detail.startWriting/ })
    ).toBeDefined();

    view.rerender(
      <BlogDetailView
        {...baseProps({
          author: undefined,
          content: 'not-an-array' as never,
          currentUserId: undefined,
        })}
      />
    );
    expect(document.querySelector('[data-avatar]')).toBeNull();
  });

  it('builds both virtual query TTLs and maps owner, blogger, present, and absent users', () => {
    render(<BlogDetailView {...baseProps({ virtualizeParticipationDirectory: true })} />);
    const source = state.virtualSource;
    if (!source) throw new Error('virtual source was not provided');

    expect(
      source.getPageQuery({
        limit: 5,
        start: 'cursor',
        dir: 'next',
        settled: true,
        query: 'a',
        roleIds: ['r'],
      })
    ).toMatchObject({ options: { ttl: '5m' } });
    expect(
      source.getPageQuery({
        limit: 5,
        start: null,
        dir: 'prev',
        settled: false,
        query: '',
        roleIds: [],
      })
    ).toMatchObject({ options: { ttl: 'none' } });
    expect(source.getSingleQuery({ id: 'row', settled: true })).toMatchObject({
      options: { ttl: '5m' },
    });
    expect(source.getSingleQuery({ id: 'row', settled: false })).toMatchObject({
      options: { ttl: 'none' },
    });
    expect(source.getRowKey({ id: 'row' })).toBe('row');

    expect(
      source.mapRow({
        id: 'owner',
        status: 'owner',
        user_id: 'fallback',
        role: null,
        user: {
          id: 'owner-user',
          name: 'Owner',
          handle: 'owner',
          email: 'login@x',
          contact_email: 'o@x',
          avatar: 'o.png',
        },
      })
    ).toMatchObject({
      userId: 'owner-user',
      handle: 'owner',
      email: 'o@x',
      avatar: 'o.png',
      status: 'owner',
    });
    expect(
      source.mapRow({
        id: 'editor',
        status: null,
        user_id: 'fallback',
        role: { id: 'r', name: 'Role' },
        user: null,
      })
    ).toMatchObject({ userId: 'fallback', handle: null, email: null, avatar: null, status: null });
    expect(
      source.mapRow({ id: 'blogger', status: 'active', user_id: 'fallback', role: null, user: {} })
        .roles[0].id
    ).toBe('blogger');
  });
});

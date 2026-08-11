/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlogDetailView } from '../BlogDetailView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StatsBar: () => <div data-testid="stats-bar" />,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  SubscribeButton: ({
    'data-action-id': actionId,
    onToggleSubscribe,
  }: {
    'data-action-id'?: string;
    onToggleSubscribe: () => void;
  }) => (
    <button type="button" data-action-id={actionId} onClick={onToggleSubscribe}>
      subscribe
    </button>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: { 'data-action-id'?: string }) => (
    <button type="button" data-action-id={actionId}>
      share
    </button>
  ),
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ badgeClassName }: { badgeClassName?: string }) => (
    <div data-testid="hashtags" data-badge-class-name={badgeClassName} />
  ),
}));

vi.mock('@/features/shared/ui/voting', () => ({
  VoteButtons: () => <div data-testid="vote-buttons" />,
}));

vi.mock('@/features/shared/ui/comments', () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}));

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: () => <div data-testid="entity-wiki-media" />,
  WikiParticipationDirectory: () => <div data-testid="wiki-participation-directory" />,
  getWikiParticipationName: () => 'Blogger',
  isVisibleWikiParticipationStatus: () => true,
  normalizeWikiParticipationRole: () => null,
}));

afterEach(cleanup);

function renderBlogDetail(
  currentUserId?: string,
  hashtags: { id: string; tag: string }[] = [],
  title = 'Public blog',
  overrides: Partial<ComponentProps<typeof BlogDetailView>> = {}
) {
  return render(
    <BlogDetailView
      author={{ id: 'author-1', name: 'Author' }}
      blogId="blog-1"
      bloggers={[]}
      canAccess
      canDelete={false}
      canEdit={false}
      commentCount={0}
      comments={[]}
      currentUserId={currentUserId}
      currentVoteValue={0}
      deleteOpen={false}
      downvotes={0}
      editorUrl="/blog/blog-1/editor"
      hashtags={hashtags}
      isLoaded
      isSubscribed={false}
      onAddComment={vi.fn()}
      onCommentVote={vi.fn()}
      onConfirmDelete={vi.fn()}
      onDeleteOpenChange={vi.fn()}
      onSubscribeToggle={vi.fn()}
      onVote={vi.fn()}
      shareContextItem={{
        id: 'blog-1',
        type: 'blog',
        title: 'Public blog',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        commentCount: 0,
      }}
      subscriberCount={0}
      subscribeLoading={false}
      supporterCount={0}
      title={title}
      upvotes={0}
      viewUrl="/blog/blog-1"
      {...overrides}
    />
  );
}

describe('BlogDetailView actions', () => {
  it('shows only share actions to unauthenticated visitors', () => {
    renderBlogDetail();

    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'subscribe' })).toBeNull();
    expect(screen.queryByTestId('vote-buttons')).toBeNull();
  });

  it('keeps blog actions visible to authenticated users', () => {
    const onSubscribeToggle = vi.fn();
    renderBlogDetail('user-1', [], 'Public blog', { onSubscribeToggle });

    const subscribe = screen.getByRole('button', { name: 'subscribe' });
    expect(subscribe.getAttribute('data-action-id')).toBe('blogs.detail.subscribe');
    expect(screen.getByRole('button', { name: 'share' }).getAttribute('data-action-id')).toBe(
      'blogs.detail.share'
    );
    fireEvent.click(subscribe);
    expect(onSubscribeToggle).toHaveBeenCalledOnce();
    expect(screen.getByTestId('vote-buttons')).toBeTruthy();
  });

  it('routes edit actions and confirms deletion through stable user intentions', async () => {
    const onDeleteOpenChange = vi.fn();
    const onConfirmDelete = vi.fn();
    renderBlogDetail('user-1', [], 'Public blog', {
      canDelete: true,
      canEdit: true,
      onConfirmDelete,
      onDeleteOpenChange,
    });

    expect(
      screen
        .getByRole('link', { name: 'features.blogs.detail.editContent' })
        .getAttribute('data-action-id')
    ).toBe('blogs.detail.edit');
    expect(
      screen
        .getByRole('link', { name: 'features.blogs.detail.startWriting' })
        .getAttribute('data-action-id')
    ).toBe('blogs.detail.start-writing');

    const deleteButton = screen.getByRole('button', { name: 'features.blogs.delete' });
    expect(deleteButton.getAttribute('data-action-id')).toBe('blogs.detail.delete');
    fireEvent.click(deleteButton);
    expect(onDeleteOpenChange).toHaveBeenCalledWith(true);

    cleanup();
    renderBlogDetail('user-1', [], 'Public blog', {
      canDelete: true,
      deleteOpen: true,
      onConfirmDelete,
      onDeleteOpenChange,
    });

    const confirm = screen.getByRole('button', { name: 'common.actions.delete' });
    expect(confirm.getAttribute('data-action-id')).toBe('blogs.detail.confirm-delete');
    fireEvent.click(confirm);
    expect(onDeleteOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });

  it('places mobile hashtags below a constrained title and keeps the desktop position', () => {
    renderBlogDetail(
      'user-1',
      [{ id: 'tag-1', tag: 'a-very-long-hashtag' }],
      'A very long public blog title'
    );

    const title = screen.getByRole('heading', {
      level: 1,
      name: 'A very long public blog title',
    });
    const titleGroup = title.parentElement;
    const hashtagDisplays = screen.getAllByTestId('hashtags');

    expect(title.className).toContain('min-w-0');
    expect(title.className).toContain('break-words');
    expect(titleGroup?.className).toContain('min-w-0');
    expect(titleGroup?.nextElementSibling).toBe(hashtagDisplays[0]?.parentElement);
    expect(hashtagDisplays[0]?.parentElement?.className).toContain('md:hidden');
    expect(hashtagDisplays[0]?.getAttribute('data-badge-class-name')).toContain('break-all');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('hidden');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('md:block');
  });
});

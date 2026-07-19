/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlogDetailView } from '../BlogDetailView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
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
  EntityPageFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StatsBar: () => <div data-testid="stats-bar" />,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  SubscribeButton: () => <button type="button">subscribe</button>,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">share</button>,
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

function renderBlogDetail(currentUserId?: string) {
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
      hashtags={[]}
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
      title="Public blog"
      upvotes={0}
      viewUrl="/blog/blog-1"
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
    renderBlogDetail('user-1');

    expect(screen.getByRole('button', { name: 'subscribe' })).toBeTruthy();
    expect(screen.getByTestId('vote-buttons')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
  });
});

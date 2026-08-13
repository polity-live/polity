/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlogDetailView } from '../BlogDetailView';

afterEach(() => {
  cleanup();
});

describe('BlogDetailView loading state', () => {
  it('renders a page skeleton instead of visible loading text', () => {
    render(
      <BlogDetailView
        blogId="blog-1"
        bloggers={[]}
        canAccess
        canDelete={false}
        canEdit={false}
        commentCount={0}
        comments={[]}
        currentVoteValue={0}
        deleteOpen={false}
        downvotes={0}
        editorUrl="/blog/blog-1/editor"
        hashtags={[]}
        isLoaded={false}
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
          title: 'Blog',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          commentCount: 0,
        }}
        subscriberCount={0}
        subscribeLoading={false}
        supporterCount={0}
        upvotes={0}
        viewUrl="/blog/blog-1"
      />
    );

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('Loading blog...')).toBeNull();
  });
});

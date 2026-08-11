/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchContentItem } from '../../types/search.types';
import { StatementSearchCard } from '../StatementSearchCard';

const shareProps = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to: _to,
    ...props
  }: {
    children: React.ReactNode;
    params: { id: string };
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={`/statement/${params.id}`} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton', () => ({
  ShareButton: (props: { 'data-action-id'?: string; url: string; title: string }) => {
    shareProps(props);
    return (
      <button data-action-id={props['data-action-id']} onClick={() => shareProps('clicked')}>
        Share
      </button>
    );
  },
}));

afterEach(() => {
  cleanup();
  shareProps.mockClear();
});

describe('StatementSearchCard', () => {
  it('renders survey, media, group avatar, negative score, and fallback comment variants', () => {
    const item = {
      id: 'statement-survey',
      type: 'statement',
      title: 'Survey',
      authorName: '',
      imageUrl: '/survey.jpg',
      groupName: 'Assembly',
      groupImageUrl: '/group.jpg',
      upvotes: 1,
      downvotes: 3,
      stats: { comments: 5 },
      surveyQuestion: 'Which option?',
      surveyOptions: [
        { label: 'One', voteCount: 1 },
        { label: 'Two', voteCount: 2 },
      ],
    } as unknown as SearchContentItem;

    render(<StatementSearchCard item={item} />);

    expect(screen.getByText('Which option?')).toBeTruthy();
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('-2')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('opens and shares a statement through separate stable actions', () => {
    const item = {
      id: 'statement-1',
      type: 'statement',
      title: 'A long civic statement',
      authorName: 'Ada',
      groupName: 'Assembly',
      upvotes: 3,
      downvotes: 1,
      commentCount: 4,
    } as SearchContentItem;

    render(<StatementSearchCard item={item} />);

    const open = screen.getByRole('link');
    const share = screen.getByRole('button', { name: 'Share' });

    expect(open.getAttribute('data-action-id')).toBe('search.statement.open');
    expect(open.getAttribute('href')).toBe('/statement/statement-1');
    expect(share.getAttribute('data-action-id')).toBe('search.statement.share');
    expect(shareProps).toHaveBeenCalledWith(
      expect.objectContaining({
        'data-action-id': 'search.statement.share',
        url: '/statement/statement-1',
        title: 'A long civic statement',
      })
    );

    open.focus();
    expect(document.activeElement).toBe(open);
    share.focus();
    fireEvent.click(share);
    expect(document.activeElement).toBe(share);
    expect(shareProps).toHaveBeenCalledWith('clicked');
  });

  it('renders video and empty text, comments, and share-title fallbacks', () => {
    const item = {
      id: 'statement-video',
      type: 'statement',
      title: undefined,
      authorName: 'Ada',
      videoUrl: '/assembly.mp4',
      upvotes: 0,
      downvotes: 0,
    } as unknown as SearchContentItem;

    const { container } = render(<StatementSearchCard item={item} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('+0')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(shareProps).toHaveBeenCalledWith(
      expect.objectContaining({ title: '', url: '/statement/statement-video' })
    );
  });
});

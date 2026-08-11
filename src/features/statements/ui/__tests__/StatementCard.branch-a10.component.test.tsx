/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className} href="/statement/test">
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: (string | undefined)[]) => values.filter(Boolean).join(' '),
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: (rows?: { hashtag?: { tag?: string | null } | null }[]) =>
    rows?.flatMap(row => (row.hashtag?.tag ? [row.hashtag.tag] : [])) ?? [],
}));

vi.mock('../StatementTextRenderer', () => ({
  StatementTextRenderer: ({ text }: { text: string }) => <div data-text>{text}</div>,
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span data-tag>{children}</span>,
}));

vi.mock('lucide-react', () => ({
  ArrowBigUp: () => <i data-icon="up" />,
  ArrowBigDown: () => <i data-icon="down" />,
  MessageSquare: () => <i data-icon="comments" />,
  BarChart3: () => <i data-icon="survey" />,
  Image: () => <i data-icon="media" />,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/zero/statements/content', () => ({
  getStatementHeadline: (statement: { title?: string | null }) => statement.title ?? 'headline',
}));

import { StatementCard } from '../StatementCard';

afterEach(cleanup);

describe('StatementCard branch contracts', () => {
  it('renders full author, group, text, tags, survey, image, and explicit counters', () => {
    render(
      <StatementCard
        className="custom"
        statement={{
          id: 'full',
          title: 'Full headline',
          text: 'Full text',
          image_url: 'image.png',
          video_url: 'video.mp4',
          upvotes: 8,
          downvotes: 3,
          comment_count: 4,
          user: { id: 'user', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
          group: { id: 'group', name: 'Group' },
          statement_hashtags: [{ hashtag: { tag: 'policy' } }],
          statement_survey: [{ id: 'survey' }],
        }}
      />
    );

    expect(screen.getByRole('link').className).toContain('custom');
    expect(screen.getByText('@ada')).toBeDefined();
    expect(screen.getByText('Group')).toBeDefined();
    expect(screen.getByText('Full text')).toBeDefined();
    expect(screen.getByText('#policy')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(document.querySelector('[data-icon="survey"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="media"]')).not.toBeNull();
  });

  it('falls back to the formatted author name and video-only media', () => {
    render(
      <StatementCard
        statement={{
          id: 'name',
          title: 'Name',
          video_url: 'video.mp4',
          user: { first_name: 'Grace', last_name: undefined, handle: '' },
          statement_survey: [],
          statement_hashtags: [],
        }}
      />
    );

    expect(screen.getByText('Grace')).toBeDefined();
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(document.querySelector('[data-icon="survey"]')).toBeNull();
    expect(document.querySelector('[data-icon="media"]')).not.toBeNull();
  });

  it('uses a handle when names are empty and omits optional content', () => {
    render(
      <StatementCard
        statement={{
          id: 'handle',
          user: { first_name: undefined, last_name: undefined, handle: 'fallback' },
          statement_hashtags: undefined,
          statement_survey: undefined,
        }}
      />
    );

    expect(screen.getByText('@fallback')).toBeDefined();
    expect(document.querySelector('[data-text]')).toBeNull();
    expect(document.querySelector('[data-tag]')).toBeNull();
    expect(document.querySelector('[data-icon="media"]')).toBeNull();
  });

  it('uses Unknown for an empty named author and for a missing author', () => {
    const view = render(
      <StatementCard
        statement={{ id: 'unknown-author', user: { first_name: '', last_name: '', handle: '' } }}
      />
    );
    expect(screen.getByText('Unknown')).toBeDefined();

    view.rerender(<StatementCard statement={{ id: 'no-author', user: null }} />);
    expect(screen.getByText('Unknown')).toBeDefined();
  });
});

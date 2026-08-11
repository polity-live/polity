/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  headerProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
  hashtags: undefined as unknown,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ hashtags }: { hashtags: unknown }) => {
    mocks.hashtags = hashtags;
    return <div>Hashtags</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('../../../constants/content-type-config', () => ({
  CONTENT_TYPE_CONFIG: {
    statement: { borderColor: 'statement-border', accentColor: 'statement-accent' },
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: (props: Record<string, any>) => {
    mocks.headerProps = props;
    return (
      <header>
        {props.title}
        {props.children}
      </header>
    );
  },
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { StatementTimelineCard, type StatementTimelineCardProps } from '../StatementTimelineCard';

const baseStatement: StatementTimelineCardProps['statement'] = {
  id: 'statement-1',
  content: 'Short statement',
  authorName: 'Ada',
};

function renderStatement(
  overrides: Partial<StatementTimelineCardProps['statement']> = {},
  props = {}
) {
  return render(
    <StatementTimelineCard statement={{ ...baseStatement, ...overrides }} {...props} />
  );
}

afterEach(() => {
  cleanup();
  mocks.baseProps = undefined;
  mocks.headerProps = undefined;
  mocks.shareProps = undefined;
  mocks.hashtags = undefined;
});

describe('StatementTimelineCard', () => {
  it('uses a short text statement as title with neutral default stats', () => {
    renderStatement();
    expect(mocks.baseProps?.href).toBe('/statement/statement-1');
    expect(mocks.headerProps).toMatchObject({ title: 'Short statement', subtitle: 'Ada' });
    expect(document.body.textContent).toContain('+0');
    expect(document.body.textContent).toContain('0');
    expect(mocks.shareProps).toMatchObject({
      url: '/statement/statement-1',
      title: 'Ada',
      description: 'Short statement',
    });
  });

  it('prefers an explicit title, group subtitle/link, href override, and image media', () => {
    renderStatement(
      {
        title: 'Explicit headline',
        imageUrl: 'image.jpg',
        videoUrl: 'video.mp4',
        groupName: 'Civic Group',
        groupId: 'group-1',
        supportCount: 7,
        opposeCount: 2,
        commentCount: 4,
      },
      { href: '/custom' }
    );
    expect(mocks.baseProps?.href).toBe('/custom');
    expect(mocks.headerProps).toMatchObject({
      title: 'Explicit headline',
      subtitle: 'Civic Group',
      subtitleHref: '/group/group-1',
    });
    expect(document.querySelector('img')?.getAttribute('src')).toBe('image.jpg');
    expect(document.body.textContent).toContain('+5');
    expect(document.body.textContent).toContain('4');
  });

  it('renders video fallback media and a negative score', () => {
    renderStatement({ videoUrl: 'video.mp4', supportCount: 1, opposeCount: 5 });
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('-4');
  });

  it('truncates long text titles and adds the continuation excerpt only without media or survey', () => {
    const content = `${'A'.repeat(100)}${'B'.repeat(60)}`;
    renderStatement({ content });
    expect(mocks.headerProps?.title).toBe(`${'A'.repeat(100)}...`);
    expect(document.body.textContent).toContain('B'.repeat(50));
    cleanup();

    renderStatement({ content, imageUrl: 'image.jpg' });
    expect(document.body.textContent).not.toContain('B'.repeat(50));
  });

  it('normalizes string and object survey options with percentages and overflow', () => {
    renderStatement({
      surveyQuestion: 'Which option?',
      surveyOptions: [
        'One' as never,
        { label: 'Two', voteCount: 3 },
        { label: 'Three', voteCount: 1 },
        { label: 'Four', voteCount: 0 },
        { label: 'Five', voteCount: 0 },
      ],
    });
    expect(mocks.headerProps?.title).toBe('Which option?');
    expect(document.body.textContent).toContain('75%');
    expect(document.body.textContent).toContain('+1');
    expect(document.body.textContent).toContain('4');
  });

  it('renders zero-vote surveys without percentages and ignores incomplete survey definitions', () => {
    renderStatement({ surveyQuestion: 'Question?', surveyOptions: ['A', 'B'] });
    expect(document.body.textContent).not.toContain('%');
    cleanup();

    renderStatement({ surveyQuestion: 'Question?', surveyOptions: [] });
    expect(mocks.headerProps?.title).toBe('Short statement');
    cleanup();

    renderStatement({ surveyOptions: ['A'] });
    expect(mocks.headerProps?.title).toBe('Short statement');
  });

  it('renders only the first three hashtags', () => {
    const hashtags = Array.from({ length: 4 }, (_, index) => ({
      id: String(index),
      tag: `tag-${index}`,
    }));
    renderStatement({ hashtags });
    expect(mocks.hashtags).toEqual(hashtags.slice(0, 3));
    cleanup();

    renderStatement({ hashtags: [] });
    expect(screen.queryByText('Hashtags')).toBeNull();
  });
});

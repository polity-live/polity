/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  byIdWithDetails: vi.fn((input: unknown) => ({ input, kind: 'single' })),
  gridProps: undefined as Record<string, (...args: never[]) => unknown> | undefined,
  pageByUser: vi.fn((input: unknown) => ({ input, kind: 'page' })),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: Record<string, unknown>) => (
    <input aria-label="statement search" {...props} />
  ),
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: Record<string, (...args: never[]) => unknown>) => {
    mocks.gridProps = props;
    return <div data-testid="statement-grid" />;
  },
}));

vi.mock('@/features/timeline/ui/cards/StatementTimelineCard', () => ({
  StatementTimelineCard: ({ statement }: { statement: Record<string, unknown> }) => (
    <output data-testid="statement-card">{JSON.stringify(statement)}</output>
  ),
}));

vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="statement-skeleton" />,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    statements: {
      byIdWithDetails: mocks.byIdWithDetails,
      pageByUser: mocks.pageByUser,
    },
  },
}));

import { StatementListTab } from '../StatementListTab';

describe('StatementListTab branch campaign A07', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gridProps = undefined;
  });

  afterEach(cleanup);

  function renderTab(searchValue = '  climate  ') {
    const onSearchChange = vi.fn();
    render(
      <StatementListTab
        authorName="Ada"
        authorTitle="Chair"
        authorAvatar="ada.png"
        userId="user-1"
        searchValue={searchValue}
        onSearchChange={onSearchChange}
      />
    );
    return { onSearchChange, props: mocks.gridProps! };
  }

  it('builds deterministic page and row queries for settled and live states', () => {
    const { onSearchChange, props } = renderTab();

    expect(screen.getByTestId('statement-grid')).toBeTruthy();
    expect((props.context as unknown as { query: string }).query).toBe('climate');
    fireEvent.change(screen.getByLabelText('statement search'), { target: { value: 'trees' } });
    expect(onSearchChange).toHaveBeenCalledWith('trees');

    const livePage = props.getPageQuery({
      dir: 'forward',
      limit: 10,
      settled: false,
      start: null,
    } as never) as {
      options: { ttl: string };
    };
    const settledPage = props.getPageQuery({
      dir: 'backward',
      limit: 5,
      settled: true,
      start: {},
    } as never) as {
      options: { ttl: string };
    };
    const liveSingle = props.getSingleQuery({ id: 'statement-1', settled: false } as never) as {
      options: { ttl: string };
    };
    const settledSingle = props.getSingleQuery({ id: 'statement-1', settled: true } as never) as {
      options: { ttl: string };
    };

    expect([livePage.options.ttl, settledPage.options.ttl]).toEqual(['none', '5m']);
    expect([liveSingle.options.ttl, settledSingle.options.ttl]).toEqual(['none', '5m']);
    expect(mocks.pageByUser).toHaveBeenCalledTimes(2);
    expect(mocks.byIdWithDetails).toHaveBeenCalledTimes(2);
    expect(props.getLanes(1200 as never)).toBe(3);
    expect(props.getLanes(800 as never)).toBe(2);
    expect(props.getLanes(400 as never)).toBe(1);
  });

  it('maps complete statement relations into the timeline contract', () => {
    const { props } = renderTab('');
    const statement = {
      id: 42,
      title: 'A green city',
      text: 'Plant trees',
      created_at: 123,
      image_url: 'image.png',
      video_url: 'video.mp4',
      group_id: 'group-1',
      group: { name: 'Climate Group', image_url: 'group.png' },
      comment_count: 7,
      support_votes: [{ vote: 1 }, { vote: 1 }, { vote: -1 }, { vote: 0 }],
      surveys: [
        {
          question: 'Where?',
          options: [{ label: 'North', votes: [{ id: 1 }] }, { label: 'South' }],
        },
      ],
      statement_hashtags: [
        { id: 'junction-1', hashtag: { id: 'tag-1', tag: 'climate' } },
        { id: 'junction-2' },
      ],
    };

    expect(props.getRowKey(statement as never)).toBe(42);
    expect(props.toStartRow(statement as never)).toEqual({ created_at: 123, id: 42 });
    const row = props.renderRow(statement as never, 20 as never) as ReactNode;
    render(<>{row}</>);

    const card = JSON.parse(screen.getByTestId('statement-card').textContent ?? '{}');
    expect(card).toMatchObject({
      id: '42',
      supportCount: 2,
      opposeCount: 1,
      commentCount: 7,
      surveyQuestion: 'Where?',
      surveyOptions: [
        { label: 'North', voteCount: 1 },
        { label: 'South', voteCount: 0 },
      ],
      hashtags: [{ id: 'tag-1', tag: 'climate' }],
    });
  });

  it('normalizes every optional relation and renders empty and loading states', () => {
    const { props } = renderTab();
    const sparse = {
      id: 'statement-2',
      created_at: 456,
      title: null,
      text: null,
      image_url: null,
      video_url: null,
      group_id: null,
      group: null,
      comment_count: null,
      support_votes: null,
      surveys: [{ question: null, options: undefined }],
      statement_hashtags: null,
    };

    render(<>{props.renderRow(sparse as never, 0 as never) as ReactNode}</>);
    const card = JSON.parse(screen.getByTestId('statement-card').textContent ?? '{}');
    expect(card).toMatchObject({
      id: 'statement-2',
      content: '',
      supportCount: 0,
      opposeCount: 0,
      commentCount: 0,
      hashtags: [],
    });

    render(<>{props.renderSkeleton() as ReactNode}</>);
    render(<>{props.renderEmpty() as ReactNode}</>);
    expect(screen.getByTestId('statement-skeleton')).toBeTruthy();
    expect(screen.getByText('pages.user.statements.noResults')).toBeTruthy();
  });
});

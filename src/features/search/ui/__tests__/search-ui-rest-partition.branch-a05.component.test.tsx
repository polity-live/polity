/* @vitest-environment jsdom */

import React, { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  shortcut: null as null | { display: string; ariaKeyShortcuts: string },
  timelineProps: null as any,
  userProps: [] as any[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: any) =>
      values?.count === undefined ? key : `${key}:${values.count}`,
  }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/keyboard/keyboard-shortcut', () => ({
  useResolvedKeyboardShortcut: () => state.shortcut,
}));
vi.mock('@/features/shared/ui/form', () => ({
  SearchField: ({
    value,
    onValueChange,
    emptyEndAdornment,
    clearLabel: _clearLabel,
    fieldClassName: _fieldClassName,
    inputClassName: _inputClassName,
    ...props
  }: any) => (
    <label>
      search
      <input
        aria-label="search"
        value={value}
        onChange={e => onValueChange(e.target.value)}
        {...props}
      />
      {emptyEndAdornment}
    </label>
  ),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({
    children,
    size: _size,
    variant: _variant,
    presentation: _presentation,
    ...props
  }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/kbd', () => ({
  Kbd: ({ children }: any) => <kbd>{children}</kbd>,
}));
vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterButton: ({ children, active, ...props }: any) => (
    <button data-active={String(active)} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/timeline/ui/TimelineFilterPanel', () => ({
  TimelineFilterPanel: (props: any) => {
    state.timelineProps = props;
    return <div data-testid="timeline-filter" />;
  },
}));
vi.mock('@rocicorp/zero-virtual/react', () => ({
  rowAttributes: (index: number, key: unknown) => ({ 'data-row': `${index}:${String(key)}` }),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children, surface: _surface, shape: _shape, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));
vi.mock('@/features/shared/virtualization', () => ({
  ZeroVirtualSpacer: ({ position, size }: any) => (
    <div data-testid={`spacer-${position}`}>{size}</div>
  ),
}));
vi.mock('../SearchResultCard', () => ({
  SearchResultCard: ({ document, mode }: any) => (
    <span data-testid={`result-${document.id}`}>{mode}</span>
  ),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={to.replace('$id', params.id)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: (props: any) => <img {...props} />,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton', () => ({
  ShareButton: (props: any) => <button data-testid="share" data-title={props.title} />,
}));
vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: () => ({ badge: 'badge' }),
  getSemanticToneClasses: (tone: string) => ({ text: tone }),
}));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@/features/timeline/ui/cards/UserTimelineCard', () => ({
  UserTimelineCard: (props: any) => {
    state.userProps.push(props);
    return <div>{props.user.name}</div>;
  },
}));

import { SearchHeader } from '../SearchHeader';
import { SearchPageView, type SearchPageViewProps } from '../SearchPageView';
import { SpatialSearchResultsList } from '../SpatialSearchResultsList';
import { StatementSearchCard } from '../StatementSearchCard';
import { UserSearchCard } from '../UserSearchCard';
import { VirtualSearchGridView } from '../VirtualSearchGridView';

beforeEach(() => {
  vi.clearAllMocks();
  state.shortcut = null;
  state.timelineProps = null;
  state.userProps = [];
});
afterEach(cleanup);

describe('search header and page branches', () => {
  it('covers shortcut, personal topics, result states and all header actions', () => {
    const actions = { search: vi.fn(), filters: vi.fn(), topic: vi.fn(), view: vi.fn() };
    const props = {
      searchQuery: '',
      setSearchQuery: actions.search,
      showFilters: false,
      setShowFilters: actions.filters,
      activeTopics: ['CIVIC'],
      onTopicToggle: actions.topic,
      totalResults: null,
      queryParam: '',
      view: 'list' as const,
      onViewChange: actions.view,
    };
    const view = render(<SearchHeader {...props} />);
    expect(screen.queryByRole('button', { name: '#civic' })).toBeNull();
    state.shortcut = { display: 'Ctrl K', ariaKeyShortcuts: 'Control+K' };
    view.rerender(
      <SearchHeader
        {...props}
        searchQuery="term"
        queryParam="term"
        personalTopics={['civic', 'other']}
      />
    );
    expect(screen.getByText('Ctrl K')).toBeTruthy();
    expect(screen.getByText('features.search.results.searchingFor')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'next' } });
    fireEvent.click(screen.getByRole('button', { name: 'features.search.listView' }));
    fireEvent.click(screen.getByRole('button', { name: 'features.search.spatialView' }));
    fireEvent.click(screen.getByRole('button', { name: 'features.search.filters.title' }));
    fireEvent.click(screen.getByRole('button', { name: '#civic' }));
    expect(actions.topic).toHaveBeenCalledWith('civic');
    view.rerender(
      <SearchHeader
        {...props}
        queryParam="term"
        totalResults={3}
        view="spatial"
        showFilters
        personalTopics={['other']}
      />
    );
    expect(screen.getByText('features.search.results.showingFor:3')).toBeTruthy();
  });

  it('covers page defaults, filters and the close callback', () => {
    const base: SearchPageViewProps = {
      searchQuery: '',
      onSearchQueryChange: vi.fn(),
      showFilters: false,
      onShowFiltersChange: vi.fn(),
      contentTypes: [],
      onContentTypesChange: vi.fn(),
      onContentTypeToggle: vi.fn(),
      dateRange: 'all' as never,
      onDateRangeChange: vi.fn(),
      topics: [],
      availableTopics: [],
      onTopicToggle: vi.fn(),
      engagement: 'all' as never,
      onEngagementChange: vi.fn(),
      onResetFilters: vi.fn(),
      hasActiveFilters: false,
      totalResults: null,
      view: 'list',
      onViewChange: vi.fn(),
      swipeHandlers: { onTouchStart: vi.fn() } as never,
      results: <span>results</span>,
    };
    const view = render(<SearchPageView {...base} />);
    expect(screen.queryByTestId('timeline-filter')).toBeNull();
    view.rerender(<SearchPageView {...base} showFilters personalTopics={['civic']} />);
    expect(screen.getByTestId('timeline-filter')).toBeTruthy();
    state.timelineProps.onClose();
    expect(base.onShowFiltersChange).toHaveBeenCalledWith(false);
  });
});

describe('search result list/card branches', () => {
  const document = (id: string) => ({ id, type: 'group', title: id }) as never;

  it('covers spatial empty, skeleton, active/inactive selection and keyboard controls', () => {
    const select = vi.fn();
    const cells = [
      { key: 'skeleton', index: 0, document: null },
      { key: 'active', index: 1, document: document('active') },
      { key: 'inactive', index: 2, document: document('inactive') },
    ] as never;
    const ref = createRef<HTMLDivElement>();
    const view = render(
      <SpatialSearchResultsList
        parentRef={ref}
        cells={cells}
        spaceBefore={1}
        spaceAfter={2}
        rowsEmpty={false}
        isComplete={false}
        emptyLabel="empty"
        activeDocumentId="active"
        onDocumentSelect={select}
      />
    );
    const controls = screen.getAllByRole('button');
    fireEvent.click(controls[0]);
    fireEvent.click(controls[1]);
    fireEvent.keyDown(controls[1], { key: 'Escape' });
    fireEvent.keyDown(controls[1], { key: 'Enter' });
    fireEvent.keyDown(controls[2], { key: ' ' });
    expect(select).toHaveBeenCalledTimes(3);
    view.rerender(
      <SpatialSearchResultsList
        parentRef={ref}
        cells={[]}
        spaceBefore={0}
        spaceAfter={0}
        rowsEmpty
        isComplete
        emptyLabel="empty"
        onDocumentSelect={select}
      />
    );
    expect(screen.getByText('empty')).toBeTruthy();
  });

  it('covers statement media/survey/fallback and both score tones', () => {
    const base: any = {
      id: 'statement',
      title: 'Statement title',
      imageUrl: null,
      videoUrl: '/video',
      surveyQuestion: null,
      surveyOptions: [],
      upvotes: 0,
      downvotes: 2,
      authorName: '',
      groupName: null,
    };
    const view = render(<StatementSearchCard item={base} />);
    expect(screen.getByText('-2')).toBeTruthy();
    view.rerender(
      <StatementSearchCard
        item={
          {
            ...base,
            videoUrl: null,
            imageUrl: '/image',
            surveyQuestion: 'Question',
            surveyOptions: [{ label: 'Yes' }],
            upvotes: 3,
            downvotes: 1,
            authorName: 'Ada',
            groupName: 'Group',
            groupImageUrl: '/group',
          } as never
        }
      />
    );
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
    view.rerender(
      <StatementSearchCard
        item={
          {
            id: 'fallbacks',
            title: null,
            imageUrl: null,
            videoUrl: null,
            surveyQuestion: null,
            surveyOptions: undefined,
            upvotes: undefined,
            downvotes: undefined,
            authorName: 'Ada',
            groupName: 'Group',
            groupImageUrl: null,
          } as never
        }
      />
    );
    expect(screen.getByText('+0')).toBeTruthy();
    expect(screen.getByTestId('share').getAttribute('data-title')).toBe('');
  });

  it('covers user-name fallback chain', () => {
    const view = render(<UserSearchCard user={{ id: 'one', handle: 'handle' }} />);
    expect(screen.getByText('handle')).toBeTruthy();
    view.rerender(<UserSearchCard user={{ id: 'two' }} />);
    expect(screen.getByText('Unknown User')).toBeTruthy();
    view.rerender(
      <UserSearchCard user={{ id: 'three', first_name: 'Ada', last_name: 'Lovelace' }} />
    );
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  });

  it('covers virtual jump, empty, document and skeleton cells', () => {
    const jump = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const cells = [
      { key: 's', index: 0, top: 0, left: 0, width: 100, document: null, mode: 'preview' },
      {
        key: 'd',
        index: 1,
        top: 10,
        left: 20,
        width: 100,
        document: document('doc'),
        mode: 'interactive',
      },
    ] as never;
    const view = render(
      <VirtualSearchGridView
        parentRef={ref}
        cells={cells}
        totalHeight={400}
        showNewResults
        rowsEmpty={false}
        isComplete={false}
        newResultsLabel="new"
        emptyLabel="empty"
        onJumpToTop={jump}
      />
    );
    fireEvent.click(screen.getByText('new'));
    expect(jump).toHaveBeenCalled();
    expect(screen.getByTestId('result-doc')).toBeTruthy();
    view.rerender(
      <VirtualSearchGridView
        parentRef={ref}
        cells={[]}
        totalHeight={0}
        showNewResults={false}
        rowsEmpty
        isComplete
        newResultsLabel="new"
        emptyLabel="empty"
        onJumpToTop={jump}
      />
    );
    expect(screen.getByText('empty')).toBeTruthy();
  });
});

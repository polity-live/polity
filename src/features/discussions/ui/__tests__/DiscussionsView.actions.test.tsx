/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiscussionsView } from '../DiscussionsView';

const listState = vi.hoisted(() => ({
  rowsEmpty: true,
  items: [] as { key: string; index: number; row: any }[],
  latestOptions: null as Record<string, any> | null,
}));
const selectState = vi.hoisted(() => ({
  onValueChange: undefined as undefined | ((v: string) => void),
}));

vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: any) => <main>{children}</main>,
}));
vi.mock('../CreateThreadDialog', () => ({ CreateThreadDialog: () => null }));
vi.mock('../ThreadCard', () => ({
  ThreadCard: ({ thread }: any) => <article data-testid="thread-row" data-row-id={thread.id} />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    (
      ({
        'generated.inline.0390_top_voted_3ecc2d00': 'Top Voted',
        'generated.inline.0391_newest_first_a40bb555': 'Newest First',
        'generated.inline.0392_new_thread_66826f91': 'New Thread',
        'generated.inline.0394_create_first_thread_e26d65a7': 'Create First Thread',
      }) as Record<string, string>
    )[key] ?? key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/virtualization', () => ({
  rowAttributes: () => ({}),
  usePolityZeroWindowList: (options: Record<string, any>) => {
    listState.latestOptions = options;
    return {
      items: listState.items,
      rowsEmpty: listState.rowsEmpty,
      spaceAfter: 0,
      spaceBefore: 0,
    };
  },
  ZeroVirtualSpacer: () => null,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlSelect: ({ 'data-action-id': actionId, children, onValueChange }: any) => {
    selectState.onValueChange = onValueChange;
    return <div data-action-id={actionId}>{children}</div>;
  },
  FormControlSelectContent: ({ children }: any) => <div>{children}</div>,
  FormControlSelectItem: ({ children, value, ...props }: any) => (
    <button type="button" onClick={() => selectState.onValueChange?.(value)} {...props}>
      {children}
    </button>
  ),
  FormControlSelectTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  FormControlSelectValue: () => <span>Sort</span>,
}));

afterEach(() => {
  cleanup();
  listState.items = [];
  listState.latestOptions = null;
});

function props(overrides: Record<string, unknown> = {}) {
  return {
    amendmentId: 'amendment-1',
    amendmentTitle: 'Amendment',
    hasAmendment: true,
    isCreateDialogOpen: false,
    isLoading: false,
    onCreateComment: vi.fn(),
    onCreateDialogOpenChange: vi.fn(),
    onCreateThread: vi.fn(async () => 'thread-1'),
    onSortByChange: vi.fn(),
    onVoteComment: vi.fn(),
    onVoteThread: vi.fn(),
    sortBy: 'votes',
    userId: 'user-1',
    ...overrides,
  } as any;
}

describe('DiscussionsView action contracts', () => {
  it('opens the create dialog from toolbar and empty state through one canonical intent', () => {
    listState.rowsEmpty = true;
    const viewProps = props();
    render(<DiscussionsView {...viewProps} />);

    const createActions = document.querySelectorAll(
      '[data-action-id="discussions.list.thread.create"]'
    );
    expect(createActions).toHaveLength(2);
    createActions.forEach(action => fireEvent.click(action));
    expect(viewProps.onCreateDialogOpenChange).toHaveBeenCalledTimes(2);
    expect(viewProps.onCreateDialogOpenChange).toHaveBeenNthCalledWith(1, true);
  });

  it('does not offer empty-state creation to anonymous visitors', () => {
    listState.rowsEmpty = true;
    render(<DiscussionsView {...props({ userId: null })} />);

    expect(
      document.querySelectorAll('[data-action-id="discussions.list.thread.create"]')
    ).toHaveLength(0);
  });

  it('changes discussion sorting through stable trigger and option intents', () => {
    listState.rowsEmpty = false;
    const viewProps = props();
    render(<DiscussionsView {...viewProps} />);

    expect(document.querySelector('[data-action-id="discussions.list.sort.change"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="discussions.list.sort.open"]')).toBeTruthy();
    const votes = document.querySelector(
      '[data-action-id="discussions.list.sort.votes"]'
    ) as HTMLButtonElement;
    const time = document.querySelector(
      '[data-action-id="discussions.list.sort.time"]'
    ) as HTMLButtonElement;
    votes.focus();
    expect(document.activeElement).toBe(votes);
    fireEvent.click(time);
    expect(viewProps.onSortByChange).toHaveBeenCalledWith('time');
  });

  it('maps vote and time cursors, rows, placeholders, and settled cache policies', () => {
    const row = {
      id: 'thread-1',
      content: 'Thread',
      created_at: 7,
      upvotes: 4,
      downvotes: 1,
    };
    listState.rowsEmpty = false;
    listState.items = [
      { key: 'thread-1', index: 0, row },
      { key: 'placeholder', index: 1, row: null },
    ];
    const view = render(<DiscussionsView {...props({ sortBy: 'votes' })} />);

    expect(document.querySelectorAll('[data-testid="thread-row"]')).toHaveLength(1);
    expect(
      document.querySelector('[data-testid="thread-row"]')?.parentElement?.style.marginTop
    ).toBe('0px');
    expect(listState.latestOptions?.toStartRow(row)).toEqual({
      id: 'thread-1',
      upvotes: 4,
      downvotes: 1,
    });
    expect(
      listState.latestOptions?.getPageQuery({
        limit: 10,
        start: null,
        dir: 'forward',
        settled: true,
      }).options.ttl
    ).toBe('5m');
    expect(
      listState.latestOptions?.getPageQuery({
        limit: 10,
        start: null,
        dir: 'forward',
        settled: false,
      }).options.ttl
    ).toBe('none');
    expect(
      listState.latestOptions?.getSingleQuery({ id: 'thread-1', settled: true }).options.ttl
    ).toBe('5m');
    expect(
      listState.latestOptions?.getSingleQuery({ id: 'thread-1', settled: false }).options.ttl
    ).toBe('none');
    expect(listState.latestOptions?.getScrollElement()).not.toBeNull();

    view.rerender(<DiscussionsView {...props({ sortBy: 'time' })} />);
    expect(listState.latestOptions?.toStartRow(row)).toEqual({
      id: 'thread-1',
      created_at: 7,
    });
  });
});

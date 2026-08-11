// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodoList } from '../todo-list';

const mocks = vi.hoisted(() => ({
  zeroOptions: null as any,
  virtual: { items: [] as any[], spaceBefore: 0, spaceAfter: 0 },
  localProps: null as any,
  cards: [] as any[],
  page: vi.fn(),
  single: vi.fn(),
  anchor: vi.fn(),
}));

vi.mock('@/features/shared/virtualization', () => ({
  usePolityZeroList: (options: any) => {
    mocks.zeroOptions = options;
    return mocks.virtual;
  },
  rowAttributes: (index: number, key: unknown) => ({ 'data-row': `${index}:${String(key)}` }),
  ZeroVirtualSpacer: ({ position, size }: any) => <div>{`${position}:${size}`}</div>,
  PolityLocalListView: (props: any) => {
    mocks.localProps = props;
    return (
      <div>
        {props.items.map((item: any) => (
          <div key={item.id}>{props.renderItem(item)}</div>
        ))}
      </div>
    );
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    todos: {
      page: (...args: any[]) => mocks.page(...args),
      byIdWithRelations: (...args: any[]) => mocks.single(...args),
    },
  },
}));

vi.mock('@/features/timeline/ui/cards/TodoTimelineCard', () => ({
  TodoTimelineCard: (props: any) => {
    mocks.cards.push(props);
    return (
      <div>
        <button onClick={props.onToggle}>toggle</button>
        <button onClick={props.onCardClick}>open</button>
      </div>
    );
  },
}));

vi.mock('../../logic/tutorialTodoAnchor', () => ({
  getTodoTutorialAnchor: (...args: any[]) => mocks.anchor(...args),
}));

function todo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'todo-1',
    title: 'Todo',
    description: 'Description',
    status: 'pending',
    due_date: 10,
    assignments: [{ id: 'a' }],
    group: { id: 'group', name: 'Group' },
    creator: { id: 'creator' },
    archived_at: null,
    created_at: 20,
    ...overrides,
  } as any;
}

describe('TodoList branch coverage', () => {
  beforeEach(() => {
    mocks.zeroOptions = null;
    mocks.virtual = { items: [], spaceBefore: 0, spaceAfter: 0 };
    mocks.localProps = null;
    mocks.cards = [];
    mocks.page.mockReset().mockReturnValue('page-query');
    mocks.single.mockReset().mockReturnValue('single-query');
    mocks.anchor.mockReset().mockReturnValue('tutorial-anchor');
  });
  afterEach(cleanup);

  it('maps complete and fallback local todo cards with manageable actions', () => {
    const onToggleComplete = vi.fn();
    const onTodoClick = vi.fn();
    const complete = todo({ status: 'completed', archived_at: 30 });
    const fallback = todo({
      id: 'fallback',
      title: null,
      description: null,
      status: 'invalid',
      due_date: null,
      assignments: undefined,
      group: null,
      creator: null,
      archived_at: 0,
    });
    const nullStatus = todo({ id: 'null-status', status: null });
    render(
      <TodoList
        todos={[complete, fallback, nullStatus]}
        onToggleComplete={onToggleComplete}
        onTodoClick={onTodoClick}
      />
    );
    expect(mocks.localProps.getItemKey(complete)).toBe('todo-1');
    expect(mocks.cards[0].todo).toEqual(
      expect.objectContaining({
        isCompleted: true,
        status: 'completed',
        archived: true,
        assigneeCount: 1,
      })
    );
    expect(mocks.cards[1].todo).toEqual(
      expect.objectContaining({
        title: '',
        description: undefined,
        status: undefined,
        dueDate: undefined,
        groupName: undefined,
        groupId: undefined,
        creatorId: undefined,
        archived: false,
      })
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'toggle' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'open' })[0]);
    expect(onToggleComplete).toHaveBeenCalledWith(complete);
    expect(onTodoClick).toHaveBeenCalledWith(complete);
  });

  it('disables toggle and tolerates an absent card-click callback', () => {
    render(<TodoList canManageTodos={false} todos={[todo()]} onToggleComplete={vi.fn()} />);
    expect(mocks.cards[0].onToggle).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
  });

  it('configures active virtual paging and renders rows plus skeletons', () => {
    const row = todo();
    mocks.virtual = {
      items: [
        { index: 2, key: 'loaded', row },
        { index: 3, key: 'loading', row: undefined },
      ],
      spaceBefore: 5,
      spaceAfter: 6,
    };
    render(
      <TodoList
        todos={[]}
        onToggleComplete={vi.fn()}
        virtualQuery={{ status: 'pending', archive: 'active', query: 'find' }}
      />
    );
    expect(mocks.zeroOptions.getScrollElement()).toBeTruthy();
    expect(mocks.zeroOptions.estimateSize()).toBe(132);
    expect(mocks.zeroOptions.getRowKey(row)).toBe('todo-1');
    expect(mocks.zeroOptions.toStartRow(row)).toEqual({ created_at: 20, id: 'todo-1' });
    expect(
      mocks.zeroOptions.getPageQuery({ limit: 10, start: null, dir: 'older', settled: true })
    ).toEqual({ query: 'page-query', options: { ttl: '5m' } });
    expect(
      mocks.zeroOptions.getPageQuery({ limit: 10, start: null, dir: 'older', settled: false })
    ).toEqual({ query: 'page-query', options: { ttl: 'none' } });
    expect(mocks.zeroOptions.getSingleQuery({ id: 'todo-1', settled: true })).toEqual({
      query: 'single-query',
      options: { ttl: '5m' },
    });
    expect(mocks.zeroOptions.getSingleQuery({ id: 'todo-1', settled: false })).toEqual({
      query: 'single-query',
      options: { ttl: 'none' },
    });
    expect(document.querySelector('[data-row="2:loaded"]')?.getAttribute('style')).toContain(
      'margin-top: 0px'
    );
    expect(document.querySelector('[data-row="3:loading"]')?.getAttribute('style')).toBeNull();
  });

  it('uses archived cursor rows', () => {
    const archived = todo({ archived_at: '42' });
    mocks.virtual = { items: [], spaceBefore: 0, spaceAfter: 0 };
    render(
      <TodoList
        todos={[]}
        onToggleComplete={vi.fn()}
        virtualQuery={{ status: 'all', archive: 'archived', query: '' }}
      />
    );
    expect(mocks.zeroOptions.toStartRow(archived)).toEqual({ archived_at: 42, id: 'todo-1' });
  });
});

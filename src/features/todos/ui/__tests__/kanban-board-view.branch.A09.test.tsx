/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listOptions: undefined as any,
  listItems: [] as any[],
  timelineProps: [] as any[],
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityLocalListView: ({ items, getItemKey, renderItem }: any) => (
    <div>
      {items.map((item: any) => (
        <div key={getItemKey(item)}>{renderItem(item)}</div>
      ))}
    </div>
  ),
  rowAttributes: (index: number, key: string) => ({ 'data-row': `${index}-${key}` }),
  usePolityZeroList: (options: any) => {
    state.listOptions = options;
    return { items: state.listItems, spaceAfter: 2, spaceBefore: 1 };
  },
  ZeroVirtualSpacer: ({ position, size }: any) => <i>{`${position}-${size}`}</i>,
}));
vi.mock('@/features/timeline/ui/cards/TodoTimelineCard', () => ({
  TodoTimelineCard: (props: any) => {
    state.timelineProps.push(props);
    return (
      <div>
        <button type="button" onClick={props.onCardClick}>
          Open {props.todo.id}
        </button>
        {props.onToggle ? (
          <button type="button" onClick={props.onToggle}>
            Toggle {props.todo.id}
          </button>
        ) : null}
      </div>
    );
  },
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: () => <span>Skeleton</span>,
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    todos: {
      page: vi.fn((args: unknown) => ({ kind: 'page', args })),
      byIdWithRelations: vi.fn((args: unknown) => ({ kind: 'single', args })),
    },
  },
}));

import { KanbanBoardView } from '../kanban-board-view';

beforeEach(() => {
  state.listOptions = undefined;
  state.listItems = [];
  state.timelineProps = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const todo = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Todo ${id}`,
  description: null,
  status: 'pending',
  created_at: 10,
  due_date: null,
  assignments: [],
  group: null,
  creator: null,
  archived_at: null,
  ...overrides,
});

function props(columns: any[], overrides: Record<string, unknown> = {}) {
  return {
    canManageTodos: true,
    columns,
    tasksLabel: 'tasks',
    draggedTodoId: null,
    onColumnDragOver: vi.fn(),
    onColumnDrop: vi.fn(),
    onCardMouseDown: vi.fn(),
    onCardDragStart: vi.fn(),
    onCardDragEnd: vi.fn(),
    onCardClick: vi.fn(),
    onToggleComplete: vi.fn(),
    ...overrides,
  } as any;
}

describe('kanban board view remaining branches A09', () => {
  it('renders local cards with complete optional data and dispatches all card/column actions', () => {
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    const todos = validStatuses.map((status, index) =>
      todo(String(index), {
        status,
        description: 'Description',
        due_date: 123,
        assignments: [{ id: 'assignment' }],
        group: { id: 'group', name: 'Group' },
        creator: { id: 'creator' },
        archived_at: index === 0 ? 1 : null,
      })
    );
    const columns = [{ id: 'pending', title: 'Pending', todos, className: 'custom' }];
    const callbacks = props(columns, { draggedTodoId: '0' });
    render(<KanbanBoardView {...callbacks} />);

    const wrapper = screen.getByRole('button', { name: 'Open 0' }).closest('[draggable]')!;
    fireEvent.mouseDown(wrapper);
    fireEvent.dragStart(wrapper);
    fireEvent.dragEnd(wrapper);
    fireEvent.click(screen.getByRole('button', { name: 'Open 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle 0' }));
    const region = screen.getByRole('region');
    fireEvent.dragOver(region);
    fireEvent.drop(region);

    expect(callbacks.onCardMouseDown).toHaveBeenCalledWith(todos[0]);
    expect(callbacks.onCardDragStart).toHaveBeenCalledWith(todos[0]);
    expect(callbacks.onCardDragEnd).toHaveBeenCalledWith(todos[0]);
    expect(callbacks.onCardClick).toHaveBeenCalledWith(todos[0]);
    expect(callbacks.onToggleComplete).toHaveBeenCalledWith(todos[0]);
    expect(callbacks.onColumnDrop).toHaveBeenCalledWith('pending');
    expect(state.timelineProps.map(entry => entry.todo.status)).toEqual(validStatuses);
  });

  it('renders invalid empty cards without management handlers or tutorial anchors', () => {
    const invalid = todo('invalid', { title: null, status: 'other', tutorial_run_id: null });
    const callbacks = props([{ id: 'pending', title: 'Pending', todos: [invalid] }], {
      canManageTodos: false,
    });
    render(<KanbanBoardView {...callbacks} />);
    const wrapper = screen.getByRole('button', { name: 'Open invalid' }).closest('[draggable]')!;
    expect(wrapper.getAttribute('draggable')).toBe('false');
    expect(wrapper.getAttribute('data-tutorial-anchor')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Toggle invalid' })).toBeNull();
    fireEvent.dragStart(wrapper);
    expect(callbacks.onCardDragStart).not.toHaveBeenCalled();
    expect(state.timelineProps[0].todo).toMatchObject({
      title: '',
      description: undefined,
      dueDate: undefined,
      groupName: undefined,
      groupId: undefined,
      status: undefined,
      creatorId: undefined,
      archived: false,
    });
  });

  it('renders assistant and network tutorial board priorities', () => {
    const network = todo('network', { tutorial_run_id: 'run', title: 'Network task' });
    const assistant = todo('assistant', {
      tutorial_run_id: 'run',
      title: 'Die Welt zu einem besseren Ort machen',
    });
    const view = render(
      <KanbanBoardView {...props([{ id: 'pending', title: 'Pending', todos: [network] }])} />
    );
    expect(
      document.querySelector('[data-tutorial-anchor="tutorial-network-todo-board"]')
    ).toBeTruthy();
    view.rerender(
      <KanbanBoardView
        {...props([{ id: 'pending', title: 'Pending', todos: [network, assistant] }])}
      />
    );
    expect(
      document.querySelector('[data-tutorial-anchor="tutorial-assistant-todo-board"]')
    ).toBeTruthy();
  });

  it('exercises virtual rows and every captured query/list callback', () => {
    const row = todo('virtual', { created_at: '12' });
    state.listItems = [
      { index: 0, key: 'skeleton', row: null },
      { index: 1, key: 'row', row },
    ];
    render(
      <KanbanBoardView
        {...props([{ id: 'pending', title: 'Pending', todos: [] }], {
          virtualQuery: { query: '  find  ' },
        })}
      />
    );
    expect(screen.getByText('Skeleton')).toBeTruthy();
    expect(document.querySelector('[data-row="0-skeleton"]')?.getAttribute('style')).toContain(
      'margin-top'
    );
    expect(document.querySelector('[data-row="1-row"]')?.getAttribute('style')).toBeNull();

    const options = state.listOptions;
    expect(options.listContextParams).toEqual({ status: 'pending', query: 'find' });
    expect(options.getScrollElement()).toBeInstanceOf(HTMLDivElement);
    expect(options.estimateSize()).toBe(144);
    expect(options.getRowKey(row)).toBe('virtual');
    expect(options.toStartRow(row)).toEqual({ created_at: 12, id: 'virtual' });
    expect(
      options.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: true }).options
    ).toEqual({ ttl: '5m' });
    expect(
      options.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: false }).options
    ).toEqual({ ttl: 'none' });
    expect(options.getSingleQuery({ id: 'virtual', settled: true }).options).toEqual({ ttl: '5m' });
    expect(options.getSingleQuery({ id: 'virtual', settled: false }).options).toEqual({
      ttl: 'none',
    });
  });
});

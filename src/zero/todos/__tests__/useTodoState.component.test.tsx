/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = [unknown, { type: 'unknown' | 'complete' }];

const mocks = vi.hoisted(() => ({
  results: new Map<string, QueryResult>(),
  useQuery: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));

vi.mock('../../queries', () => {
  const query = (name: string, args: unknown) => ({ key: `${name}:${JSON.stringify(args)}` });
  return {
    queries: {
      todos: {
        allWithRelations: (args: unknown) => query('all', args),
        byGroupWithRelations: (args: unknown) => query('group', args),
        byIdWithRelations: (args: unknown) => query('id', args),
        assignments: (args: unknown) => query('assignments', args),
      },
    },
  };
});

import { useTodoState } from '../useTodoState';

function key(name: string, args: unknown) {
  return `${name}:${JSON.stringify(args)}`;
}

function setResult(
  name: string,
  args: unknown,
  value: unknown,
  type: 'unknown' | 'complete' = 'complete'
) {
  mocks.results.set(key(name, args), [value, { type }]);
}

beforeEach(() => {
  mocks.results.clear();
  mocks.useQuery.mockReset();
  mocks.useQuery.mockImplementation((query?: { key: string }) =>
    query
      ? (mocks.results.get(query.key) ?? [undefined, { type: 'complete' }])
      : [undefined, { type: 'complete' }]
  );
});

describe('useTodoState', () => {
  it('returns stable empty defaults when the active query has no data', () => {
    expect(renderHook(() => useTodoState({ userId: 'user-1' })).result.current).toMatchObject({
      userTodos: [],
      allTodos: [],
      archivedTodos: [],
      openTodos: [],
      completedTodos: [],
      inProgressTodos: [],
      isLoading: false,
    });
  });

  it('keeps all active todos without a user filter and derives every status bucket', () => {
    const todos = [
      { id: 'open', status: 'open' },
      { id: 'pending', status: 'pending' },
      { id: 'completed', status: 'completed' },
      { id: 'progress', status: 'in_progress' },
      { id: 'other', status: 'cancelled' },
    ];
    setResult('all', { archive: 'active' }, todos);

    const state = renderHook(() => useTodoState({})).result.current;

    expect(state.userTodos).toEqual(todos);
    expect(state.openTodos.map(todo => todo.id)).toEqual(['open', 'pending']);
    expect(state.completedTodos.map(todo => todo.id)).toEqual(['completed']);
    expect(state.inProgressTodos.map(todo => todo.id)).toEqual(['progress']);
  });

  it('filters user todos by creator or assignment and returns all scoped data', () => {
    const active = [
      { id: 'creator', status: 'open', creator: { id: 'user-1' }, assignments: undefined },
      {
        id: 'assigned',
        status: 'completed',
        creator: { id: 'other' },
        assignments: [{ user: { id: 'user-1' } }],
      },
      { id: 'unrelated', status: 'pending', creator: null, assignments: undefined },
    ];
    setResult('all', { archive: 'active' }, active);
    setResult('all', { archive: 'archived' }, [{ id: 'archived' }]);
    setResult('group', { group_id: 'group-1', archive: 'active' }, [{ id: 'group-todo' }]);
    setResult('id', { id: 'todo-1' }, { id: 'todo-1' });
    setResult('assignments', { todo_id: 'todo-1' }, [{ id: 'assignment-1' }]);

    const state = renderHook(() =>
      useTodoState({
        userId: 'user-1',
        includeArchived: true,
        groupId: 'group-1',
        todoId: 'todo-1',
      })
    ).result.current;

    expect(state.userTodos.map(todo => todo.id)).toEqual(['creator', 'assigned']);
    expect(state).toMatchObject({
      archivedTodos: [{ id: 'archived' }],
      groupTodos: [{ id: 'group-todo' }],
      todo: { id: 'todo-1' },
      assignments: [{ id: 'assignment-1' }],
      isLoading: false,
    });
  });

  it.each([
    ['all', {}, { archive: 'active' }],
    ['all', { includeArchived: true }, { archive: 'archived' }],
    ['group', { groupId: 'group-1' }, { group_id: 'group-1', archive: 'active' }],
    ['id', { todoId: 'todo-1' }, { id: 'todo-1' }],
  ] as const)('reports the %s loading boundary for options %j', (name, options, args) => {
    setResult(name, args, undefined, 'unknown');
    expect(renderHook(() => useTodoState(options)).result.current.isLoading).toBe(true);
  });
});

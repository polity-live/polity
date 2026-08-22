/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  activities: [] as any[],
  canManage: vi.fn(),
  query: vi.fn((args: unknown) => args),
  queryArg: undefined as unknown,
  user: { id: 'viewer' } as any,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: unknown) => {
    mocks.queryArg = query;
    return [mocks.activities, { type: 'complete' }];
  },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/zero/queries', () => ({
  queries: { todos: { activities: mocks.query } },
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ canManage: mocks.canManage }),
}));

import { useTodoActivity } from '../useTodoActivity';

beforeEach(() => {
  mocks.activities = [];
  mocks.canManage.mockReset().mockReturnValue(false);
  mocks.query.mockClear();
  mocks.queryArg = undefined;
  mocks.user = { id: 'viewer' };
});

describe('useTodoActivity', () => {
  it('allows creators and updates the reactive severity query', () => {
    const todo = { assignments: [], creator_id: 'viewer', group_id: null, id: 'todo' };
    const { result } = renderHook(() => useTodoActivity(todo));

    expect(result.current.canViewActivity).toBe(true);
    expect(mocks.query).toHaveBeenLastCalledWith({ severity: 'all', todo_id: 'todo' });

    act(() => result.current.setSeverity('high'));
    expect(mocks.query).toHaveBeenLastCalledWith({ severity: 'high', todo_id: 'todo' });
  });

  it('allows assignees and group todo managers', () => {
    const assignee = renderHook(() =>
      useTodoActivity({
        assignments: [{ user_id: 'viewer' }],
        creator_id: 'creator',
        group_id: null,
        id: 'assigned',
      })
    );
    expect(assignee.result.current.canViewActivity).toBe(true);
    assignee.unmount();

    mocks.canManage.mockReturnValue(true);
    const manager = renderHook(() =>
      useTodoActivity({ assignments: [], creator_id: 'creator', group_id: 'group', id: 'grouped' })
    );
    expect(manager.result.current.canViewActivity).toBe(true);
    expect(mocks.canManage).toHaveBeenCalledWith('groupTodos');
  });

  it('does not request activity data for unrelated or anonymous readers', () => {
    const { result, rerender } = renderHook(() =>
      useTodoActivity({ assignments: [], creator_id: 'creator', group_id: null, id: 'todo' })
    );
    expect(result.current.canViewActivity).toBe(false);
    expect(mocks.queryArg).toBeUndefined();

    mocks.user = undefined;
    rerender();
    expect(result.current.canViewActivity).toBe(false);
    expect(mocks.queryArg).toBeUndefined();
  });
});

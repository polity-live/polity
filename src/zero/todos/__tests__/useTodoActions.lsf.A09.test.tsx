/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn((mutation: unknown) => ({ mutation })),
  onServerError: vi.fn((_result: unknown, callback: (message: string) => void) =>
    callback('server-error')
  ),
  trackCreation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.mutate }),
}));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    todos: new Proxy({}, { get: (_target, name) => (args: unknown) => ({ name, args }) }),
  },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({ onServerError: mocks.onServerError }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.trackCreation,
}));

import { useTodoActions } from '../useTodoActions';

beforeEach(() => vi.clearAllMocks());

it('invokes every todo action and optimistic error callback', () => {
  const { result } = renderHook(() => useTodoActions());
  const actions = result.current;
  const args = { id: 'todo-id' } as never;

  expect(actions.createTodo(args)).toBeDefined();
  expect(actions.createFullTodo({ todo: { id: 'todo-id' } } as never)).toBeDefined();
  expect(actions.updateTodo(args)).toBeDefined();
  expect(actions.deleteTodo('todo-id')).toBeDefined();
  expect(actions.toggleComplete('todo-id')).toBeDefined();
  expect(actions.archiveTodo('todo-id')).toBeDefined();
  expect(actions.unarchiveTodo('todo-id')).toBeDefined();
  expect(actions.assignUser(args)).toBeDefined();
  expect(actions.unassignUser('assignment-id')).toBeDefined();

  expect(mocks.mutate).toHaveBeenCalledTimes(9);
  expect(mocks.trackCreation).toHaveBeenCalledTimes(2);
  expect(mocks.onServerError).toHaveBeenCalledTimes(7);
  expect(mocks.success).toHaveBeenCalledTimes(5);
  expect(mocks.error).toHaveBeenCalledTimes(7);
});

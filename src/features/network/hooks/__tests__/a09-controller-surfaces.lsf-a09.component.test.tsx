/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  runAction: vi.fn(async (action: () => Promise<unknown>, options: { onSuccess: () => void }) => {
    await action();
    options.onSuccess();
  }),
  resolvePartnerUsers: vi.fn(() => [{ id: 'partner-user' }]),
  todoFilters: { filteredTodos: [] },
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    reset: mocks.reset,
    runActionWithSubmission: mocks.runAction,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../useHierarchyLinkConflicts', () => ({
  useHierarchyLinkConflicts: () => ({
    canActivateLink: () => true,
    getConflictUserIds: () => [],
    resolveConflictUsers: () => [{ id: 'conflict-user', membershipIdInCurrentGroup: 'membership' }],
    resolvePartnerUsers: mocks.resolvePartnerUsers,
    isLinkCheckApplicable: true,
  }),
}));
vi.mock('@/features/todos/hooks/useTodoFilters', () => ({
  useTodoFilters: () => mocks.todoFilters,
}));
vi.mock('@/features/groups/hooks/useGroupAmendmentsPage', () => ({
  useGroupAmendmentsPage: () => ({
    groupedAmendments: [],
    groupName: 'Group',
    filters: {},
    showFilters: false,
    hasActiveFilters: false,
    updateFilter: vi.fn(),
    clearFilter: vi.fn(),
    setShowFilters: vi.fn(),
  }),
}));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ canCreate: true }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({ amendment: { id: 'amendment' }, isLoading: false }),
}));
vi.mock('@/features/discussions/hooks/useDiscussionMutations', () => ({
  useDiscussionMutations: () => ({ createThread: vi.fn(), createComment: vi.fn() }),
}));
vi.mock('@/features/votes/hooks/useVotingMutations', () => ({
  useVotingMutations: () => ({ voteOnThread: vi.fn(), voteOnComment: vi.fn() }),
}));

import { useTodosSectionController } from '@/features/groups/hooks/useTodosSectionController';
import { useGroupAmendmentsPageController } from '@/features/groups/ui/useGroupAmendmentsPageController';
import { useDiscussionsPageContainerController } from '@/features/discussions/ui/useDiscussionsPageContainerController';
import { useAddLinkDialogController } from '../useAddLinkDialogController';
import { useGroupConnectionComposer } from '../useGroupConnectionComposer';
import { useGroupEventsListController } from '../useGroupEventsListController';
import { useManageNetworkTabController } from '../useManageNetworkTabController';

beforeEach(() => vi.clearAllMocks());

it('executes link submission success and resets its fields', async () => {
  const onSubmit = vi.fn();
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useAddLinkDialogController({ onSubmit, onSuccess }));
  act(() => {
    result.current.onLabelChange('Docs');
    result.current.onUrlChange('https://example.test');
  });
  await act(async () => {
    result.current.onSubmit({ preventDefault: vi.fn() } as never);
  });
  expect(onSubmit).toHaveBeenCalledWith({ label: 'Docs', url: 'https://example.test' });
  expect(result.current.label).toBe('');
  expect(result.current.url).toBe('');
  expect(mocks.reset).toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalled();
});

it('absorbs action-submission rejection after preventing the native submit', async () => {
  mocks.runAction.mockRejectedValueOnce(new Error('rejected'));
  const { result } = renderHook(() => useAddLinkDialogController({ onSubmit: vi.fn() }));
  await act(async () => {
    result.current.onSubmit({ preventDefault: vi.fn() } as never);
    await Promise.resolve();
  });
});

it('executes every group connection composer state transition', () => {
  const { result } = renderHook(() => useGroupConnectionComposer());
  act(() => result.current.setActiveTab('advanced'));
  act(() => result.current.setValue(result.current.value));
  act(() => result.current.updateValue({ selectedGroupId: 'partner' }));
  act(() => result.current.selectPreset('parent'));
  act(() => result.current.resetComposer({ selectedGroupId: 'reset-partner' }));
  expect(result.current.activeTab).toBe('preset');
  expect(result.current.value.selectedGroupId).toBe('reset-partner');
});

it('constructs the static events controller', () => {
  expect(useGroupEventsListController).toBeTypeOf('function');
  const { result } = renderHook(() => useGroupEventsListController({ groupId: 'group' }));
  expect(result.current.futureEvents).toEqual([]);
  expect(result.current.labels.loadingEvents).toBe('common.labels.loadingEvents');
});

it('opens todo details and exposes group amendment/discussion controllers', () => {
  const todo = { id: 'todo', archived_at: 1 } as never;
  const todos = renderHook(() =>
    useTodosSectionController({ groupId: 'group', storageKey: 'todos', todos: [todo] })
  );
  expect(todos.result.current.archivedCount).toBe(1);
  act(() => todos.result.current.onTodoClick(todo));
  expect(todos.result.current.selectedTodo).toBe(todo);
  expect(todos.result.current.isDetailDialogOpen).toBe(true);
  act(() => todos.result.current.onDetailDialogOpenChange(false));
  act(() => todos.result.current.setArchiveMode('archived'));

  const amendments = renderHook(() => useGroupAmendmentsPageController({ groupId: 'group' }));
  expect(amendments.result.current).toMatchObject({ groupName: 'Group', canCreate: true });
  const discussions = renderHook(() =>
    useDiscussionsPageContainerController({ amendmentId: 'amendment', userId: 'user' })
  );
  act(() => discussions.result.current.setIsCreateDialogOpen(true));
  act(() => discussions.result.current.setSortBy('time'));
  expect(discussions.result.current).toMatchObject({
    isCreateDialogOpen: true,
    sortBy: 'time',
    isLoading: false,
  });
});

it('resolves partner users after opening the manage dialog', () => {
  const props = {
    canManageRelationships: true,
    groupId: 'group',
    groupName: 'Group',
    searchQuery: '',
    onSearchQueryChange: vi.fn(),
    directionFilter: 'all',
    onDirectionFilterChange: vi.fn(),
    manageRightFilter: new Set<string>(),
    onToggleRightFilter: vi.fn(),
    incomingRequests: [],
    outgoingRequests: [],
    filteredRelationships: [],
    allRelationships: [],
    onAcceptRequest: vi.fn(),
    onRejectRequest: vi.fn(),
    onDeleteRelationship: vi.fn(),
  } as never;
  const { result } = renderHook(() => useManageNetworkTabController(props));
  act(() =>
    result.current.setManageDialog({
      rels: [],
      otherGroupName: 'Partner',
      otherGroupId: 'partner',
    })
  );
  expect(result.current.manageDialogPartnerUsers).toEqual([{ id: 'partner-user' }]);
  expect(result.current.manageDialogAffectedUsers).toEqual([
    { id: 'conflict-user', membershipIdInCurrentGroup: 'membership' },
  ]);
});

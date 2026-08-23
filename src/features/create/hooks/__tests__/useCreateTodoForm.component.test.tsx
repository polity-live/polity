/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateTodoForm } from '../useCreateTodoForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

const createTodo = vi.fn();
const navigate = vi.fn();
let searchParams: Record<string, string | undefined> = {};
let authUser: { id: string } | null = { id: 'user-current' };
let memberLoading = false;
let participantLoading = false;
let restoreDraft: any = null;
let memberships: any[] = [];
let participations: any[] = [];
let hashtags: any[] = [];
const { trackCreateFinalization, toastError } = vi.hoisted(() => ({
  trackCreateFinalization: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => searchParams,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: authUser,
  }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useAssignableGroupMembersByGroupIds: (groupIds: readonly string[] = []) => ({
    members: [
      ...(groupIds.includes('group-1')
        ? [
            { group_id: 'group-1', user_id: 'user-1', user: { id: 'user-1' } },
            { group_id: 'group-1', user_id: 'user-2', user: { id: 'user-2' } },
          ]
        : []),
      ...(groupIds.includes('group-2')
        ? [{ group_id: 'group-2', user_id: 'user-3', user: { id: 'user-3' } }]
        : []),
    ],
    isLoading: memberLoading,
  }),
  useGroupById: (id?: string) => ({
    group: id
      ? {
          id,
          name:
            id === 'missing-group' ? undefined : id === 'group-2' ? 'Event Crew' : 'Budget Circle',
        }
      : undefined,
  }),
  useGroupState: () => ({
    currentUserMembershipsWithGroups: memberships,
  }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({
    participations,
  }),
  useEventParticipantsByParticipatedEventIds: (eventIds: readonly string[] = []) => ({
    participants: eventIds.includes('event-1')
      ? [
          { event_id: 'event-1', user_id: 'user-4', user: { id: 'user-4' } },
          { event_id: 'event-1', user_id: 'user-1', user: { id: 'user-1' } },
        ]
      : [],
    isLoading: participantLoading,
  }),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({
    allUsers: [
      { id: 'user-current', first_name: 'Current', last_name: 'User', handle: 'current' },
      { id: 'user-1', first_name: 'Ari', last_name: 'Example', handle: 'ari' },
      { id: 'user-2', first_name: 'Bo', last_name: 'Example', handle: 'bo' },
      { id: 'user-3', first_name: 'Cy', last_name: 'Example', handle: 'cy' },
      { id: 'user-4', first_name: 'Dee', last_name: 'Example', handle: 'dee' },
    ],
  }),
}));

vi.mock('@/features/todos/hooks/useTodoMutations', () => ({
  useTodoMutations: () => ({
    createTodo,
    isLoading: false,
  }),
}));

vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: () => ({
    userHashtags: hashtags,
  }),
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: (values: any[]) => values.map(value => value.tag),
}));

vi.mock('../../logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => restoreDraft,
  trackCreateFinalization,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    ({
      'generated.inline.0030_public_61c9b2b1': 'Öffentlich',
      'generated.inline.0031_authenticated_8fda38ce': 'Authentifiziert',
    })[key] ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: toastError,
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
  },
}));

function findField<TKind extends CreateFormFieldDescriptor['kind']>(
  fields: CreateFormFieldDescriptor[],
  key: string,
  kind: TKind
): Extract<CreateFormFieldDescriptor, { kind: TKind }> {
  const field = fields.find(candidate => candidate.key === key && candidate.kind === kind);
  if (!field) {
    throw new Error(`Field ${key} not found`);
  }
  return field as Extract<CreateFormFieldDescriptor, { kind: TKind }>;
}

describe('useCreateTodoForm', () => {
  beforeEach(() => {
    searchParams = {};
    authUser = { id: 'user-current' };
    memberLoading = false;
    participantLoading = false;
    restoreDraft = null;
    memberships = [
      { group_id: 'group-1', status: 'active', group: { id: 'group-1', name: 'Budget Circle' } },
      { group_id: 'group-2', status: 'invited', group: { id: 'group-2', name: 'Event Crew' } },
    ];
    participations = [
      { event_id: 'event-1', status: 'confirmed' },
      { event_id: 'event-2', status: 'invited' },
    ];
    hashtags = [];
    createTodo.mockReset();
    createTodo.mockResolvedValue({
      success: true,
      todoId: 'todo-1',
      mutationResult: {
        client: Promise.resolve(),
        server: Promise.resolve({ type: 'success' }),
      },
      payload: { todo: { id: 'todo-1' } },
    });
    navigate.mockClear();
    trackCreateFinalization.mockReset();
    toastError.mockReset();
  });

  it('orders title and description first, then assignment', () => {
    const { result } = renderHook(() => useCreateTodoForm());

    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.validation.titleRequired'
    );
    expect(result.current.steps[0].fields?.map(field => field.key)).toEqual([
      'title',
      'description',
    ]);
    expect(result.current.steps[1].fields?.map(field => field.key)).toEqual(['group', 'assignee']);
    expect(result.current.steps[2].fields?.map(field => field.key)).toEqual(['priority', 'status']);
  });

  it('uses current active group memberships plus participated events when no group is selected', () => {
    const { result } = renderHook(() => useCreateTodoForm());
    const assigneeField = findField(
      result.current.steps[1].fields ?? [],
      'assignee',
      'customComponent'
    );

    expect(assigneeField.props).toMatchObject({
      allowedUserIds: ['user-1', 'user-2', 'user-4'],
      multi: false,
    });
  });

  it('filters assignees to the selected group', () => {
    const { result } = renderHook(() => useCreateTodoForm());
    const groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');

    act(() => {
      (
        groupField.props as { onChange: (item: { id: string; label?: string } | null) => void }
      ).onChange({ id: 'group-2', label: 'Event Crew' });
    });

    const assigneeField = findField(
      result.current.steps[1].fields ?? [],
      'assignee',
      'customComponent'
    );
    expect(assigneeField.props).toMatchObject({
      allowedUserIds: ['user-3'],
    });
  });

  it('clears a selected assignee when the selected group no longer allows that user', async () => {
    const { result } = renderHook(() => useCreateTodoForm());
    const assigneeField = findField(
      result.current.steps[1].fields ?? [],
      'assignee',
      'customComponent'
    );

    act(() => {
      (assigneeField.props as { onChange: (ids: string[]) => void }).onChange(['user-4']);
    });

    const groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    act(() => {
      (
        groupField.props as { onChange: (item: { id: string; label?: string } | null) => void }
      ).onChange({ id: 'group-2', label: 'Event Crew' });
    });

    await waitFor(() => {
      const updatedAssigneeField = findField(
        result.current.steps[1].fields ?? [],
        'assignee',
        'customComponent'
      );
      expect(updatedAssigneeField.props).toMatchObject({ value: [] });
    });
  });

  it('keeps assignment optional and falls back to the current user on submit', async () => {
    const { result } = renderHook(() => useCreateTodoForm());
    const titleField = findField(result.current.steps[0].fields ?? [], 'title', 'text');

    act(() => {
      titleField.onValueChange('Prepare agenda');
    });

    let outcome: Awaited<ReturnType<typeof result.current.onSubmit>> | undefined;
    await act(async () => {
      outcome = await result.current.onSubmit();
    });

    expect(createTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Prepare agenda',
        assigneeId: 'user-current',
      }),
      { notificationMode: 'silent' }
    );
    expect(outcome).toMatchObject({
      status: 'success',
      target: {
        to: '/todos/$id',
        params: { id: 'todo-1' },
      },
    });
  });

  it('stores a date-only deadline at the end of the selected local day', async () => {
    const { result } = renderHook(() => useCreateTodoForm());
    const titleField = findField(result.current.steps[0].fields ?? [], 'title', 'text');
    const deadlineField = findField(
      result.current.steps[3].fields ?? [],
      'due-date-time',
      'customComponent'
    );

    act(() => {
      titleField.onValueChange('Prepare agenda');
      (deadlineField.props as { onChange: (values: any) => void }).onChange({
        dueDate: '2026-07-19',
        dueTime: '',
      });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(createTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDate: new Date(2026, 6, 19, 23, 59, 59, 999).getTime(),
      }),
      { notificationMode: 'silent' }
    );
  });

  it('stores an explicit deadline time and clears it when the date is removed', async () => {
    const { result } = renderHook(() => useCreateTodoForm());
    const titleField = findField(result.current.steps[0].fields ?? [], 'title', 'text');
    const deadlineField = findField(
      result.current.steps[3].fields ?? [],
      'due-date-time',
      'customComponent'
    );

    act(() => {
      titleField.onValueChange('Prepare agenda');
      (deadlineField.props as { onChange: (values: any) => void }).onChange({
        dueDate: '2026-07-19',
        dueTime: '14:30',
      });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(createTodo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dueDate: new Date(2026, 6, 19, 14, 30, 0, 0).getTime(),
      }),
      { notificationMode: 'silent' }
    );

    act(() => {
      const currentDeadlineField = findField(
        result.current.steps[3].fields ?? [],
        'due-date-time',
        'customComponent'
      );
      (currentDeadlineField.props as { onChange: (values: any) => void }).onChange({
        dueDate: '',
        dueTime: '',
      });
    });

    const clearedDeadlineField = findField(
      result.current.steps[3].fields ?? [],
      'due-date-time',
      'customComponent'
    );
    expect(clearedDeadlineField.props).toMatchObject({ dueDate: '', dueTime: '' });
  });

  it('restores every form value and exposes it in the review summary', async () => {
    restoreDraft = {
      formState: {
        title: 'Restored todo',
        description: 'Restored description',
        assigneeId: 'user-1',
        priority: 'high',
        status: 'in_progress',
        dueDate: '2026-08-12',
        dueTime: '09:30',
        tags: ['budget', 'local'],
        groupId: 'group-1',
        visibility: 'public',
      },
    };
    hashtags = [{ tag: 'suggested' }];
    const { result } = renderHook(() => useCreateTodoForm());

    await waitFor(() => {
      expect(findField(result.current.steps[0].fields ?? [], 'title', 'text').value).toBe(
        'Restored todo'
      );
    });

    const review = findField(result.current.steps[4].fields ?? [], 'review', 'customComponent');
    expect(review.props).toMatchObject({
      title: 'Restored todo',
      subtitle: 'Restored description',
    });
    expect(JSON.stringify(review.props)).toContain('2026-08-12 09:30');
    expect(JSON.stringify(review.props)).toContain('Ari Example');
    expect(JSON.stringify(review.props)).toContain('budget, local');
    expect(
      (findField(result.current.steps[3].fields ?? [], 'tags', 'customComponent').props as any)
        .preferredSuggestions
    ).toEqual(['suggested']);
  });

  it('applies restore defaults for an empty recovery state', async () => {
    restoreDraft = { formState: {} };
    const { result } = renderHook(() => useCreateTodoForm());
    await waitFor(() => {
      expect(findField(result.current.steps[0].fields ?? [], 'title', 'text').value).toBe('');
    });
    expect(result.current.steps[0].isValid()).toBe(false);
    expect(result.current.steps[4].isValid()).toBe(false);
  });

  it('syncs the search parameter and supports clearing a selected group', () => {
    searchParams = { groupId: 'group-1', returnSection: 'todos' };
    const { result } = renderHook(() => useCreateTodoForm());
    let groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    expect(groupField.props.value).toBe('group-1');
    expect((groupField.props as any).filterFn({ id: 'group-1' })).toBe(true);
    expect((groupField.props as any).filterFn({ id: 'group-2' })).toBe(false);

    act(() => {
      (groupField.props as any).onChange(null);
    });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/create/todo',
        search: { returnSection: 'todos', groupId: undefined },
        replace: true,
      })
    );
    groupField = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    expect(groupField.props.value).toBeUndefined();
  });

  it('clears a resolved group name when the search parameter disappears', async () => {
    searchParams = { groupId: 'group-1' };
    const { result, rerender } = renderHook(() => useCreateTodoForm());
    await waitFor(() =>
      expect(
        JSON.stringify(
          findField(result.current.steps[4].fields ?? [], 'review', 'customComponent').props as any
        )
      ).toContain('Budget Circle')
    );

    searchParams = {};
    rerender();
    await waitFor(() =>
      expect(
        findField(result.current.steps[1].fields ?? [], 'group', 'typeahead').props.value
      ).toBeUndefined()
    );
    expect(
      JSON.stringify(
        findField(result.current.steps[4].fields ?? [], 'review', 'customComponent').props as any
      )
    ).not.toContain('Budget Circle');
  });

  it('uses raw group and assignee ids when display records are unavailable', () => {
    memberLoading = true;
    const { result } = renderHook(() => useCreateTodoForm());
    const group = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    act(() => (group.props as any).onChange({ id: 'missing-group', label: '' }));
    const assignee = findField(result.current.steps[1].fields ?? [], 'assignee', 'customComponent');
    act(() => (assignee.props as any).onChange(['missing-user']));
    const review = findField(result.current.steps[4].fields ?? [], 'review', 'customComponent');
    expect(JSON.stringify(review.props)).toContain('missing-group');
    expect(JSON.stringify(review.props)).toContain('missing-user');

    act(() =>
      (
        findField(result.current.steps[1].fields ?? [], 'assignee', 'customComponent').props as any
      ).onChange([])
    );
    expect(
      (findField(result.current.steps[1].fields ?? [], 'assignee', 'customComponent').props as any)
        .value
    ).toEqual([]);
  });

  it('keeps an assignee while eligibility is loading, then clears it', async () => {
    const { result, rerender } = renderHook(() => useCreateTodoForm());
    const assignee = findField(result.current.steps[1].fields ?? [], 'assignee', 'customComponent');
    act(() => (assignee.props as any).onChange(['user-4']));

    memberLoading = true;
    const group = findField(result.current.steps[1].fields ?? [], 'group', 'typeahead');
    act(() => (group.props as any).onChange({ id: 'group-2', label: 'Event Crew' }));
    expect(
      (findField(result.current.steps[1].fields ?? [], 'assignee', 'customComponent').props as any)
        .value
    ).toEqual(['user-4']);

    memberLoading = false;
    rerender();
    await waitFor(() =>
      expect(
        (
          findField(result.current.steps[1].fields ?? [], 'assignee', 'customComponent')
            .props as any
        ).value
      ).toEqual([])
    );
  });

  it.each([
    ['public', 'pages.create.common.public'],
    ['authenticated', 'pages.create.common.authenticated'],
    ['private', 'pages.create.common.private'],
  ] as const)('shows the %s visibility label in review', (visibility, expected) => {
    const { result } = renderHook(() => useCreateTodoForm());
    const visibilityField = findField(
      result.current.steps[3].fields ?? [],
      'visibility',
      'customComponent'
    );
    act(() => (visibilityField.props as any).onChange(visibility));
    const review = findField(result.current.steps[4].fields ?? [], 'review', 'customComponent');
    expect(JSON.stringify(review.props)).toContain(expected);
  });

  it('shows status changes in review', () => {
    const { result } = renderHook(() => useCreateTodoForm());
    const statusField = findField(
      result.current.steps[2].fields ?? [],
      'status',
      'customComponent'
    );

    act(() => (statusField.props as any).onChange('completed'));

    const review = findField(result.current.steps[4].fields ?? [], 'review', 'customComponent');
    expect(JSON.stringify(review.props)).toContain('features.todos.status.completed');
  });

  it('blocks invalid and anonymous submissions', async () => {
    const first = renderHook(() => useCreateTodoForm());
    await expect(first.result.current.onSubmit()).resolves.toMatchObject({ status: 'blocked' });
    expect(createTodo).not.toHaveBeenCalled();
    first.unmount();

    authUser = null;
    const anonymous = renderHook(() => useCreateTodoForm());
    act(() =>
      findField(anonymous.result.current.steps[0].fields ?? [], 'title', 'text').onValueChange(
        'Valid title'
      )
    );
    await expect(anonymous.result.current.onSubmit()).resolves.toMatchObject({ status: 'blocked' });
  });

  it('submits a full group todo, reports progress, and finalizes the return target', async () => {
    searchParams = { groupId: 'group-1', returnSection: 'todos' };
    const reportProgress = vi.fn();
    const { result } = renderHook(() => useCreateTodoForm());
    act(() => {
      findField(result.current.steps[0].fields ?? [], 'title', 'text').onValueChange(
        '  Group task  '
      );
      findField(result.current.steps[0].fields ?? [], 'description', 'text').onValueChange(
        '  Details  '
      );
      (
        findField(result.current.steps[1].fields ?? [], 'assignee', 'customComponent').props as any
      ).onChange(['user-1']);
      (
        findField(result.current.steps[2].fields ?? [], 'priority', 'customComponent').props as any
      ).onChange('high');
      (
        findField(result.current.steps[2].fields ?? [], 'status', 'customComponent').props as any
      ).onChange('completed');
      (
        findField(result.current.steps[3].fields ?? [], 'tags', 'customComponent').props as any
      ).onChange(['tag-1']);
    });

    const outcome = await result.current.onSubmit({ reportProgress } as any);
    expect(createTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Group task',
        description: 'Details',
        assigneeId: 'user-1',
        priority: 'high',
        status: 'completed',
        tags: ['tag-1'],
        groupId: 'group-1',
        visibility: 'group',
      }),
      { notificationMode: 'silent' }
    );
    expect(reportProgress.mock.calls.map(call => call[0])).toEqual([
      { key: 'create', status: 'active' },
      { key: 'create', status: 'complete' },
      { key: 'sync', status: 'complete' },
      { key: 'ready', status: 'active' },
    ]);
    expect(outcome).toMatchObject({
      status: 'success',
      target: { to: '/group/$id/operation', params: { id: 'group-1' }, hash: 'todos' },
    });
    expect(trackCreateFinalization).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ id: 'todo:todo-1', entityType: 'todo' }),
      })
    );
  });

  it.each([
    [{ success: false, error: new Error('specific') }, 'specific'],
    [{ success: false }, 'pages.create.error.createFailed'],
    [{ success: true, todoId: 'todo-1' }, 'pages.create.error.createFailed'],
  ])('surfaces unsuccessful creation result %#', async (creationResult, message) => {
    createTodo.mockResolvedValueOnce(creationResult);
    const { result } = renderHook(() => useCreateTodoForm());
    act(() =>
      findField(result.current.steps[0].fields ?? [], 'title', 'text').onValueChange('Todo')
    );
    await expect(result.current.onSubmit()).rejects.toThrow(message);
    expect(toastError).toHaveBeenCalledWith('pages.create.error.createFailed');
  });
});

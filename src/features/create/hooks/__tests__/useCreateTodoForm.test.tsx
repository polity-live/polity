/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateTodoForm } from '../useCreateTodoForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

const createTodo = vi.fn();
const navigate = vi.fn();
let searchParams: Record<string, string | undefined> = {};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => searchParams,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-current' },
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
    isLoading: false,
  }),
  useGroupById: (id?: string) => ({
    group: id ? { id, name: id === 'group-2' ? 'Event Crew' : 'Budget Circle' } : undefined,
  }),
  useGroupState: () => ({
    currentUserMembershipsWithGroups: [
      { group_id: 'group-1', status: 'active', group: { id: 'group-1', name: 'Budget Circle' } },
      { group_id: 'group-2', status: 'invited', group: { id: 'group-2', name: 'Event Crew' } },
    ],
  }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({
    participations: [
      { event_id: 'event-1', status: 'confirmed' },
      { event_id: 'event-2', status: 'invited' },
    ],
  }),
  useEventParticipantsByParticipatedEventIds: (eventIds: readonly string[] = []) => ({
    participants: eventIds.includes('event-1')
      ? [
          { event_id: 'event-1', user_id: 'user-4', user: { id: 'user-4' } },
          { event_id: 'event-1', user_id: 'user-1', user: { id: 'user-1' } },
        ]
      : [],
    isLoading: false,
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
    userHashtags: [],
  }),
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: () => [],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    ({
      'generated.inline.0030_public_61c9b2b1': 'public',
      'generated.inline.0031_authenticated_8fda38ce': 'authenticated',
    })[key] ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
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
      })
    );
    expect(outcome).toMatchObject({
      status: 'success',
      target: {
        to: '/todos/$id',
        params: { id: 'todo-1' },
      },
    });
  });
});

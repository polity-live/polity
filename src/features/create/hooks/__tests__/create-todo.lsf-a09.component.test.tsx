/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useAssignableGroupMembersByGroupIds: () => ({ members: [], isLoading: false }),
  useGroupById: () => ({ group: undefined }),
  useGroupState: () => ({ currentUserMembershipsWithGroups: [] }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({ participations: [] }),
  useEventParticipantsByParticipatedEventIds: () => ({ participants: [], isLoading: false }),
}));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => ({ allUsers: [] }) }));
vi.mock('@/features/todos/hooks/useTodoMutations', () => ({
  useTodoMutations: () => ({ createTodo: vi.fn(), isLoading: false }),
}));
vi.mock('@/zero/common/useCommonState', () => ({ useCommonState: () => ({ userHashtags: [] }) }));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtagTags: () => [] }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useCreateTodoForm } from '../useCreateTodoForm';

it('executes optional, priority, settings, and review validation callbacks', () => {
  const { result } = renderHook(() => useCreateTodoForm());
  expect(result.current.steps[1].isValid()).toBe(true);
  expect(result.current.steps[2].isValid()).toBe(true);
  expect(result.current.steps[3].isValid()).toBe(true);
  expect(result.current.steps[4].getInvalidReason?.()).toBe(
    'pages.create.validation.titleRequired'
  );
});

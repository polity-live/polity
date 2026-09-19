/* @vitest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTodoAssigneeOptions } from '../useTodoAssigneeOptions';

const mocks = vi.hoisted(() => ({ groups: vi.fn(), events: vi.fn() }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: () => ({
    currentUserMembershipsWithGroups: [
      { group_id: 'active-group', status: 'member' },
      { group_id: null, status: 'member' },
      { group_id: 'invited-group', status: 'invited' },
    ],
  }),
  useAssignableGroupMembersByGroupIds: (ids: string[]) => {
    mocks.groups(ids);
    return { members: ids.length ? [{ user_id: 'member' }] : [], isLoading: false };
  },
}));
vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({
    participations: [
      { event_id: 'joined-event', status: 'confirmed' },
      { event_id: null, status: 'confirmed' },
      { event_id: 'invited-event', status: 'invited' },
    ],
  }),
  useEventParticipantsByParticipatedEventIds: (ids: string[]) => {
    mocks.events(ids);
    return {
      participants: ids.length ? [{ user_id: 'member' }, { user_id: 'participant' }] : [],
      isLoading: false,
    };
  },
}));
describe('inline todo assignment eligibility', () => {
  it('restricts group tasks to that group and uses only active memberships for personal tasks', () => {
    const { result, rerender } = renderHook(
      ({ groupId }: { groupId?: string }) => useTodoAssigneeOptions(groupId),
      { initialProps: { groupId: 'current-group' as string | undefined } }
    );
    expect(mocks.groups).toHaveBeenLastCalledWith(['current-group']);
    expect(mocks.events).toHaveBeenLastCalledWith([]);
    expect(result.current.allowedUserIds).toEqual(['member']);
    rerender({ groupId: undefined });
    expect(mocks.groups).toHaveBeenLastCalledWith(['active-group']);
    expect(mocks.events).toHaveBeenLastCalledWith(['joined-event']);
    expect(result.current.allowedUserIds).toEqual(['member', 'participant']);
  });
});

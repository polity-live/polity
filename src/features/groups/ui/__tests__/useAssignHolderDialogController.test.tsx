/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ members: [] as any[], error: vi.fn() }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupActiveMembers: () => ({ members: mocks.members }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { useAssignHolderDialogController } from '../useAssignHolderDialogController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.members = [
    { user: null },
    { user: { id: 'first', first_name: 'Ada', handle: null, email: null } },
    { user: { id: 'handle', first_name: null, handle: 'beta', email: null } },
    { user: { id: 'email', first_name: null, handle: null, email: 'mail@test' } },
  ];
});
const setup = (role: any = { id: 'r', assignment_mode: 'appointed', holder_history: [] }) => {
  const onAssign = vi.fn();
  const onOpenChange = vi.fn();
  return {
    onAssign,
    onOpenChange,
    ...renderHook(() =>
      useAssignHolderDialogController({ open: true, onOpenChange, role, groupId: 'g', onAssign })
    ),
  };
};

describe('useAssignHolderDialogController', () => {
  it('filters every searchable user field and finds the selected member', () => {
    const hook = setup();
    expect(hook.result.current.filteredMembers).toHaveLength(3);
    act(() => hook.result.current.setSearchQuery('ada'));
    expect(hook.result.current.filteredMembers).toHaveLength(1);
    act(() => hook.result.current.setSearchQuery('beta'));
    expect(hook.result.current.filteredMembers).toHaveLength(1);
    act(() => hook.result.current.setSearchQuery('mail'));
    expect(hook.result.current.filteredMembers).toHaveLength(1);
    act(() => hook.result.current.setSearchQuery('absent'));
    expect(hook.result.current.filteredMembers).toHaveLength(0);
    act(() => hook.result.current.setSelectedUserId('first'));
    expect(hook.result.current.selectedMember?.user?.id).toBe('first');
  });

  it('blocks elected and unselected submissions, then assigns and resets valid selections', () => {
    const elected = setup({
      id: 'r',
      assignment_mode: 'elected',
      holder_history: [
        { end_date: null, user: { id: 'holder' } },
        { end_date: 1, user: { id: 'old' } },
      ],
    });
    act(() => elected.result.current.handleSubmit({ preventDefault: vi.fn() } as any));
    expect(mocks.error).toHaveBeenCalled();
    expect(elected.result.current.currentHolder?.id).toBe('holder');
    const appointed = setup();
    act(() => appointed.result.current.handleSubmit({ preventDefault: vi.fn() } as any));
    act(() => {
      appointed.result.current.setSelectedUserId('first');
      appointed.result.current.setReason('elected');
      appointed.result.current.setSearchQuery('x');
    });
    act(() => appointed.result.current.handleSubmit({ preventDefault: vi.fn() } as any));
    expect(appointed.onAssign).toHaveBeenCalledWith('first', 'elected');
    expect(appointed.onOpenChange).toHaveBeenCalledWith(false);
    expect(appointed.result.current.selectedUserId).toBeNull();
  });
});

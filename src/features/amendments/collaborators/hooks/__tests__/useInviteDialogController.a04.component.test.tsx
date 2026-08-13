/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  users: [] as any[],
  run: vi.fn(),
  reset: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('../useUserSearch', () => ({
  useUserSearch: () => ({ users: mocks.users, isLoading: false }),
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({ runActionWithSubmission: mocks.run, reset: mocks.reset }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { useInviteDialogController } from '../useInviteDialogController';

describe('useInviteDialogController A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users = [
      { id: 'unnamed', name: '', handle: null, contactEmail: 'user@example.com' },
      { id: 'handled', name: 'Named', handle: 'handle', contactEmail: null },
    ];
    mocks.run.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('maps unnamed and contact-email user fallbacks and ignores empty selections', async () => {
    const onInviteUsers = vi.fn();
    const { result } = renderHook(() =>
      useInviteDialogController({
        amendmentId: 'amendment',
        existingCollaborators: [],
        roles: [{ id: 'role', name: 'Collaborator' }] as any,
        onInviteUsers,
      })
    );
    expect(result.current.typeaheadItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Unnamed User' }),
        expect.objectContaining({ label: 'Named' }),
      ])
    );
    await act(async () => result.current.onInviteUsersClick());
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('reports a missing collaborator role after users are selected', async () => {
    const { result } = renderHook(() =>
      useInviteDialogController({
        amendmentId: 'amendment',
        existingCollaborators: [],
        roles: [],
        onInviteUsers: vi.fn(),
      })
    );
    act(() => result.current.onSelectedUsersChange(['user']));
    await act(async () => result.current.onInviteUsersClick());
    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});

/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRole: vi.fn(() => ({ operation: 'create' })),
  updateRole: vi.fn(() => ({ operation: 'update' })),
  deleteRole: vi.fn(() => ({ operation: 'delete' })),
  assignActionRight: vi.fn(() => ({ operation: 'assign' })),
  removeActionRight: vi.fn(() => ({ operation: 'remove' })),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  roles: [{ id: 'role-1', title: 'Chair', description: 'Leads' }],
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    createRole: mocks.createRole,
    updateRole: mocks.updateRole,
    deleteRole: mocks.deleteRole,
  }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    assignActionRight: mocks.assignActionRight,
    removeActionRight: mocks.removeActionRight,
  }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventRolesData: () => ({ event: { id: 'event-1' }, roles: mocks.roles, isLoading: false }),
  useEventAccessRoles: () => ({ roles: [] }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: () => Promise.reject(new Error('server rejected')),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { useEventRoles } from '../useEventRoles';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('A07 legacy event-role hook failure contracts', () => {
  it('reports rejected add, edit, and reorder operations', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useEventRoles('event-1'));

    act(() => result.current.form.setTitle('Chair'));
    await act(() => result.current.actions.add());

    act(() => result.current.actions.openEdit(mocks.roles[0] as never));
    await act(() => result.current.actions.edit());

    await act(() => result.current.actions.reorderRoles(['role-1']));

    expect(mocks.createRole).toHaveBeenCalled();
    expect(mocks.updateRole).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(3);
    expect(mocks.toastError).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });
});

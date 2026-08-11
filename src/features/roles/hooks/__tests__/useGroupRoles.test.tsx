/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGroupRoles } from '../useGroupRoles';

const mocks = vi.hoisted(() => ({
  roles: [] as any[],
  isLoading: false,
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  createHistory: vi.fn(),
  updateHistory: vi.fn(),
  createElection: vi.fn(),
  createAgendaItem: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupRoles: () => ({ roles: mocks.roles, isLoading: mocks.isLoading }),
}));

vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    createRole: mocks.createRole,
    updateRole: mocks.updateRole,
    deleteRole: mocks.deleteRole,
    createRoleHolderHistory: mocks.createHistory,
    updateRoleHolderHistory: mocks.updateHistory,
  }),
}));

vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({ createElection: mocks.createElection }),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ createAgendaItem: mocks.createAgendaItem }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, params?: { title?: string }) =>
    params?.title ? `${key}:${params.title}` : key,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.roles = [];
  mocks.isLoading = false;
  for (const mutation of [
    mocks.createRole,
    mocks.updateRole,
    mocks.deleteRole,
    mocks.createHistory,
    mocks.updateHistory,
    mocks.createElection,
    mocks.createAgendaItem,
  ]) {
    mutation.mockResolvedValue(undefined);
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useGroupRoles', () => {
  it('validates required fields and creates recurring assigned or elected group roles', async () => {
    const { result } = renderHook(() => useGroupRoles('group-1'));

    expect(await act(async () => result.current.actions.create())).toEqual({ success: false });
    act(() => {
      result.current.form.setTitle(' Treasurer ');
      result.current.form.setTerm('0');
    });
    expect(await act(async () => result.current.actions.create())).toEqual({ success: false });
    act(() => result.current.form.setTerm('2'));
    expect(await act(async () => result.current.actions.create())).toEqual({ success: false });

    act(() => {
      result.current.form.setFirstTermStart('2026-08-01');
      result.current.form.setDescription(' Finance ');
      result.current.form.setCreateElection(true);
      result.current.dialogs.add.setOpen(true);
    });
    const created = await act(async () => result.current.actions.create());

    expect(created).toMatchObject({ success: true, roleId: expect.any(String) });
    expect(mocks.createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Treasurer',
        description: 'Finance',
        scope: 'group',
        group_id: 'group-1',
        assignment_mode: 'elected',
        recurrence_pattern: 'yearly',
        recurrence_rule: 'FREQ=YEARLY;INTERVAL=2',
        recurrence_interval: 2,
        sort_order: 0,
      })
    );
    expect(mocks.toast.info).toHaveBeenCalledWith(
      'generated.inline.0143_group_role_election_created_as_assignment_4c3da2db'
    );
    expect(result.current.form.title).toBe('');
  });

  it('hydrates edit and auxiliary dialogs and persists update and delete outcomes', async () => {
    const role: any = {
      id: 'role-1',
      title: 'Chair',
      description: 'Leads',
      term: 3,
      first_term_start: new Date(2026, 0, 2).getTime(),
      holder_history: [],
    };
    mocks.roles = [role];
    const { result } = renderHook(() => useGroupRoles('group-1'));

    act(() => result.current.actions.openEdit(role));
    expect(result.current.form).toMatchObject({
      title: 'Chair',
      description: 'Leads',
      term: '3',
      firstTermStart: '2026-01-02',
    });
    act(() => result.current.form.setTitle(' Convener '));
    const updated = await act(async () => result.current.actions.update());
    expect(updated).toEqual({ success: true });
    expect(mocks.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'role-1', name: 'Convener', recurrence_interval: 3 })
    );

    act(() => result.current.actions.openAssignHolder(role));
    expect(result.current.dialogs.assignHolder.open).toBe(true);
    expect(result.current.selectedRole).toBe(role);
    act(() => result.current.actions.openHistory(role));
    expect(result.current.dialogs.history.open).toBe(true);

    expect(await act(async () => result.current.actions.delete('role-1'))).toEqual({
      success: true,
    });
    mocks.deleteRole.mockRejectedValueOnce(new Error('delete failed'));
    expect(await act(async () => result.current.actions.delete('role-1'))).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
  });

  it('atomically ends current holder history before assigning and removes only active holders', async () => {
    const activeHistory = { id: 'history-1', end_date: null };
    mocks.roles = [{ id: 'role-1', holder_history: [activeHistory] }];
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const { result } = renderHook(() => useGroupRoles('group-1'));

    expect(
      await act(async () => result.current.actions.assignHolder('role-1', 'user-1', 'elected'))
    ).toEqual({ success: true });
    expect(mocks.updateHistory).toHaveBeenCalledWith({
      id: 'history-1',
      end_date: 1_800_000_000_000,
    });
    expect(mocks.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: 1_800_000_000_000,
        reason: 'elected',
        role_id: 'role-1',
        user_id: 'user-1',
        end_date: null,
      })
    );

    expect(
      await act(async () => result.current.actions.removeHolder('role-1', 'resigned'))
    ).toEqual({
      success: true,
    });
    expect(mocks.updateHistory).toHaveBeenLastCalledWith({
      id: 'history-1',
      end_date: 1_800_000_000_000,
      reason: 'resigned',
    });

    mocks.roles = [{ id: 'role-2', holder_history: [] }];
    const empty = renderHook(() => useGroupRoles('group-1'));
    expect(await act(async () => empty.result.current.actions.removeHolder('role-2'))).toEqual({
      success: false,
    });
    now.mockRestore();
  });

  it('requires a role and event before creating linked agenda election records', async () => {
    const role: any = { id: 'role-1', title: 'Chair', holder_history: [] };
    mocks.roles = [role];
    const { result } = renderHook(() => useGroupRoles('group-1'));

    expect(
      await act(async () => result.current.actions.createElection('missing', 'event-1'))
    ).toEqual({
      success: false,
    });
    expect(await act(async () => result.current.actions.createElection('role-1'))).toEqual({
      success: false,
      reason: 'event_required',
    });

    const created = await act(async () =>
      result.current.actions.createElection('role-1', 'event-1')
    );
    expect(created).toMatchObject({ success: true, electionId: expect.any(String) });
    expect(mocks.createAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'election', event_id: 'event-1', status: 'pending' })
    );
    expect(mocks.createElection).toHaveBeenCalledWith(
      expect.objectContaining({
        role_id: 'role-1',
        majority_type: 'simple',
        max_votes: 1,
        status: 'pending',
      })
    );
  });

  it('covers assigned-role defaults and create failures with absent role data', async () => {
    mocks.roles = undefined as any;
    const { result } = renderHook(() => useGroupRoles('group-1'));
    expect(result.current.roles).toEqual([]);
    act(() => {
      result.current.form.setTitle('Secretary');
      result.current.form.setTerm('1');
      result.current.form.setFirstTermStart('2026-09-01');
    });
    mocks.createRole.mockRejectedValueOnce(new Error('create failed'));
    const failed = await act(async () => result.current.actions.create());
    expect(failed).toMatchObject({ success: false, error: expect.any(Error) });
    expect(mocks.createRole).toHaveBeenCalledWith(
      expect.objectContaining({ assignment_mode: 'assigned', description: '' })
    );

    act(() => {
      result.current.form.setTitle('Secretary');
      result.current.form.setTerm('1');
      result.current.form.setFirstTermStart('2026-09-01');
    });
    expect(await act(async () => result.current.actions.create())).toMatchObject({ success: true });
  });

  it('covers every update validation and a failed update with empty optional copy', async () => {
    const emptyRole: any = {
      description: null,
      first_term_start: null,
      holder_history: [],
      id: 'role-empty',
      term: null,
      title: null,
    };
    mocks.roles = [emptyRole];
    const { result } = renderHook(() => useGroupRoles('group-1'));

    act(() => result.current.actions.openEdit(emptyRole));
    expect(result.current.form).toMatchObject({ description: '', term: '4', title: '' });
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });

    act(() => {
      result.current.form.setTitle('Updated');
      result.current.form.setTerm('invalid');
    });
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });

    act(() => result.current.form.setTerm('2'));
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });

    act(() => result.current.form.setFirstTermStart('2026-10-01'));
    mocks.updateRole.mockRejectedValueOnce(new Error('update failed'));
    const failed = await act(async () => result.current.actions.update());
    expect(failed).toMatchObject({ success: false, error: expect.any(Error) });
    expect(mocks.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ description: '', is_recurring: true })
    );
  });

  it('covers holder assignment and removal mutation failures', async () => {
    mocks.roles = [{ id: 'role-1', holder_history: [] }];
    const { result } = renderHook(() => useGroupRoles('group-1'));

    mocks.createHistory.mockRejectedValueOnce(new Error('assignment failed'));
    expect(
      await act(async () => result.current.actions.assignHolder('missing', 'user-1'))
    ).toMatchObject({ success: false, error: expect.any(Error) });

    mocks.roles = [{ id: 'role-2', holder_history: [{ id: 'history-2', end_date: null }] }];
    const removal = renderHook(() => useGroupRoles('group-1'));
    mocks.updateHistory.mockRejectedValueOnce(new Error('removal failed'));
    expect(
      await act(async () => removal.result.current.actions.removeHolder('role-2'))
    ).toMatchObject({ success: false, error: expect.any(Error) });
  });

  it('returns a failed result when linked election creation rejects', async () => {
    mocks.roles = [{ id: 'role-1', title: 'Chair', holder_history: [] }];
    const { result } = renderHook(() => useGroupRoles('group-1'));
    mocks.createAgendaItem.mockRejectedValueOnce(new Error('agenda failed'));
    expect(
      await act(async () => result.current.actions.createElection('role-1', 'event-1'))
    ).toMatchObject({ success: false, error: expect.any(Error) });
  });
});

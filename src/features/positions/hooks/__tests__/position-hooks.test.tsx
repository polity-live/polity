/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventRoles } from '../useEventPositions';
import { useGroupRoles } from '../useGroupPositions';

const mocks = vi.hoisted(() => ({
  eventRoles: [] as any[],
  groupRoles: [] as any[],
  createEventRole: vi.fn(),
  updateEventRole: vi.fn(),
  deleteEventRole: vi.fn(),
  createGroupRole: vi.fn(),
  updateGroupRole: vi.fn(),
  deleteGroupRole: vi.fn(),
  createHistory: vi.fn(),
  updateHistory: vi.fn(),
  createElection: vi.fn(),
  createAgendaItem: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventRolesData: () => ({
    event: { id: 'event-1', title: 'Assembly' },
    roles: mocks.eventRoles,
    isLoading: false,
  }),
}));
vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({
    createRole: mocks.createEventRole,
    updateRole: mocks.updateEventRole,
    deleteRole: mocks.deleteEventRole,
  }),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupRoles: () => ({ roles: mocks.groupRoles, isLoading: false }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    createRole: mocks.createGroupRole,
    updateRole: mocks.updateGroupRole,
    deleteRole: mocks.deleteGroupRole,
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
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventRoles = [];
  mocks.groupRoles = [];
  for (const mutation of [
    mocks.createEventRole,
    mocks.updateEventRole,
    mocks.deleteEventRole,
    mocks.createGroupRole,
    mocks.updateGroupRole,
    mocks.deleteGroupRole,
    mocks.createHistory,
    mocks.updateHistory,
    mocks.createElection,
    mocks.createAgendaItem,
  ])
    mutation.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('position hooks', () => {
  it('validates and persists event positions and hydrates edit state', async () => {
    const role: any = { id: 'role-1', title: 'Chair', description: 'Leads' };
    mocks.eventRoles = [role];
    const { result } = renderHook(() => useEventRoles('event-1'));
    await act(async () => result.current.actions.add());
    expect(mocks.toast.error).toHaveBeenCalled();
    act(() => {
      result.current.form.setTitle(' Secretary ');
      result.current.form.setDescription(' Notes ');
      result.current.form.setCapacity('2');
    });
    await act(async () => result.current.actions.add());
    expect(mocks.createEventRole).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Secretary', description: 'Notes', event_id: 'event-1' })
    );
    act(() => result.current.actions.openEdit(role));
    expect(result.current.form).toMatchObject({
      title: 'Chair',
      description: 'Leads',
      capacity: '1',
    });
    await act(async () => result.current.actions.edit());
    expect(mocks.updateEventRole).toHaveBeenCalledWith({
      id: 'role-1',
      name: 'Chair',
      description: 'Leads',
    });
    await act(async () => result.current.actions.delete('role-1'));
    expect(mocks.deleteEventRole).toHaveBeenCalledWith({ id: 'role-1' });
  });

  it('covers event-position capacity boundaries, nullable edits, and mutation failures', async () => {
    const nullableRole: any = { id: 'role-1', title: null, description: null };
    mocks.eventRoles = [nullableRole];
    const { result } = renderHook(() => useEventRoles('event-1'));

    act(() => {
      result.current.form.setTitle('Role');
      result.current.form.setCapacity('invalid');
    });
    await act(async () => result.current.actions.add());
    act(() => result.current.form.setCapacity('0'));
    await act(async () => result.current.actions.add());
    await act(async () => result.current.actions.edit());

    act(() => result.current.actions.openEdit(nullableRole));
    expect(result.current.form).toMatchObject({ title: '', description: '' });
    await act(async () => result.current.actions.edit());
    act(() => {
      result.current.form.setTitle('Edited');
      result.current.form.setCapacity('invalid');
    });
    await act(async () => result.current.actions.edit());
    act(() => result.current.form.setCapacity('0'));
    await act(async () => result.current.actions.edit());

    mocks.createEventRole.mockRejectedValueOnce(new Error('create failed'));
    act(() => {
      result.current.form.setCapacity('1');
      result.current.form.setDescription('Description');
    });
    await act(async () => result.current.actions.add());

    mocks.updateEventRole.mockRejectedValueOnce(new Error('update failed'));
    act(() =>
      result.current.actions.openEdit({ id: 'role-2', title: 'Role 2', description: '' } as never)
    );
    await act(async () => result.current.actions.edit());

    mocks.deleteEventRole.mockRejectedValueOnce(new Error('delete failed'));
    await act(async () => result.current.actions.delete('role-2'));
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it('creates elected group positions and coordinates holder history and election agenda records', async () => {
    const role: any = {
      id: 'role-1',
      title: 'Treasurer',
      term: 2,
      first_term_start: new Date(2026, 0, 1).getTime(),
      holder_history: [{ id: 'history-1', end_date: null }],
    };
    mocks.groupRoles = [role];
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    const { result } = renderHook(() => useGroupRoles('group-1'));
    act(() => {
      result.current.form.setTitle(' Treasurer ');
      result.current.form.setTerm('2');
      result.current.form.setFirstTermStart('2026-01-01');
      result.current.form.setCreateElection(true);
    });
    expect(await act(async () => result.current.actions.create())).toMatchObject({
      success: true,
      roleId: expect.any(String),
    });
    expect(mocks.createGroupRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Treasurer',
        group_id: 'group-1',
        assignment_mode: 'elected',
        recurrence_interval: 2,
      })
    );
    expect(mocks.createElection).toHaveBeenCalled();
    expect(mocks.createAgendaItem).toHaveBeenCalled();

    expect(
      await act(async () => result.current.actions.assignHolder('role-1', 'user-2', 'appointed'))
    ).toEqual({ success: true });
    expect(mocks.updateHistory).toHaveBeenCalledWith({ id: 'history-1', end_date: 2_000_000 });
    expect(mocks.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'role-1', user_id: 'user-2', reason: 'appointed' })
    );
    expect(await act(async () => result.current.actions.removeHolder('role-1'))).toEqual({
      success: true,
    });
    expect(
      await act(async () => result.current.actions.createElection('role-1', 'event-1'))
    ).toMatchObject({
      success: true,
      electionId: expect.any(String),
    });
  });

  it('validates every group-position create boundary', async () => {
    const { result } = renderHook(() => useGroupRoles('group-1'));
    expect(await act(async () => result.current.actions.create())).toEqual({ success: false });

    act(() => {
      result.current.form.setTitle('Chair');
      result.current.form.setTerm('not-a-number');
    });
    expect(await act(async () => result.current.actions.create())).toEqual({ success: false });
    act(() => result.current.form.setTerm('0'));
    expect(await act(async () => result.current.actions.create())).toEqual({ success: false });

    act(() => result.current.form.setTerm('2'));
    expect(await act(async () => result.current.actions.create())).toEqual({ success: false });
    expect(mocks.createGroupRole).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledTimes(4);
  });

  it('creates assigned positions without optional description or election and handles failures', async () => {
    const { result } = renderHook(() => useGroupRoles('group-1'));
    act(() => {
      result.current.form.setTitle(' Chair ');
      result.current.form.setDescription('   ');
      result.current.form.setTerm('3');
      result.current.form.setFirstTermStart('2026-02-01');
    });
    expect(await act(async () => result.current.actions.create())).toMatchObject({ success: true });
    expect(mocks.createGroupRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Chair',
        description: '',
        assignment_mode: 'assigned',
        is_recurring: true,
        recurrence_pattern: 'yearly',
        recurrence_rule: 'FREQ=YEARLY;INTERVAL=3',
        recurrence_interval: 3,
        sort_order: 0,
      })
    );
    expect(mocks.createElection).not.toHaveBeenCalled();

    mocks.createGroupRole.mockRejectedValueOnce(new Error('create failed'));
    act(() => {
      result.current.form.setTitle('Failed role');
      result.current.form.setTerm('2');
      result.current.form.setFirstTermStart('2026-03-01');
    });
    expect(await act(async () => result.current.actions.create())).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
  });

  it('hydrates fallback edit fields, validates updates and persists or reports failures', async () => {
    const role: any = {
      id: 'role-1',
      title: null,
      description: null,
      term: null,
      first_term_start: null,
      holder_history: [],
    };
    mocks.groupRoles = [role];
    const { result } = renderHook(() => useGroupRoles('group-1'));
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });
    act(() => result.current.actions.openEdit(role));
    expect(result.current.form).toMatchObject({ title: '', description: '', term: '4' });
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });

    act(() => {
      result.current.form.setTitle('Updated');
      result.current.form.setTerm('invalid');
    });
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });
    act(() => result.current.form.setTerm('0'));
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });
    act(() => result.current.form.setTerm('2'));
    expect(await act(async () => result.current.actions.update())).toEqual({ success: false });

    act(() => {
      result.current.form.setDescription(' Notes ');
      result.current.form.setFirstTermStart('2026-04-01');
    });
    expect(await act(async () => result.current.actions.update())).toEqual({ success: true });
    expect(mocks.updateGroupRole).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'role-1',
        name: 'Updated',
        description: 'Notes',
        is_recurring: true,
        recurrence_interval: 2,
      })
    );

    act(() => result.current.actions.openEdit({ ...role, title: 'Again', term: 1 }));
    act(() => result.current.form.setFirstTermStart('2026-05-01'));
    mocks.updateGroupRole.mockRejectedValueOnce(new Error('update failed'));
    expect(await act(async () => result.current.actions.update())).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
  });

  it('handles delete, holder assignment and holder removal failures and fallbacks', async () => {
    const role: any = { id: 'role-1', title: 'Chair', holder_history: [] };
    mocks.groupRoles = [role];
    const { result } = renderHook(() => useGroupRoles('group-1'));

    mocks.deleteGroupRole.mockRejectedValueOnce(new Error('delete failed'));
    expect(await act(async () => result.current.actions.delete('role-1'))).toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    mocks.deleteGroupRole.mockResolvedValueOnce(undefined);
    expect(await act(async () => result.current.actions.delete('role-1'))).toEqual({
      success: true,
    });

    expect(await act(async () => result.current.actions.assignHolder('missing', 'user-1'))).toEqual(
      {
        success: true,
      }
    );
    expect(mocks.createHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'appointed', role_id: 'missing' })
    );
    mocks.createHistory.mockRejectedValueOnce(new Error('assign failed'));
    expect(
      await act(async () => result.current.actions.assignHolder('role-1', 'user-1', 'elected'))
    ).toMatchObject({ success: false, error: expect.any(Error) });

    expect(await act(async () => result.current.actions.removeHolder('missing'))).toEqual({
      success: false,
    });
    const occupiedRole = {
      ...role,
      holder_history: [{ id: 'history-1', end_date: null }],
    };
    mocks.groupRoles = [occupiedRole];
    const occupied = renderHook(() => useGroupRoles('group-1'));
    mocks.updateHistory.mockRejectedValueOnce(new Error('remove failed'));
    expect(
      await act(async () => occupied.result.current.actions.removeHolder('role-1', 'resigned'))
    ).toMatchObject({ success: false, error: expect.any(Error) });
  });

  it('handles missing roles, optional events and election creation failures', async () => {
    const role: any = { id: 'role-1', title: 'Chair', holder_history: [] };
    mocks.groupRoles = [role];
    const { result } = renderHook(() => useGroupRoles('group-1'));
    expect(await act(async () => result.current.actions.createElection('missing'))).toEqual({
      success: false,
    });

    expect(await act(async () => result.current.actions.createElection('role-1'))).toMatchObject({
      success: true,
    });
    expect(mocks.createAgendaItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ event_id: null })
    );

    mocks.createElection.mockRejectedValueOnce(new Error('election failed'));
    expect(
      await act(async () => result.current.actions.createElection('role-1', 'event-1'))
    ).toMatchObject({ success: false, error: expect.any(Error) });
  });

  it('opens assignment and history dialogs and resets the form', () => {
    const role: any = { id: 'role-1', title: 'Chair', holder_history: [] };
    mocks.groupRoles = [role];
    const { result } = renderHook(() => useGroupRoles('group-1'));
    act(() => result.current.actions.openAssignHolder(role));
    expect(result.current.selectedRole).toBe(role);
    expect(result.current.dialogs.assignHolder.open).toBe(true);
    act(() => result.current.actions.openHistory(role));
    expect(result.current.dialogs.history.open).toBe(true);
    act(() => {
      result.current.form.setTitle('temporary');
      result.current.form.setDescription('temporary');
      result.current.form.setTerm('9');
      result.current.form.setFirstTermStart('2026-01-01');
      result.current.form.setCreateElection(true);
      result.current.form.reset();
    });
    expect(result.current.form).toMatchObject({
      title: '',
      description: '',
      term: '4',
      firstTermStart: '',
      createElection: false,
    });
  });
});

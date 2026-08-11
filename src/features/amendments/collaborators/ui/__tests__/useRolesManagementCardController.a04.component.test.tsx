/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRolesManagementCardController } from '../useRolesManagementCardController';

describe('useRolesManagementCardController A04 branch accountability', () => {
  afterEach(cleanup);

  it('guards blank names and clears successful role input state', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRolesManagementCardController({
        amendmentId: 'amendment',
        roles: [],
        onCreateRole: create,
        onDeleteRole: vi.fn(),
        onToggleActionRight: vi.fn(),
      })
    );
    await act(async () => result.current.handleAddRole());
    expect(create).not.toHaveBeenCalled();
    act(() => {
      result.current.setNewRoleName('Editor');
      result.current.setNewRoleDescription('Description');
      result.current.setAddRoleDialogOpen(true);
    });
    await act(async () => result.current.handleAddRole());
    expect(create).toHaveBeenCalledWith('Editor', 'Description', 'amendment');
    expect(result.current.newRoleName).toBe('');
    expect(result.current.addRoleDialogOpen).toBe(false);
  });

  it('swallows create, delete, and permission errors', async () => {
    const failure = vi.fn().mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() =>
      useRolesManagementCardController({
        amendmentId: 'amendment',
        roles: [{ id: 'role' }] as any,
        onCreateRole: failure,
        onDeleteRole: failure,
        onToggleActionRight: failure,
      })
    );
    act(() => result.current.setNewRoleName('Editor'));
    await act(async () => result.current.handleAddRole());
    await act(async () => result.current.handleRemoveRole('role'));
    await act(async () =>
      result.current.handleToggleActionRight('role', 'amendments', 'view', false)
    );
  });
});

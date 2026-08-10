/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('../RoleTag', () => ({ RoleTag: ({ roleName }: any) => <span>{roleName}</span> }));

import { RolesPermissionsTableView } from '../RolesPermissionsTableView';
import { useRolesPermissionsTableController } from '../useRolesPermissionsTableController';

afterEach(cleanup);
const base = (overrides: any = {}) => ({
  roles: [],
  onTogglePermission: vi.fn(),
  onReorderRoles: undefined,
  actionRights: [],
  title: 'Permissions',
  description: 'Description',
  isPermissionDisabled: undefined,
  draggedIndex: null,
  setDraggedIndex: vi.fn(),
  dragOverIndex: null,
  setDragOverIndex: vi.fn(),
  dragCounter: { current: 0 },
  actionRightSections: [],
  handleDragStart: vi.fn(),
  handleDragEnter: vi.fn(),
  handleDragLeave: vi.fn(),
  handleDragOver: vi.fn(),
  handleDrop: vi.fn(),
  handleDragEnd: vi.fn(),
  ...overrides,
});

describe('RolesPermissionsTable view/controller branches', () => {
  it('renders empty states with and without an add-role button', () => {
    const { rerender } = render(<RolesPermissionsTableView {...base()} />);
    expect(document.body.textContent).toContain('no_roles_created');
    rerender(<RolesPermissionsTableView {...base({ addRoleButton: <button>Add</button> })} />);
    expect(document.body.textContent).toContain('Add');
  });

  it('renders draggable/non-draggable roles and enabled/disabled rights', () => {
    const toggle = vi.fn();
    const reorder = vi.fn();
    const roles = [
      {
        id: 'a',
        name: '',
        assignment_mode: 'elected',
        action_rights: [{ resource: 'groups', action: 'view' }],
      },
      { id: 'b', name: 'Member', assignment_mode: 'assigned', action_rights: null },
      { id: 'c', name: 'Enabled', assignment_mode: 'assigned', action_rights: null },
    ];
    const sections = [
      {
        id: 'group',
        title: 'Group',
        description: 'Rights',
        rights: [{ resource: 'groups', action: 'view', label: 'View' }],
      },
    ];
    const { container, rerender } = render(
      <RolesPermissionsTableView
        {...base({
          roles,
          onTogglePermission: toggle,
          onReorderRoles: reorder,
          draggedIndex: 0,
          dragOverIndex: 1,
          addRoleButton: <button>Add</button>,
          actionRightSections: sections,
          isPermissionDisabled: (role: any) => (role.id === 'b' ? 'Disabled' : null),
        })}
      />
    );
    const checks = container.querySelectorAll('[data-action-id="groups.roles.permissions.toggle"]');
    fireEvent.click(checks[0]);
    fireEvent.click(checks[2]);
    expect(toggle).toHaveBeenCalledWith('a', 'groups', 'view', true);
    expect(toggle).toHaveBeenCalledWith('c', 'groups', 'view', false);
    const headers = container.querySelectorAll('[draggable="true"]');
    fireEvent.dragStart(headers[0]);
    fireEvent.dragEnter(headers[1]);
    fireEvent.dragLeave(headers[1]);
    fireEvent.dragOver(headers[1]);
    fireEvent.drop(headers[1]);
    fireEvent.dragEnd(headers[0]);
    expect(document.body.textContent).toContain('Role');

    rerender(<RolesPermissionsTableView {...base({ roles, actionRightSections: sections })} />);
    expect(container.querySelector('[draggable="true"]')).toBeNull();
  });

  it('handles every drag controller guard and successful reorder', () => {
    const roles = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as any;
    const reorder = vi.fn();
    const hook = renderHook((props: any) => useRolesPermissionsTableController(props), {
      initialProps: { roles, onTogglePermission: vi.fn(), onReorderRoles: reorder },
    });
    act(() => hook.result.current.handleDrop(0));
    act(() => hook.result.current.handleDragStart(1));
    act(() => hook.result.current.handleDrop(1));
    act(() => {
      hook.result.current.handleDragEnter(0);
      hook.result.current.handleDragEnter(1);
    });
    act(() => hook.result.current.handleDragLeave());
    expect(hook.result.current.dragOverIndex).toBe(1);
    act(() => hook.result.current.handleDragLeave());
    expect(hook.result.current.dragOverIndex).toBeNull();
    const preventDefault = vi.fn();
    hook.result.current.handleDragOver({ preventDefault } as any);
    expect(preventDefault).toHaveBeenCalled();
    act(() => hook.result.current.handleDragStart(0));
    act(() => hook.result.current.handleDrop(2));
    expect(reorder).toHaveBeenCalledWith(['b', 'c', 'a']);
    act(() => hook.result.current.handleDragEnd());

    hook.rerender({ roles, onTogglePermission: vi.fn(), onReorderRoles: undefined as any });
    act(() => hook.result.current.handleDragStart(0));
    act(() => hook.result.current.handleDrop(2));
  });

  it('accepts custom controller labels, rights, disable callback and add button', () => {
    const rights = [{ key: 'x', resource: 'g', action: 'v', label: 'X', section: 'other' }] as any;
    const disabled = vi.fn();
    const { result } = renderHook(() =>
      useRolesPermissionsTableController({
        roles: [],
        onTogglePermission: vi.fn(),
        actionRights: rights,
        title: 'Custom',
        description: 'Custom desc',
        isPermissionDisabled: disabled,
        addRoleButton: <button>Add</button>,
      })
    );
    expect(result.current).toMatchObject({
      title: 'Custom',
      description: 'Custom desc',
      isPermissionDisabled: disabled,
    });
  });
});

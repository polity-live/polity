/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let viewProps: any;
vi.mock('../ChangeRoleDialogView', () => ({
  ChangeRoleDialogView: (props: any) => {
    viewProps = props;
    return <div data-testid="view" />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { ChangeRoleDialog } from '../ChangeRoleDialog';

beforeEach(() => {
  viewProps = null;
});
afterEach(cleanup);
const role = (extra: any = {}) => ({
  id: 'role',
  name: 'Role',
  sort_order: 1,
  action_rights: [],
  ...extra,
});

describe('ChangeRoleDialog controller', () => {
  it('stays reset while closed and initializes only valid current role ids when opened', () => {
    const { rerender } = render(
      <ChangeRoleDialog
        isOpen={false}
        onOpenChange={vi.fn()}
        memberName="Ada"
        currentRoles={[role({ id: '', name: null }), role({ id: 'current', name: null })]}
        roles={[role({ id: 'current', name: null })]}
        onConfirm={vi.fn()}
      />
    );
    expect(viewProps.selectedRoleIds).toEqual([]);
    rerender(
      <ChangeRoleDialog
        isOpen
        onOpenChange={vi.fn()}
        memberName="Ada"
        currentRoles={[role({ id: '', name: null }), role({ id: 'current', name: null })]}
        roles={[role({ id: 'current', name: null })]}
        onConfirm={vi.fn()}
      />
    );
    expect(viewProps.selectedRoleIds).toEqual(['current']);
    expect(viewProps.currentRoleNames).toBe('');
    expect(viewProps.selectedRoleNames).toBe('Role');
  });

  it('adds/removes roles, handles both open-change paths, confirms, and renders rights source variants', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ChangeRoleDialog
        isOpen
        onOpenChange={onOpenChange}
        memberName="Ada"
        currentRoles={[]}
        roles={[role({ id: 'a' }), role({ id: 'b' })]}
        onConfirm={onConfirm}
      />
    );
    act(() => viewProps.toggleRoleSelection('a', true));
    expect(viewProps.selectedRoleIds).toEqual(['a']);
    act(() => viewProps.toggleRoleSelection('b', true));
    act(() => viewProps.toggleRoleSelection('a', false));
    expect(viewProps.selectedRoleIds).toEqual(['b']);
    act(() => viewProps.handleOpenChange(true));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    act(() => viewProps.handleOpenChange(false));
    expect(viewProps.selectedRoleIds).toEqual([]);
    act(() => viewProps.toggleRoleSelection('a', true));
    act(() => viewProps.handleConfirm());
    expect(onConfirm).toHaveBeenCalledWith(['a']);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    const columns = viewProps.rightsColumns;
    const right = {
      key: 'right',
      label: 'Right',
      resource: 'groups',
      action: 'view',
      sources: [
        { roleId: 'direct', roleName: 'Direct', isDirect: true, viaLabel: null },
        { roleId: 'implied', roleName: 'Implied', isDirect: false, viaLabel: 'Parent' },
      ],
    };
    render(
      <>
        {columns[0].cell({ row: { original: right } })}
        {columns[1].cell({ row: { original: right } })}
      </>
    );
    expect(document.body.textContent).toContain('Parent');
  });
});

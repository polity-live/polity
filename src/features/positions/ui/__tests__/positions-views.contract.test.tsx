/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventPositionsView } from '../EventPositionsView';
import { PositionsTableView } from '../PositionsTableView';

const mocks = vi.hoisted(() => ({
  dangerProps: null as any,
  confirmProps: null as any,
  tableProps: null as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
  DangerConfirmDialog: (props: any) => {
    mocks.dangerProps = props;
    return <button onClick={props.onConfirm}>danger-confirm</button>;
  },
  ConfirmDialog: (props: any) => {
    mocks.confirmProps = props;
    return <button onClick={props.onConfirm}>confirm</button>;
  },
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => {
    mocks.tableProps = props;
    return <div>data-table:{props.data.length}</div>;
  },
}));
vi.mock('@/features/shared/ui/layout', () => ({
  Panel: ({ children }: any) => <section>{children}</section>,
  PanelContent: ({ children }: any) => <div>{children}</div>,
  PanelDescription: ({ children }: any) => <p>{children}</p>,
  PanelHeader: ({ children }: any) => <header>{children}</header>,
  PanelTitle: ({ children }: any) => <h2>{children}</h2>,
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.dangerProps = null;
  mocks.confirmProps = null;
  mocks.tableProps = null;
});

describe('position views', () => {
  it('wires add, edit, cancel, data-table, and guarded delete actions in the event view', () => {
    const dialogs = {
      add: { open: false, setOpen: vi.fn() },
      edit: { open: true, setOpen: vi.fn() },
    };
    const form = { reset: vi.fn() };
    const actions = { add: vi.fn(), edit: vi.fn(), delete: vi.fn() };
    const setPendingDeleteRoleId = vi.fn();
    const { rerender } = render(
      <EventPositionsView
        eventId="event-1"
        event={{ title: 'Assembly' }}
        roles={[{ id: 'role-1', title: 'Chair' }]}
        dialogs={dialogs}
        form={form}
        actions={actions}
        pendingDeleteRoleId="role-1"
        setPendingDeleteRoleId={setPendingDeleteRoleId}
        renderRoleFormFields={(prefix: string) => <div>fields:{prefix}</div>}
        pendingDeleteRole={{ id: 'role-1', title: 'Chair' }}
        roleColumns={[]}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'generated.inline.0125_add_role_82d0afcc' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'generated.inline.0132_create_role_5bea05a8' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'generated.inline.1046_save_changes_fa2984b3' })
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'generated.inline.0065_cancel_77dfd213' })[0]
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'generated.inline.0065_cancel_77dfd213' })[1]
    );
    expect(form.reset).toHaveBeenCalled();
    expect(actions.add).toHaveBeenCalled();
    expect(actions.edit).toHaveBeenCalled();
    expect(dialogs.add.setOpen).toHaveBeenCalledWith(false);
    expect(dialogs.edit.setOpen).toHaveBeenCalledWith(false);
    expect(mocks.tableProps).toMatchObject({
      data: [{ id: 'role-1', title: 'Chair' }],
      enablePagination: false,
    });
    expect(mocks.tableProps.getRowId({ id: 'role-1' })).toBe('role-1');
    mocks.dangerProps.onOpenChange(true);
    mocks.dangerProps.onOpenChange(false);
    expect(setPendingDeleteRoleId).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'danger-confirm' }));
    expect(actions.delete).toHaveBeenCalledWith('role-1');
    expect(setPendingDeleteRoleId).toHaveBeenCalledWith(null);

    rerender(
      <EventPositionsView
        eventId="event-1"
        event={null}
        roles={[]}
        dialogs={dialogs}
        form={form}
        actions={actions}
        pendingDeleteRoleId={null}
        setPendingDeleteRoleId={setPendingDeleteRoleId}
        renderRoleFormFields={() => null}
        pendingDeleteRole={null}
        roleColumns={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'danger-confirm' }));
    expect(actions.delete).toHaveBeenCalledTimes(1);
  });

  it('renders management controls and delegates table and confirmation contracts', () => {
    const onDelete = vi.fn();
    const onRemove = vi.fn();
    const baseProps = {
      positions: [{ id: 'role-1' }],
      canManage: true,
      addPositionButton: <button>add position</button>,
      deleteConfirmOpen: true,
      setDeleteConfirmOpen: vi.fn(),
      removeHolderConfirmOpen: true,
      setRemoveHolderConfirmOpen: vi.fn(),
      selectedPosition: { id: 'role-1', title: 'Chair', currentHolder: { fullName: 'Ada' } },
      handleDeleteConfirm: onDelete,
      handleRemoveHolderConfirm: onRemove,
      columns: [],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onAssignHolder: vi.fn(),
      onRemoveHolder: vi.fn(),
      onViewHistory: vi.fn(),
      onCreateElection: vi.fn(),
      setSelectedPosition: vi.fn(),
      handleDeleteClick: vi.fn(),
      handleRemoveHolderClick: vi.fn(),
      getTermEndDate: vi.fn(),
      isTermExpiring: vi.fn(),
      isTermExpired: vi.fn(),
      actionColumns: [],
    };
    const { rerender } = render(<PositionsTableView {...(baseProps as any)} />);
    expect(screen.getByRole('button', { name: 'add position' })).toBeTruthy();
    expect(mocks.tableProps).toMatchObject({ data: [{ id: 'role-1' }], enablePagination: false });
    expect(mocks.tableProps.getRowId({ id: 'role-1' })).toBe('role-1');
    expect(mocks.dangerProps.description.props.children).toEqual(expect.any(Array));
    fireEvent.click(screen.getByRole('button', { name: 'danger-confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    expect(onDelete).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();

    rerender(
      <PositionsTableView
        {...(baseProps as any)}
        canManage={false}
        selectedPosition={{
          id: 'role-1',
          title: 'Chair',
          currentHolder: { fullName: '', handle: 'ada' },
        }}
      />
    );
    expect(screen.queryByRole('button', { name: 'add position' })).toBeNull();
    rerender(
      <PositionsTableView
        {...(baseProps as any)}
        canManage
        addPositionButton={null}
        selectedPosition={{ id: 'role-1', title: 'Chair', currentHolder: null }}
      />
    );
  });
});

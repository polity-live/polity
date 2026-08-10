/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventPositions } from '../EventPositions';
import { PositionHolderHistoryDialog } from '../PositionHolderHistoryDialog';
import { PositionsTable } from '../PositionsTable';

const mocks = vi.hoisted(() => ({
  eventViewProps: null as any,
  positionsViewProps: null as any,
  historyProps: null as any,
  eventHook: null as any,
}));

vi.mock('../../hooks/useEventPositions', () => ({ useEventRoles: () => mocks.eventHook }));
vi.mock('../EventPositionsView', () => ({
  EventPositionsView: (props: any) => {
    mocks.eventViewProps = props;
    return <div>event-positions-view:{props.pendingDeleteRole?.title ?? 'none'}</div>;
  },
}));
vi.mock('../PositionsTableView', () => ({
  PositionsTableView: (props: any) => {
    mocks.positionsViewProps = props;
    return <div>positions-table-view:{props.selectedPosition?.title ?? 'none'}</div>;
  },
}));
vi.mock('@/features/shared/ui/participation', () => ({
  HolderHistoryDialog: (props: any) => {
    mocks.historyProps = props;
    return <div>holder-history</div>;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/form', () => ({
  ChoiceField: () => null,
  ValidatedField: () => null,
}));
vi.mock('@/features/shared/ui/status', () => ({
  CountBadge: ({ count }: any) => <span>{count}</span>,
  StatusBadge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: () => null,
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventViewProps = null;
  mocks.positionsViewProps = null;
  mocks.historyProps = null;
  mocks.eventHook = {
    event: { id: 'event-1', title: 'Assembly' },
    roles: [
      {
        id: 'role-1',
        title: 'Chair',
        description: 'Leads',
        holders: [{ id: 'holder-1', user: { first_name: 'Ada', last_name: 'Lovelace' } }],
      },
    ],
    dialogs: {
      add: { open: false, setOpen: vi.fn() },
      edit: { open: false, setOpen: vi.fn() },
    },
    form: {
      title: '',
      setTitle: vi.fn(),
      description: '',
      setDescription: vi.fn(),
      capacity: '1',
      setCapacity: vi.fn(),
      createElection: false,
      setCreateElection: vi.fn(),
      reset: vi.fn(),
    },
    actions: { add: vi.fn(), edit: vi.fn(), delete: vi.fn(), openEdit: vi.fn() },
  };
});

describe('position controller components', () => {
  it('builds event-position columns and preserves edit and delete request effects', () => {
    render(<EventPositions eventId="event-1" />);
    expect(mocks.eventViewProps).toMatchObject({
      eventId: 'event-1',
      event: { id: 'event-1', title: 'Assembly' },
      pendingDeleteRole: null,
    });
    const role = mocks.eventHook.roles[0];
    const actionsCell = mocks.eventViewProps.roleColumns[4].cell;
    const { rerender } = render(actionsCell({ row: { original: role } }));
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(mocks.eventHook.actions.openEdit).toHaveBeenCalledWith(role);
    fireEvent.click(buttons[1]);
    expect(mocks.eventViewProps.pendingDeleteRole).toBe(role);
    rerender(mocks.eventViewProps.roleColumns[1].cell({ row: { original: role } }));
    expect(screen.getByText('1 / 1')).toBeTruthy();
  });

  it('renders event-position field and column fallbacks for sparse and crowded roles', () => {
    const sparseRole: any = { id: 'sparse', title: 'Sparse', description: null };
    const crowdedRole: any = {
      id: 'crowded',
      title: 'Crowded',
      description: 'Description',
      holders: [
        { id: 'one', user: null },
        { id: 'two', user: { first_name: '', last_name: '', avatar: null } },
        { id: 'three', user: { first_name: 'Ada', last_name: null, avatar: 'avatar' } },
        { id: 'four', user: { first_name: 'Grace', last_name: 'Hopper' } },
      ],
    };
    mocks.eventHook.roles = [sparseRole, crowdedRole];
    render(<EventPositions eventId="event-1" />);
    expect(mocks.eventViewProps.renderRoleFormFields('test')).toBeTruthy();

    const [roleColumn, capacityColumn, holdersColumn, electionColumn] =
      mocks.eventViewProps.roleColumns;
    const cell = render(roleColumn.cell({ row: { original: sparseRole } }));
    cell.rerender(roleColumn.cell({ row: { original: crowdedRole } }));
    cell.rerender(capacityColumn.cell({ row: { original: sparseRole } }));
    expect(screen.getByText('0 / 1')).toBeTruthy();
    cell.rerender(holdersColumn.cell({ row: { original: sparseRole } }));
    expect(screen.getByText('generated.inline.1053_no_holders_yet_40094d22')).toBeTruthy();
    cell.rerender(
      holdersColumn.cell({
        row: { original: { ...sparseRole, holders: [{ id: 'single', user: null }] } },
      })
    );
    cell.rerender(holdersColumn.cell({ row: { original: crowdedRole } }));
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getAllByText('?')).toHaveLength(2);
    cell.rerender(electionColumn.cell({ row: { original: sparseRole } }));
    expect(screen.getByText('generated.inline.1054_manual_4e836fdc')).toBeTruthy();
  });

  it('adapts holder history and position-table actions, confirmations, and term boundaries', () => {
    const role: any = {
      id: 'role-1',
      title: 'Chair',
      term: 1,
      first_term_start: new Date(2025, 0, 1).getTime(),
      assignment_mode: 'assigned',
      currentHolder: { id: 'user-1', fullName: 'Ada Lovelace', source: 'incumbent' },
      holder_history: [],
      elections: [],
    };
    const callbacks = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onAssignHolder: vi.fn(),
      onRemoveHolder: vi.fn(),
      onViewHistory: vi.fn(),
      onCreateElection: vi.fn(),
    };
    render(
      <PositionsTable
        positions={[role]}
        canManage
        addPositionButton={<button>add</button>}
        {...callbacks}
      />
    );
    expect(mocks.positionsViewProps.getTermEndDate(role).getFullYear()).toBe(2026);
    const actionCell = mocks.positionsViewProps.actionColumns[0].cell;
    const actionRender = render(actionCell({ row: { original: role } }));
    fireEvent.click(document.querySelector('[data-action-id="positions.table.history.open"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="positions.table.holder.remove-request"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="positions.table.election.create"]')!);
    fireEvent.click(document.querySelector('[data-action-id="positions.table.position.edit"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="positions.table.position.delete-request"]')!
    );
    expect(callbacks.onViewHistory).toHaveBeenCalledWith(role);
    expect(callbacks.onCreateElection).toHaveBeenCalledWith('role-1');
    expect(callbacks.onEdit).toHaveBeenCalledWith(role);
    expect(mocks.positionsViewProps.removeHolderConfirmOpen).toBe(true);
    act(() => mocks.positionsViewProps.handleRemoveHolderConfirm());
    expect(callbacks.onRemoveHolder).toHaveBeenCalledWith('role-1');
    actionRender.rerender(actionCell({ row: { original: { ...role, currentHolder: null } } }));
    fireEvent.click(document.querySelector('[data-action-id="positions.table.holder.assign"]')!);
    expect(callbacks.onAssignHolder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'role-1', currentHolder: null })
    );
    actionRender.unmount();

    act(() => mocks.positionsViewProps.handleDeleteClick(role));
    expect(mocks.positionsViewProps.deleteConfirmOpen).toBe(true);
    act(() => mocks.positionsViewProps.handleDeleteConfirm());
    expect(callbacks.onDelete).toHaveBeenCalledWith('role-1');

    cleanup();
    render(<PositionHolderHistoryDialog open role={role} onOpenChange={vi.fn()} />);
    expect(mocks.historyProps).toMatchObject({ open: true, role });
  });

  it('covers position-table guards, term windows, column fallbacks, and elected actions', () => {
    const callbacks = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onAssignHolder: vi.fn(),
      onRemoveHolder: vi.fn(),
      onViewHistory: vi.fn(),
      onCreateElection: vi.fn(),
    };
    const baseRole: any = {
      id: 'role-1',
      title: 'Role',
      description: null,
      assignment_mode: 'assigned',
      currentHolder: null,
      elections: undefined,
    };
    const { rerender } = render(<PositionsTable positions={[baseRole]} canManage {...callbacks} />);
    act(() => {
      mocks.positionsViewProps.handleDeleteConfirm();
      mocks.positionsViewProps.handleRemoveHolderConfirm();
    });
    expect(callbacks.onDelete).not.toHaveBeenCalled();
    expect(callbacks.onRemoveHolder).not.toHaveBeenCalled();

    expect(mocks.positionsViewProps.getTermEndDate(baseRole)).toBeNull();
    expect(
      mocks.positionsViewProps.getTermEndDate({ ...baseRole, first_term_start: Date.now() })
    ).toBeNull();
    expect(mocks.positionsViewProps.isTermExpiring(baseRole)).toBe(false);
    expect(mocks.positionsViewProps.isTermExpired(baseRole)).toBe(false);

    const now = Date.now();
    const year = 365 * 24 * 60 * 60 * 1000;
    const expired = { ...baseRole, term: 1, first_term_start: now - 2 * year };
    const expiring = { ...baseRole, term: 1, first_term_start: now - (11 * year) / 12 };
    const future = { ...baseRole, term: 2, first_term_start: now };
    expect(mocks.positionsViewProps.isTermExpired(expired)).toBe(true);
    expect(mocks.positionsViewProps.isTermExpiring(expired)).toBe(false);
    expect(mocks.positionsViewProps.isTermExpiring(expiring)).toBe(true);
    expect(mocks.positionsViewProps.isTermExpiring(future)).toBe(false);
    expect(mocks.positionsViewProps.isTermExpired(future)).toBe(false);

    const [roleColumn, holderColumn, termColumn, electionColumn] = mocks.positionsViewProps.columns;
    const cell = render(roleColumn.cell({ row: { original: baseRole } }));
    cell.rerender(roleColumn.cell({ row: { original: { ...baseRole, description: 'Details' } } }));
    cell.rerender(holderColumn.cell({ row: { original: baseRole } }));
    expect(screen.getByText('generated.inline.1070_vacant_1966f967')).toBeTruthy();
    cell.rerender(
      holderColumn.cell({
        row: {
          original: {
            ...baseRole,
            currentHolder: {
              id: 'holder-1',
              fullName: null,
              handle: 'ada',
              imageURL: null,
              source: 'membership',
            },
          },
        },
      })
    );
    expect(screen.getByText('ada')).toBeTruthy();
    expect(
      screen.getByText('generated.inline.1069_assigned_through_active_membership_4a4709b9')
    ).toBeTruthy();
    cell.rerender(
      holderColumn.cell({
        row: {
          original: {
            ...baseRole,
            currentHolder: { id: 'holder-2', fullName: null, handle: null, source: null },
          },
        },
      })
    );
    expect(screen.getByText('U')).toBeTruthy();

    for (const role of [baseRole, expired, expiring, future]) {
      cell.rerender(termColumn.cell({ row: { original: role } }));
    }
    cell.rerender(electionColumn.cell({ row: { original: baseRole } }));
    expect(screen.getByText('generated.inline.1075_no_active_elections_c0f7abb8')).toBeTruthy();
    cell.rerender(
      electionColumn.cell({
        row: { original: { ...baseRole, elections: [{ status: 'inactive' }] } },
      })
    );
    cell.rerender(
      electionColumn.cell({
        row: {
          original: { ...baseRole, elections: [{ status: 'active' }, { status: 'pending' }] },
        },
      })
    );
    expect(screen.getByText('2')).toBeTruthy();

    const actionCell = mocks.positionsViewProps.actionColumns[0].cell;
    cell.rerender(
      actionCell({
        row: { original: { ...baseRole, assignment_mode: 'elected', currentHolder: null } },
      })
    );
    expect(
      document
        .querySelector('[data-action-id="positions.table.holder.assign"]')
        ?.hasAttribute('disabled')
    ).toBe(true);
    cell.rerender(
      actionCell({
        row: {
          original: {
            ...baseRole,
            currentHolder: { id: 'member', source: 'membership' },
          },
        },
      })
    );
    expect(
      document.querySelector('[data-action-id="positions.table.holder.remove-request"]')
    ).toBeNull();

    rerender(<PositionsTable positions={[baseRole]} canManage={false} {...callbacks} />);
    expect(mocks.positionsViewProps.actionColumns).toEqual([]);
  });
});

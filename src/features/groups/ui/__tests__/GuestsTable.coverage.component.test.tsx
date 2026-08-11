/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ local: null as any, virtual: null as any }));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => {
    mocks.local = props;
    return <div data-testid="local-table" />;
  },
  VirtualDataTable: (props: any) => {
    mocks.virtual = props;
    return <div data-testid="virtual-table" />;
  },
  EntityCell: ({ title, description, leading }: any) => (
    <div>
      {leading}
      {title}
      <span>{description}</span>
    </div>
  ),
  TableActionIconButton: ({ label, onClick, ...props }: any) => (
    <button {...props} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => (
    <a href="#" {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../RoleTag', () => ({
  RoleTag: ({ children, roleName }: any) => <span data-testid="role">{roleName ?? children}</span>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : key),
}));

import { GuestsTable } from '../GuestsTable';

beforeEach(() => {
  mocks.local = null;
  mocks.virtual = null;
});
afterEach(cleanup);

const guest = (extra: any = {}) => ({
  id: 'guest',
  status: 'active',
  user: null,
  roles: null,
  ...extra,
});

describe('GuestsTable branches', () => {
  it('uses the local table defaults and renders all user, status, and role variants', () => {
    render(<GuestsTable guests={[guest()]} />);
    expect(mocks.local.getRowId(guest({ id: 'id' }))).toBe('id');
    const columns = mocks.local.columns;
    const userColumn = columns.find((column: any) => column.id === 'user');
    const statusColumn = columns.find((column: any) => column.id === 'status');
    const rolesColumn = columns.find((column: any) => column.id === 'roles');
    const actionColumn = columns.find((column: any) => column.id === 'actions');
    const nodes = [
      userColumn.cell({ row: { original: guest() } }),
      userColumn.cell({
        row: {
          original: guest({
            user: { id: 'u', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@test' },
          }),
        },
      }),
      userColumn.cell({
        row: {
          original: guest({
            user: { id: null, first_name: null, last_name: null, email: 'mail@test' },
          }),
        },
      }),
      userColumn.cell({ row: { original: guest({ user: {} }) } }),
      ...['active', 'invited', 'requested', 'other'].map(status =>
        statusColumn.cell({ row: { original: guest({ status }) } })
      ),
      rolesColumn.cell({ row: { original: guest() } }),
      rolesColumn.cell({
        row: {
          original: guest({
            roles: [
              { id: 'r', name: 'Named' },
              { id: null, name: null },
            ],
          }),
        },
      }),
      actionColumn.cell({ row: { original: guest({ status: 'active' }) } }),
    ];
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toContain('Ada Lovelace');
    expect(container.textContent).toContain('mail@test');
    expect(container.textContent).toContain('Unknown');
    expect(container.textContent).toContain('Named');
  });

  it('adds the base-group column and wires requested approval and revocation', () => {
    const approve = vi.fn();
    const revoke = vi.fn();
    const source = {} as any;
    render(
      <GuestsTable
        guests={[]}
        showBaseGroupColumn
        title="Guests"
        description="Description"
        virtualSource={source}
        onApprove={approve}
        onRevoke={revoke}
      />
    );
    expect(mocks.virtual.source).toBe(source);
    const columns = mocks.virtual.columns;
    const base = columns.find((column: any) => column.id === 'baseGroup');
    const actions = columns.find((column: any) => column.id === 'actions');
    const requested = guest({
      id: 'requested',
      status: 'requested',
      baseGroup: null,
      provenanceBucketLabel: 'Direct',
    });
    const linked = guest({
      id: 'active',
      status: 'active',
      baseGroup: { id: 'base', name: 'Base' },
    });
    const { container } = render(
      <>
        {base.header()}
        {base.cell({ row: { original: requested } })}
        {base.cell({ row: { original: linked } })}
        {actions.cell({ row: { original: requested } })}
        {actions.cell({ row: { original: linked } })}
      </>
    );
    const approveButton = container.querySelector(
      '[data-action-id="groups.guests.approve.request"]'
    )!;
    const revokeButtons = container.querySelectorAll(
      '[data-action-id="groups.guests.revoke.access"]'
    );
    fireEvent.click(approveButton);
    fireEvent.click(revokeButtons[0]);
    fireEvent.click(revokeButtons[1]);
    expect(approve).toHaveBeenCalledWith('requested');
    expect(revoke).toHaveBeenCalledWith('requested');
    expect(revoke).toHaveBeenCalledWith('active');
  });

  it('omits requested actions when callbacks are absent', () => {
    render(<GuestsTable guests={[]} />);
    const action = mocks.local.columns.find((column: any) => column.id === 'actions');
    const { container } = render(
      <>{action.cell({ row: { original: guest({ status: 'requested' }) } })}</>
    );
    expect(container.querySelector('button')).toBeNull();
  });
});

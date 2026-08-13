/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let tableProps: any;
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => {
    tableProps = props;
    return <div />;
  },
  TableActionIconButton: ({ label, onClick, ...props }: any) => (
    <button {...props} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: any) => <a href="#">{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : key),
}));
vi.mock('../RoleTag', () => ({ RoleTag: ({ roleName }: any) => <span>{roleName}</span> }));
vi.mock('@/features/groups/logic/openAssignments', () => ({
  getNextRoleElectionEvent: (role: any) => role.nextEvent ?? null,
}));
vi.mock('@/features/groups/logic/roleFormHelpers', () => ({ formatRoleTermLabel: () => 'Term' }));

import { RoleDetailsTable } from '../RoleDetailsTable';

afterEach(cleanup);
const role = (extra: any = {}) => ({
  id: 'role',
  title: null,
  description: null,
  visibility: null,
  assignment_mode: 'assigned',
  action_rights: null,
  elections: null,
  ...extra,
});

describe('RoleDetailsTable branch cells', () => {
  it('renders group term/event/default/visibility/assignment variants', () => {
    render(<RoleDetailsTable roles={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(tableProps.getRowId(role({ id: 'id' }))).toBe('id');
    const columns = tableProps.columns;
    const byId = (id: string) => columns.find((column: any) => column.id === id);
    const rows = [
      role(),
      role({
        title: 'Chair',
        description: 'Description',
        visibility: 'authenticated',
        assignment_mode: 'elected',
        action_rights: [],
        default_request_role: true,
        default_invite_role: true,
        scheduled_revote_date: 1,
        first_term_start: 2,
        elections: [{ status: 'active' }],
        nextEvent: { id: 'event', title: 'Event', start_date: 3, group: null },
      }),
      role({ visibility: 'public', elections: [{ status: 'pending' }] }),
      role({ elections: [{ status: 'closed' }] }),
    ];
    const nodes = rows.flatMap(item =>
      ['role', 'visibility', 'assignment', 'defaults', 'term'].map(id =>
        byId(id).cell({ row: { original: item } })
      )
    );
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toContain('Untitled role');
    expect(container.textContent).toContain('Description');
    expect(container.textContent).toContain('Starts');
    expect(container.textContent).toContain('no_start_date');
    expect(container.querySelector('a')).toBeTruthy();
  });

  it('covers every optional management callback and event/group election action', () => {
    const edit = vi.fn();
    const remove = vi.fn();
    const assign = vi.fn();
    const history = vi.fn();
    const groupElection = vi.fn();
    render(
      <RoleDetailsTable
        roles={[]}
        onEdit={edit}
        onDelete={remove}
        onAssignHolder={assign}
        onViewHistory={history}
        onOpenElectionAssignment={groupElection}
      />
    );
    let manage = tableProps.columns.find((column: any) => column.id === 'manage');
    let view = render(
      <>
        {manage.cell({ row: { original: role() } })}
        {manage.cell({ row: { original: role({ currentHolder: { source: 'membership' } }) } })}
        {manage.cell({ row: { original: role({ assignment_mode: 'elected' }) } })}
      </>
    );
    view.container
      .querySelectorAll('button:not([disabled])')
      .forEach(button => fireEvent.click(button));
    expect(assign).toHaveBeenCalled();
    expect(history).toHaveBeenCalled();
    expect(groupElection).toHaveBeenCalled();
    view.unmount();
    cleanup();

    render(<RoleDetailsTable roles={[]} onEdit={edit} onDelete={remove} />);
    manage = tableProps.columns.find((column: any) => column.id === 'manage');
    view = render(<>{manage.cell({ row: { original: role({ assignment_mode: 'elected' }) } })}</>);
    expect(
      view.container.querySelector('[data-action-id="groups.roles.create.election"]')
    ).toBeNull();
    view.unmount();
    cleanup();

    const eventElection = vi.fn();
    render(
      <RoleDetailsTable
        roles={[]}
        scope="event"
        onEdit={edit}
        onDelete={remove}
        onCreateElection={eventElection}
      />
    );
    manage = tableProps.columns.find((column: any) => column.id === 'manage');
    const roleColumn = tableProps.columns.find((column: any) => column.id === 'role');
    view = render(
      <>
        {roleColumn.cell({ row: { original: role() } })}
        {manage.cell({ row: { original: role() } })}
        {manage.cell({ row: { original: role({ assignment_mode: 'elected' }) } })}
      </>
    );
    view.container.querySelectorAll('button').forEach(button => fireEvent.click(button));
    expect(eventElection).toHaveBeenCalled();
  });
});

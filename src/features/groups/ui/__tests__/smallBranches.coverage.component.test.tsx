/* @vitest-environment jsdom */

import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  group: undefined as any,
  user: undefined as any,
  geoProps: undefined as any,
  dataTableProps: undefined as any,
  virtualTableProps: undefined as any,
  editController: vi.fn((props: any) => props),
  addLink: vi.fn(),
  deleteBlog: vi.fn(),
  preflight: vi.fn(() => ({ response: null, blocking: false, isLoading: false })),
  actionProps: [] as any[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/groups/hooks/useGroupData', () => ({
  useGroupData: () => ({ group: mocks.group }),
}));
vi.mock('@/features/groups/hooks/useAmendmentFilters', () => ({
  useAmendmentFilters: () => ({
    filters: { status: 'all' },
    showFilters: false,
    hasActiveFilters: false,
    updateFilter: vi.fn(),
    clearFilter: vi.fn(),
    setShowFilters: vi.fn(),
  }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/groups/useGroupState', () => ({ useGroupById: () => ({ group: mocks.group }) }));
vi.mock('@/features/network/hooks/useGroupLinks', () => ({
  useGroupLinks: () => ({ links: ['link'], addLink: mocks.addLink }),
}));
vi.mock('@/features/groups/hooks/useGroupPayments', () => ({
  useGroupPayments: () => ({ payments: ['payment'] }),
}));
vi.mock('@/features/groups/hooks/useFinancialData', () => ({
  useFinancialData: () => ({
    summary: 'summary',
    incomeData: ['income'],
    expenditureData: ['expense'],
  }),
}));
vi.mock('@/features/groups/hooks/useGroupTodos', () => ({
  useGroupTodos: () => ({ todos: ['todo'], toggleTodoComplete: vi.fn() }),
}));
vi.mock('@/features/groups/hooks/useGroupBlogsAndStatementsPage', () => ({
  useGroupBlogsAndStatementsPage: () => ({
    blogs: [],
    statements: [],
    filter: 'all',
    setFilter: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
  }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ canCreate: () => true, canManage: () => false }),
}));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({ deleteBlog: mocks.deleteBlog }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../useGroupEditFormController', () => ({
  useGroupEditFormController: mocks.editController,
}));
vi.mock('../GroupEditFormView', () => ({
  GroupEditFormView: (props: any) => <div data-can-manage={String(props.canManageGroup)} />,
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => {
    mocks.dataTableProps = props;
    return <div data-testid="data-table" />;
  },
  VirtualDataTable: (props: any) => {
    mocks.virtualTableProps = props;
    return <div data-testid="virtual-table" />;
  },
  TableActionIconButton: (props: any) => {
    mocks.actionProps.push(props);
    return (
      <button data-testid={props['data-action-id']} disabled={props.disabled}>
        {props.label}
      </button>
    );
  },
}));
vi.mock('@/features/shared/ui/form', () => ({
  ManagementSection: ({ children }: any) => <section>{children}</section>,
  FormControlInput: (props: any) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/status', () => ({
  CountBadge: ({ count }: any) => <span>{count}</span>,
  EntityBadge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  StatusBadge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  RoleBadge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));
vi.mock('@/features/shared/theme', () => ({ getRoleToneClasses: () => ({ badge: 'tone' }) }));
vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: any) => <div>{group.name}</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  SectionSkeleton: ({ label }: any) => <div>{label}</div>,
}));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({
  GeoAddressPicker: (props: any) => {
    mocks.geoProps = props;
    return <div data-testid="geo" />;
  },
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/layout', () => ({
  Panel: ({ children }: any) => <div>{children}</div>,
  PanelContent: ({ children }: any) => <div>{children}</div>,
  PanelDescription: ({ children }: any) => <p>{children}</p>,
  PanelHeader: ({ children }: any) => <header>{children}</header>,
  PanelTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('../GroupConflictPanel', () => ({
  GroupConflictDialog: ({ title }: any) => <div>{title}</div>,
}));
vi.mock('../../hooks/useGroupConflictPreflight', () => ({
  useGroupConflictPreflight: mocks.preflight,
}));

import { useAddTodoDialogController } from '../../hooks/useAddTodoDialogController';
import { useGroupAmendmentsPage } from '../../hooks/useGroupAmendmentsPage';
import { useGroupOperationPage } from '../../hooks/useGroupOperationPage';
import { useGroupBlogsAndStatementsPageController } from '../useGroupBlogsAndStatementsPageController';
import { GroupEditForm } from '../GroupEditForm';
import { PendingRequestsTableView } from '../PendingRequestsTableView';
import { GroupsList } from '../GroupsList';
import { LocationInfoSection } from '../LocationInfoSection';
import { GroupTypeSection } from '../GroupTypeSection';
import { GroupsFilters } from '../GroupsFilters';
import { RoleTag } from '../RoleTag';
import { PendingRequestActionCell } from '../PendingRequestActionCell';
import { PendingRequestActionCellView } from '../PendingRequestActionCellView';

beforeEach(() => {
  mocks.group = undefined;
  mocks.user = undefined;
  mocks.geoProps = undefined;
  mocks.actionProps.length = 0;
  mocks.addLink.mockReset();
  mocks.deleteBlog.mockReset();
  mocks.preflight.mockClear();
  mocks.editController.mockClear();
});
afterEach(cleanup);

describe('small group branch surfaces', () => {
  it('resets the todo controller and clears time only for an empty due date', () => {
    const submit = vi.fn();
    const { result } = renderHook(() => useAddTodoDialogController({ onSubmit: submit }));
    act(() => {
      result.current.onTitleChange('Todo');
      result.current.onDescriptionChange('Desc');
      result.current.onPriorityChange('high');
      result.current.onDueDateChange('2026-08-10');
      result.current.onDueTimeChange('12:00');
    });
    act(() => result.current.onDueDateChange(''));
    act(() => result.current.onSubmit({ preventDefault: vi.fn() } as any));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Todo', dueDate: '', dueTime: '' })
    );
    expect(result.current.title).toBe('');
  });

  it('covers absent and present group/user fallbacks in page hooks', async () => {
    const amendments = renderHook(() => useGroupAmendmentsPage({ groupId: 'g' }));
    expect(amendments.result.current.groupName).toBeUndefined();
    mocks.group = { name: 'Group' };
    amendments.rerender();
    expect(amendments.result.current.groupName).toBe('Group');

    mocks.user = { id: 'user' };
    const operation = renderHook(() => useGroupOperationPage('g'));
    await act(async () =>
      operation.result.current.handleAddLink({ label: 'Site', url: 'https://example.test' })
    );
    expect(mocks.addLink).toHaveBeenCalledWith('Site', 'https://example.test', 'user');
    mocks.user = undefined;
    mocks.group = undefined;
    operation.rerender();
    await act(async () => operation.result.current.handleAddLink({ label: 'Site', url: 'url' }));
    expect(mocks.addLink).toHaveBeenLastCalledWith('Site', 'url', undefined);
    expect(operation.result.current.groupName).toBe('');
  });

  it('covers cancel, successful delete, and failed delete in the blog controller', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(() => useGroupBlogsAndStatementsPageController({ groupId: 'g' }));
    await act(async () => result.current.handleDeleteBlog('one'));
    expect(mocks.deleteBlog).not.toHaveBeenCalled();
    confirmMock.mockReturnValue(true);
    mocks.deleteBlog.mockResolvedValueOnce(undefined);
    await act(async () => result.current.handleDeleteBlog('two'));
    mocks.deleteBlog.mockRejectedValueOnce(new Error('fail'));
    await act(async () => result.current.handleDeleteBlog('three'));
    expect(result.current.getEditorUrl('blog')).toBe('/group/g/blog/blog/editor');
    confirmMock.mockRestore();
  });

  it('covers wrapper defaults, request table variants, and all group list states', () => {
    const edit = render(<GroupEditForm groupId="g" />);
    expect(mocks.editController).toHaveBeenLastCalledWith(
      expect.objectContaining({ canManageGroup: true })
    );
    edit.rerender(<GroupEditForm groupId="g" canManageGroup={false} />);
    expect(mocks.editController).toHaveBeenLastCalledWith(
      expect.objectContaining({ canManageGroup: false })
    );
    edit.unmount();

    const common = {
      onApprove: vi.fn(),
      onReject: vi.fn(),
      getApprovePreflightInput: vi.fn(),
      title: 'Title',
      description: 'Desc',
      roleColumnLabel: 'Role',
      dateColumnLabel: 'Date',
      fallbackRoleLabel: 'Member',
      primaryActionLabel: 'Approve',
      secondaryActionLabel: 'Reject',
      columns: [],
    };
    const requests = render(<PendingRequestsTableView {...common} requests={[]} />);
    requests.rerender(
      <PendingRequestsTableView {...common} requests={[{ id: 'm' }]} virtualSource={{}} />
    );
    expect(mocks.virtualTableProps.source).toEqual({});
    requests.rerender(<PendingRequestsTableView {...common} requests={[{ id: 'm' }]} />);
    expect(mocks.dataTableProps.getRowId({ id: 'row' })).toBe('row');
    requests.unmount();

    const list = render(<GroupsList groups={[]} isLoading />);
    list.rerender(<GroupsList groups={[]} isLoading={false} />);
    list.rerender(<GroupsList groups={[{ id: 'g', name: 'Named' }]} isLoading={false} />);
    expect(list.container.textContent).toContain('Named');
  });

  it('covers coordinate guards, shape propagation, base type, filters, and role fallbacks', () => {
    const onChange = vi.fn();
    const form = {
      latitude: 1,
      longitude: 2,
      country: '',
      region: '',
      city: '',
      post_code: '',
      street: '',
      house_number: '',
      location_boundary_source: null,
      location_bounds: null,
      location_geometry: null,
      location_kind: null,
      location_place_id: null,
    } as any;
    const location = render(<LocationInfoSection formData={form} onChange={onChange} />);
    act(() => mocks.geoProps.onCoordinatesChange({ latitude: 3, longitude: 4 }));
    act(() => mocks.geoProps.onCoordinatesChange(null));
    act(() => mocks.geoProps.onShapeChange(null));
    expect(onChange).toHaveBeenCalledWith('latitude', 3);
    location.rerender(
      <LocationInfoSection formData={{ ...form, latitude: null }} onChange={onChange} />
    );
    location.rerender(
      <LocationInfoSection formData={{ ...form, longitude: null }} onChange={onChange} />
    );
    location.unmount();

    const view = render(
      <>
        <GroupTypeSection groupType="base" hasSiblingConnections={false} />
        <GroupsFilters
          searchTerm="query"
          setSearchTerm={vi.fn()}
          selectedTags={['tag']}
          setSelectedTags={vi.fn()}
          toggleTag={vi.fn()}
          allTags={['tag']}
          hasActiveFilters
          clearAllFilters={vi.fn()}
        />
        <RoleTag />
        <RoleTag roleName="Named" />
        <RoleTag roleId="id">Child</RoleTag>
      </>
    );
    expect(view.container.textContent).toContain('Role');
    expect(view.container.textContent).toContain('features.groups.list.filters.searchLabel');
  });

  it('covers preflight input and disabled/checking request actions', () => {
    const membership = { id: 'membership', user_id: 'u', group_id: 'g', user: null } as any;
    const cell = render(
      <PendingRequestActionCell
        membership={membership}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        primaryActionLabel="Approve"
        secondaryActionLabel="Reject"
      />
    );
    expect(mocks.preflight).toHaveBeenLastCalledWith(null, { enabled: false });
    cell.rerender(
      <PendingRequestActionCell
        membership={{ ...membership, user: { id: 'u' } }}
        getApprovePreflightInput={() => ({ groupId: 'g' }) as any}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        primaryActionLabel="Approve"
        secondaryActionLabel="Reject"
      />
    );
    expect(mocks.preflight).toHaveBeenLastCalledWith({ groupId: 'g' }, { enabled: true });
    cell.unmount();
    mocks.actionProps.length = 0;

    render(
      <>
        <PendingRequestActionCellView
          membership={{ id: 'm' }}
          userId={null}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          primaryActionLabel="Approve"
          secondaryActionLabel="Reject"
          blocking
          response={null}
          labels={{ why: 'Why', checking: 'Checking', blockedTitle: 'Blocked' }}
        />
        <PendingRequestActionCellView
          membership={{ id: 'm' }}
          userId="u"
          onApprove={vi.fn()}
          onReject={vi.fn()}
          primaryActionLabel="Approve"
          secondaryActionLabel="Reject"
          blocking={false}
          checking
          response={null}
          labels={{ why: 'Why', checking: 'Checking', blockedTitle: 'Blocked' }}
        />
      </>
    );
    mocks.actionProps.forEach(props => props.onClick());
    expect(document.body.textContent).toContain('Blocked');
  });
});

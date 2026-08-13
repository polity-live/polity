/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: undefined as any }));
vi.mock('../AuthorizedGroupOperationPage', () => ({
  AuthorizedGroupOperationPage: (props: any) => {
    mocks.authorized = props;
    return <div data-testid="authorized" />;
  },
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({ AccessDenied: () => <div>denied</div> }));
vi.mock('@/features/shared/ui/feedback', () => ({ PageSkeleton: () => <div>loading</div> }));
vi.mock('@/features/groups/ui/GroupDatasetsSection', () => ({
  GroupDatasetsSection: () => <div>datasets</div>,
}));
vi.mock('@/features/documents/ui/GroupDocumentsList', () => ({
  GroupDocumentsList: () => <div>documents</div>,
}));
vi.mock('@/features/groups/ui/PaymentsSection', () => ({
  PaymentsSection: () => <div>payments</div>,
}));
vi.mock('@/features/groups/ui/TodosSection', () => ({ TodosSection: () => <div>todos</div> }));
vi.mock('@/features/network/ui/AddLinkDialog', () => ({
  AddLinkDialog: () => <button>add link</button>,
}));
vi.mock('@/features/network/ui/LinksSection', () => ({
  LinksSection: ({ addLinkButton }: any) => <div>links{addLinkButton}</div>,
}));
vi.mock('@/features/shared/ui/layout', () => ({
  Panel: ({ children }: any) => <div>{children}</div>,
  PanelContent: ({ children }: any) => <div>{children}</div>,
  PanelHeader: ({ children }: any) => <div>{children}</div>,
  PanelTitle: ({ children }: any) => <div>{children}</div>,
}));

import {
  GroupOperationPageContainerView,
  GroupOperationPageView,
} from '../GroupOperationPageContainerView';

afterEach(cleanup);
const containerProps = {
  groupId: 'g',
  hash: '',
  canManage: vi.fn(() => true),
  canView: vi.fn(),
  isLoading: false,
  isMember: vi.fn(() => true),
  canViewDatasets: true,
  canViewDocuments: true,
  canViewLinks: true,
  canViewPayments: true,
  canViewTodos: true,
  canAccessOperation: true,
};
const viewProps = {
  canManageDatasets: false,
  canManageDocuments: false,
  canManageLinks: false,
  canManagePayments: false,
  canManageTodos: false,
  canViewDatasets: false,
  canViewDocuments: false,
  canViewLinks: false,
  canViewPayments: false,
  canViewTodos: false,
  groupId: 'g',
  userId: null,
  groupName: 'G',
  links: [],
  linkDialogOpen: false,
  onLinkDialogOpenChange: vi.fn(),
  handleAddLink: vi.fn(),
  payments: [],
  summary: {},
  incomeData: [],
  expenditureData: [],
  todos: [],
  todoViewMode: 'kanban',
  onTodoViewModeChange: vi.fn(),
  onToggleTodoComplete: vi.fn(),
};

describe('group operation page views', () => {
  it('covers loading, membership denial, operation denial, and authorized states', () => {
    const page = render(<GroupOperationPageContainerView {...containerProps} isLoading />);
    page.rerender(<GroupOperationPageContainerView {...containerProps} isMember={() => false} />);
    page.rerender(
      <GroupOperationPageContainerView {...containerProps} canAccessOperation={false} />
    );
    page.rerender(<GroupOperationPageContainerView {...containerProps} />);
    expect(mocks.authorized.canManageDocuments).toBe(true);
  });

  it('covers every hidden, read-only, and managed operation section', () => {
    const page = render(<GroupOperationPageView {...viewProps} />);
    page.rerender(
      <GroupOperationPageView
        {...viewProps}
        canViewDatasets
        canViewDocuments
        canViewLinks
        canViewPayments
        canViewTodos
      />
    );
    expect(page.container.textContent).not.toContain('add link');
    page.rerender(
      <GroupOperationPageView
        {...viewProps}
        canViewDatasets
        canViewDocuments
        canViewLinks
        canViewPayments
        canViewTodos
        canManageLinks
      />
    );
    expect(page.container.textContent).toContain('add link');
  });
});

/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/useGroupDocuments', () => ({
  useGroupDocuments: () => ({
    documents: [
      {
        id: 'doc-1',
        title: 'Document One',
        collaborators: [],
        updated_at: 2,
        created_at: 1,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../hooks/useDocumentMutations', () => ({
  useDocumentMutations: () => ({
    createDocument: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock('@/features/pql/hooks/usePqlCollection', () => ({
  usePqlCollection: () => ({
    searchQuery: '',
    setSearchQuery: vi.fn(),
    quickFilterValues: {},
    setQuickFilterValues: vi.fn(),
    toggleQuickFilterValue: vi.fn(),
    clearQuickFilter: vi.fn(),
    savedFilters: [],
    saveCustomFilter: vi.fn(),
    deleteCustomFilter: vi.fn(),
    activeCustomFilterIds: [],
    toggleCustomFilter: vi.fn(),
    filteredItems: [
      {
        id: 'doc-1',
        title: 'Document One',
        collaborators: [],
        updated_at: 2,
        created_at: 1,
      },
    ],
    hasActiveFilters: false,
  }),
}));

vi.mock('@/features/pql/ui/PqlToolbar', () => ({
  PqlToolbar: ({ actions }: { actions?: ReactNode }) => (
    <div data-testid="pql-toolbar">{actions}</div>
  ),
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: ({ renderRow }: { renderRow: (row: any, index: number) => ReactNode }) =>
    renderRow(
      {
        id: 'doc-1',
        created_at: 1,
        updated_at: 2,
        collaborators: [],
        amendment: { title: 'Document One' },
      },
      0
    ),
}));

vi.mock('../GroupDocumentCard', () => ({
  GroupDocumentCard: ({ href }: { href: string }) => (
    <a data-testid="group-document-card" href={href}>
      Open
    </a>
  ),
}));

vi.mock('../CreateDocumentDialog', () => ({
  CreateDocumentDialog: () => <div data-testid="create-document-dialog" />,
}));

import { GroupDocumentsList } from '../GroupDocumentsList';
import { GroupDocumentsListView } from '../GroupDocumentsListView';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GroupDocumentsList', () => {
  it('hides create actions for view-only users', () => {
    render(<GroupDocumentsList groupId="group-1" userId="user-1" canManageDocuments={false} />);

    expect(screen.queryByTestId('create-document-dialog')).toBeNull();
    expect(screen.queryByTestId('group-document-card')).not.toBeNull();
  });

  it('shows create actions for users with manage rights', () => {
    render(<GroupDocumentsList groupId="group-1" userId="user-1" canManageDocuments />);

    expect(screen.queryByTestId('create-document-dialog')).not.toBeNull();
  });

  it('passes document routes to cards as hrefs', () => {
    render(<GroupDocumentsList groupId="group-1" userId="user-1" canManageDocuments={false} />);

    expect(screen.getByTestId('group-document-card').getAttribute('href')).toBe(
      '/group/group-1/editor/doc-1'
    );
  });

  it('labels toolbar and both empty-state creation surfaces as distinct stable variants', () => {
    const common = {
      canManageDocuments: true,
      fields: [],
      groupId: 'group-1',
      groupName: 'Council',
      isCreating: false,
      isLoading: false,
      onCreateDocument: vi.fn(),
      pql: {
        searchQuery: '',
        setSearchQuery: vi.fn(),
        quickFilterValues: {},
        setQuickFilterValues: vi.fn(),
        toggleQuickFilterValue: vi.fn(),
        clearQuickFilter: vi.fn(),
        savedFilters: [],
        saveCustomFilter: vi.fn(),
        deleteCustomFilter: vi.fn(),
        activeCustomFilterIds: [],
        toggleCustomFilter: vi.fn(),
        filteredItems: [],
        hasActiveFilters: false,
      },
    };
    const { container, rerender } = render(
      <GroupDocumentsListView {...({ ...common, documents: [] } as any)} />
    );
    expect(
      container.querySelector('[data-action-id="documents.create.open.empty-header"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-action-id="documents.create.open.empty-card"]')
    ).toBeTruthy();
    rerender(
      <GroupDocumentsListView
        {...({
          ...common,
          documents: [{ id: 'doc-1' }],
          pql: { ...common.pql, filteredItems: [{ id: 'doc-1' }] },
        } as any)}
      />
    );
    expect(
      container.querySelector('[data-action-id="documents.create.open.toolbar"]')
    ).toBeTruthy();
  });
});

/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gridProps: undefined as Record<string, any> | undefined,
  toolbarProps: undefined as Record<string, any> | undefined,
  pageByGroup: vi.fn((args: unknown) => ({ kind: 'page', args })),
  byId: vi.fn((args: unknown) => ({ kind: 'single', args })),
}));

vi.mock('@/features/pql/ui/PqlToolbar', () => ({
  PqlToolbar: (props: Record<string, unknown>) => {
    mocks.toolbarProps = props;
    return <div data-testid="toolbar">{props.actions as ReactNode}</div>;
  },
}));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: Record<string, unknown>) => {
    mocks.gridProps = props;
    return <div data-testid="virtual-grid" />;
  },
}));
vi.mock('../CreateDocumentDialog', () => ({
  CreateDocumentDialog: (props: Record<string, unknown>) => (
    <button data-testid="create-dialog" data-group={props.groupId as string}>
      Create
    </button>
  ),
}));
vi.mock('../GroupDocumentCard', () => ({
  GroupDocumentCard: ({ document, href }: Record<string, any>) => (
    <a data-testid="document-card" href={href}>
      {document.title ?? 'untitled'}
    </a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    documents: {
      pageByGroup: (args: unknown) => mocks.pageByGroup(args),
      byId: (args: unknown) => mocks.byId(args),
    },
  },
}));

import { GroupDocumentsListView } from '../GroupDocumentsListView';

function model(overrides: Record<string, unknown> = {}) {
  return {
    canManageDocuments: false,
    documents: [{ id: 'doc-source' }],
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
      activeCustomFilterIds: [],
      toggleCustomFilter: vi.fn(),
      deleteCustomFilter: vi.fn(),
      saveCustomFilter: vi.fn(),
      filteredItems: [{ id: 'doc-1', title: 'One' }],
      hasActiveFilters: false,
    },
    ...overrides,
  } as any;
}

beforeEach(() => {
  mocks.gridProps = undefined;
  mocks.toolbarProps = undefined;
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('GroupDocumentsListView branch contract', () => {
  it('renders loading and both unmanaged and managed initial empty states', () => {
    const view = render(<GroupDocumentsListView {...model({ isLoading: true })} />);
    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();

    view.rerender(<GroupDocumentsListView {...model({ documents: [] })} />);
    expect(screen.queryByTestId('create-dialog')).toBeNull();
    expect(document.body.textContent).toContain(
      'generated.inline.0061_no_documents_available_yet_02bcc505'
    );

    view.rerender(
      <GroupDocumentsListView {...model({ documents: [], canManageDocuments: true })} />
    );
    expect(screen.getAllByTestId('create-dialog')).toHaveLength(2);
    expect(document.body.textContent).toContain(
      'generated.inline.0060_no_documents_yet_create_your_first_document_t_bb860ef3'
    );
  });

  it('renders every filtered-empty message and toolbar action variant', () => {
    const emptyPql = {
      ...model().pql,
      filteredItems: [],
      hasActiveFilters: true,
    };
    const view = render(
      <GroupDocumentsListView {...model({ canManageDocuments: true, pql: emptyPql })} />
    );
    expect(mocks.toolbarProps?.actions).toBeTruthy();
    expect(document.body.textContent).toContain(
      'generated.inline.0062_no_documents_match_the_current_search_and_fil_9fe5ffdc'
    );

    view.rerender(
      <GroupDocumentsListView
        {...model({
          canManageDocuments: true,
          pql: { ...emptyPql, hasActiveFilters: false },
        })}
      />
    );
    expect(document.body.textContent).toContain(
      'generated.inline.0060_no_documents_yet_create_your_first_document_t_bb860ef3'
    );

    view.rerender(
      <GroupDocumentsListView
        {...model({
          canManageDocuments: false,
          pql: { ...emptyPql, hasActiveFilters: false },
        })}
      />
    );
    expect(mocks.toolbarProps?.actions).toBeUndefined();
    expect(document.body.textContent).toContain(
      'generated.inline.0061_no_documents_available_yet_02bcc505'
    );
  });

  it('provides complete virtual-grid contracts for responsive and settled states', () => {
    const pql = { ...model().pql, searchQuery: '  budget  ', activeCustomFilterIds: [] };
    render(<GroupDocumentsListView {...model({ pql, canManageDocuments: true })} />);

    const grid = mocks.gridProps;
    expect(grid?.context).toEqual({ groupId: 'group-1', query: 'budget' });
    expect([500, 640, 1024].map(width => grid?.getLanes(width))).toEqual([1, 2, 3]);
    expect(grid?.getRowKey({ id: 'doc-1' })).toBe('doc-1');
    expect(grid?.toStartRow({ id: 'doc-1', updated_at: 9 })).toEqual({
      id: 'doc-1',
      updated_at: 9,
    });

    expect(grid?.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(grid?.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(grid?.getSingleQuery({ id: 'doc-1', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(grid?.getSingleQuery({ id: 'doc-1', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(mocks.pageByGroup).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'group-1', query: 'budget' })
    );
    expect(mocks.byId).toHaveBeenCalledWith({ id: 'doc-1' });

    const withTitle = render(
      grid?.renderRow({ id: 'doc-1', amendment: { title: 'Amendment' } }) as ReactNode
    );
    expect(withTitle.getByText('Amendment')).toBeTruthy();
    withTitle.unmount();
    const withoutTitle = render(grid?.renderRow({ id: 'doc-2', amendment: null }) as ReactNode);
    expect(withoutTitle.getByText('untitled')).toBeTruthy();
    withoutTitle.unmount();

    const skeleton = render(grid?.renderSkeleton() as ReactNode);
    expect(skeleton.container.firstElementChild).toBeTruthy();
    skeleton.unmount();
    const empty = render(grid?.renderEmpty() as ReactNode);
    expect(empty.container.textContent).toContain(
      'generated.inline.0062_no_documents_match_the_current_search_and_fil_9fe5ffdc'
    );
  });

  it('renders materialized custom-filter results and both title fallbacks', () => {
    const pql = {
      ...model().pql,
      activeCustomFilterIds: ['saved-1'],
      filteredItems: [
        { id: 'one', title: 'One' },
        { id: 'two', title: null },
      ],
    };
    render(<GroupDocumentsListView {...model({ pql })} />);

    expect(screen.queryByTestId('virtual-grid')).toBeNull();
    expect(screen.getAllByTestId('document-card')).toHaveLength(2);
    expect(screen.getByText('One').getAttribute('href')).toBe('/group/group-1/editor/one');
    expect(screen.getByText('untitled').getAttribute('href')).toBe('/group/group-1/editor/two');
  });
});

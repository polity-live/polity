/* @vitest-environment jsdom */

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  filterProps: undefined as any,
  gridProps: undefined as any,
  translate: vi.fn((key: string, fallback?: string) => fallback ?? key),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to: _to, params: _params, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: mocks.translate }));

vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: (tone: string) => ({ badge: `badge-${tone}` }),
}));

vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: ({ searchQuery, onSearchQueryChange, placeholder }: any) => (
    <input
      aria-label="search"
      placeholder={placeholder}
      value={searchQuery}
      onChange={event => onSearchQueryChange(event.target.value)}
    />
  ),
}));

vi.mock('@/features/shared/ui/participation', () => ({
  ParticipationRoleFilterBar: (props: any) => {
    mocks.filterProps = props;
    return (
      <div>
        <button type="button" onClick={() => props.onSelectedRoleIdsChange(['admin'])}>
          select admin
        </button>
        <button type="button" onClick={() => props.onSelectedRoleIdsChange(['missing'])}>
          select missing
        </button>
      </div>
    );
  },
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: any) => {
    mocks.gridProps = props;
    return (
      <div data-testid="virtual-grid">
        {props.renderRow({ created_at: null, id: 'virtual-row' }, 0)}
        {props.renderSkeleton()}
        {props.renderEmpty()}
      </div>
    );
  },
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children }: any) => <span data-testid="fallback">{children}</span>,
  AvatarImage: ({ src }: any) => <span data-testid="avatar">{String(src)}</span>,
}));

vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children, interactive, ...props }: any) => (
    <article data-interactive={interactive} {...props}>
      {children}
    </article>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('@/features/shared/ui/status', () => ({
  RoleBadge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

import {
  getWikiParticipationName,
  isVisibleWikiParticipationStatus,
  normalizeWikiParticipationRole,
  WikiParticipationDirectory,
  type WikiParticipationVirtualSource,
} from '../WikiParticipationDirectory';

describe('WikiParticipationDirectory branch contracts', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('normalizes visibility, display names, and roles through every fallback', () => {
    expect(isVisibleWikiParticipationStatus(undefined)).toBe(false);
    expect(getWikiParticipationName({ first_name: 'Ada', last_name: 'Lovelace' })).toBe(
      'Ada Lovelace'
    );
    expect(getWikiParticipationName({ handle: 'ada' })).toBe('ada');
    expect(getWikiParticipationName({ email: 'ada@example.com' })).toBe('ada@example.com');
    expect(getWikiParticipationName(null)).toBe('generated.inline.0031_unknown_bc7819b3');

    expect(normalizeWikiParticipationRole(undefined)).toBeNull();
    expect(normalizeWikiParticipationRole({ id: 'one', name: 'Named' })).toMatchObject({
      id: 'one',
      name: 'Named',
    });
    expect(normalizeWikiParticipationRole({ id: 'two', title: 'Titled' })).toMatchObject({
      id: 'two',
      name: 'Titled',
    });
    expect(normalizeWikiParticipationRole({ id: 'three' }, 'Fallback')).toMatchObject({
      id: 'three',
      name: 'Fallback',
    });
    expect(normalizeWikiParticipationRole({ description: 'Description', id: 'four' })).toEqual({
      description: 'Description',
      id: 'four',
      name: 'Role',
    });
  });

  it('renders contact, role, status, metadata, initials, links, and deduped role choices', () => {
    const manyItems = Array.from({ length: 10 }, (_, index) => ({
      id: `extra-${index}`,
      name: `Extra ${index}`,
    }));
    const { container } = render(
      <WikiParticipationDirectory
        className="directory-class"
        entityType="group"
        title="Directory"
        description="Participants"
        leadingCard={<strong>Summary</strong>}
        roles={[
          { id: 'moderator', name: 'z Moderator' },
          { id: 'admin', name: 'Admin' },
          { id: 'admin', name: 'Duplicate' },
          { id: '', name: 'Missing id' },
        ]}
        items={[
          {
            avatar: 'avatar.png',
            handle: 'ada',
            id: 'ada',
            metadata: ['Berlin'],
            name: 'Ada Lovelace',
            roles: [{ id: 'admin', name: 'Admin' }],
            userId: 'user-1',
          },
          {
            email: 'grace@example.com',
            id: 'grace',
            name: 'Grace Hopper',
            roles: [],
            status: 'active',
          },
          { id: 'unknown', name: '   ', roles: null },
          ...manyItems,
        ]}
      />
    );

    expect(screen.getByText('Participants')).toBeTruthy();
    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getByText('grace@example.com')).toBeTruthy();
    expect(screen.getByText('active')).toBeTruthy();
    expect(screen.getByText('Berlin')).toBeTruthy();
    expect(screen.getAllByTestId('fallback').map(node => node.textContent)).toContain('U');
    expect(container.querySelector('a')).toBeTruthy();
    expect(container.querySelector('[data-interactive="default"]')).toBeTruthy();
    expect(
      container.querySelector('[data-slot="wiki-participation-directory"]')?.className
    ).toContain('directory-class');
    expect(mocks.filterProps.roles.map((role: { id: string }) => role.id)).toEqual([
      'admin',
      'moderator',
    ]);
    const wrappers = container.querySelectorAll('.civic-load-card-reveal');
    expect(
      (wrappers[wrappers.length - 1] as HTMLElement).style.getPropertyValue('--civic-load-index')
    ).toBe('11');
  });

  it('searches metadata, roles, email, and status and distinguishes empty results', () => {
    render(
      <WikiParticipationDirectory
        title="Searchable"
        emptyLabel="Empty directory"
        noResultsLabel="Nothing matches"
        roles={[{ id: 'admin', name: 'Admin' }]}
        items={[
          {
            email: 'person@example.com',
            id: 'one',
            metadata: ['North'],
            name: 'Person',
            roles: [{ id: 'admin', name: 'Administrator' }],
            status: 'active',
          },
          { id: 'two', name: 'Other' },
        ]}
      />
    );

    for (const query of [' north ', 'administrator', 'person@example.com', 'active']) {
      fireEvent.change(screen.getByLabelText('search'), { target: { value: query } });
      expect(screen.getByText('Person')).toBeTruthy();
    }
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'absent' } });
    expect(screen.getByText('Nothing matches')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('search'), { target: { value: '' } });
    fireEvent.click(screen.getByText('select missing'));
    expect(screen.getByText('Nothing matches')).toBeTruthy();
  });

  it('uses the empty label for an initially empty local directory', () => {
    render(<WikiParticipationDirectory title="Empty" items={[]} emptyLabel="No participants" />);
    expect(screen.getByText('No participants')).toBeTruthy();
    expect(screen.queryByLabelText('search')).toBeNull();
  });

  it('adapts virtual queries, rows, starts, lanes, skeletons, and empty content', () => {
    const getPageQuery = vi.fn(() => 'page-query');
    const getSingleQuery = vi.fn(() => 'single-query');
    const mapRow = vi.fn((row: any) => ({
      id: row.id,
      name: 'Virtual Person',
      userId: null,
    }));
    const source: WikiParticipationVirtualSource = {
      context: { entityId: 'entity-1' },
      getPageQuery,
      getRowKey: row => row.id,
      getSingleQuery,
      historyKey: 'wiki-history',
      mapRow,
    };

    render(
      <WikiParticipationDirectory
        title="Virtual"
        items={[{ id: 'seed', name: 'Seed' }]}
        virtualSource={source}
        emptyLabel="Virtual empty"
        noResultsLabel="Virtual missing"
      />
    );

    expect(screen.getByTestId('virtual-grid')).toBeTruthy();
    expect(screen.getByText('Virtual Person')).toBeTruthy();
    expect(screen.getByTestId('skeleton')).toBeTruthy();
    expect(screen.getByText('Virtual empty')).toBeTruthy();
    expect(mocks.gridProps.context).toEqual({ entityId: 'entity-1', query: '', roleIds: [] });
    expect(
      mocks.gridProps.getPageQuery({ dir: 'forward', limit: 20, settled: true, start: null })
    ).toBe('page-query');
    expect(getPageQuery).toHaveBeenCalledWith({
      dir: 'forward',
      limit: 20,
      query: '',
      roleIds: [],
      settled: true,
      start: null,
    });
    expect(mocks.gridProps.getSingleQuery({ id: 'one', settled: false })).toBe('single-query');
    expect(mocks.gridProps.toStartRow({ created_at: '12', id: 'row' })).toEqual({
      created_at: 12,
      id: 'row',
    });
    expect(mocks.gridProps.toStartRow({ created_at: null, id: 'row' })).toEqual({
      created_at: 0,
      id: 'row',
    });
    expect([500, 800, 1200].map(mocks.gridProps.getLanes)).toEqual([1, 2, 3]);

    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'missing' } });
    expect(screen.getByText('Virtual missing')).toBeTruthy();
  });

  it('preserves a custom virtual start-row adapter', () => {
    const toStartRow = vi.fn(row => ({ created_at: 99, id: row.id }));
    const source: WikiParticipationVirtualSource = {
      context: {},
      getPageQuery: vi.fn(),
      getRowKey: row => row.id,
      getSingleQuery: vi.fn(),
      historyKey: 'custom-history',
      mapRow: row => ({ id: row.id, name: 'Custom Person' }),
      toStartRow,
    };
    render(<WikiParticipationDirectory title="Custom" items={[]} virtualSource={source} />);

    expect(mocks.gridProps.toStartRow).toBe(toStartRow);
    expect(mocks.gridProps.toStartRow({ id: 'row' })).toEqual({ created_at: 99, id: 'row' });
  });
});

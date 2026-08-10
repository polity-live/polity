/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ zero: [] as any[], local: [] as any[] }));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: any) => {
    mocks.zero.push(props);
    return <div data-testid="zero-grid" />;
  },
  PolityLocalGridView: (props: any) => {
    mocks.local.push(props);
    return <div data-testid="local-grid" />;
  },
}));
vi.mock('@/features/timeline/ui/cards/AmendmentTimelineCard', () => ({
  AmendmentTimelineCard: ({ amendment }: any) => (
    <article data-testid="amendment-card">{amendment.title}</article>
  ),
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: {
      groupAmendmentPage: (args: any) => ({ kind: 'page', ...args }),
      groupAmendmentById: (args: any) => ({ kind: 'single', ...args }),
    },
  },
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtags: (rows: any) => rows ?? [] }));
vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  mapAmendmentBranchStatusChips: (rows: any) => rows,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { AmendmentGroupsView } from '../AmendmentGroupsView';

const section = (key: any, count: number, items: any[] = []) => ({ key, label: key, count, items });
beforeEach(() => {
  mocks.zero = [];
  mocks.local = [];
});
afterEach(cleanup);

describe('AmendmentGroupsView branches', () => {
  it('skips empty sections and configures open and closed Zero grids', () => {
    const toggle = vi.fn();
    render(
      <AmendmentGroupsView
        groupId="g"
        groupName="Group"
        openSections={{ accepted: true, pending: false, rejected: true, withdrawn: true }}
        sectionOrder={[section('accepted', 2), section('pending', 1), section('rejected', 0)]}
        onToggleSection={toggle}
        queryFilters={{ searchQuery: 'query', statusFilter: 'all', hashtagFilter: '' }}
      />
    );
    expect(mocks.zero).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(toggle).toHaveBeenCalledWith('accepted');

    const grid = mocks.zero[0];
    expect(
      grid.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true }).options.ttl
    ).toBe('5m');
    expect(
      grid.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false }).options.ttl
    ).toBe('none');
    expect(grid.getSingleQuery({ id: 'a', settled: true }).options.ttl).toBe('5m');
    expect(grid.getSingleQuery({ id: 'a', settled: false }).options.ttl).toBe('none');
    expect(grid.getRowKey({ id: 'row' })).toBe('row');
    expect(grid.toStartRow({ id: 'row', created_at: 9 })).toEqual({ id: 'row', created_at: 9 });
    expect(grid.getLanes(768)).toBe(2);
    expect(grid.getLanes(767)).toBe(1);

    const first = grid.renderRow(
      {
        id: 'one',
        title: null,
        reason: null,
        group_decisions: [],
        amendment_hashtags: null,
        current_process_run: null,
        created_at: 1,
      },
      0
    );
    const capped = grid.renderRow(
      {
        id: 'two',
        title: 'Two',
        reason: 'Reason',
        group_decisions: [{ status: 'approved' }],
        amendment_hashtags: [],
        current_process_run: { branches: [] },
        created_at: 2,
      },
      20
    );
    render(
      <>
        {first}
        {capped}
        {grid.renderSkeleton()}
        {grid.renderEmpty()}
      </>
    );
    expect(screen.getAllByTestId('amendment-card')).toHaveLength(2);
    expect(document.body.textContent).toContain('noAmendments');
  });

  it('passes a nonempty hashtag to the Zero query', () => {
    render(
      <AmendmentGroupsView
        groupId="g"
        openSections={{ accepted: true, pending: true, rejected: true, withdrawn: true }}
        sectionOrder={[section('accepted', 1)]}
        onToggleSection={vi.fn()}
        queryFilters={{ searchQuery: '', statusFilter: 'all', hashtagFilter: 'tag' }}
      />
    );
    expect(
      mocks.zero[0].getPageQuery({ limit: 1, start: null, dir: 'forward', settled: true }).query
        .hashtag
    ).toBe('tag');
  });

  it('configures the mounted local grid while retaining a closed section trigger', () => {
    const item = { id: 'item', cardAmendment: { id: 'a', title: 'Card' } };
    render(
      <AmendmentGroupsView
        openSections={{ accepted: true, pending: false, rejected: true, withdrawn: true }}
        sectionOrder={[section('accepted', 1, [item]), section('pending', 1, [item])]}
        onToggleSection={vi.fn()}
        queryFilters={{ searchQuery: '', statusFilter: 'all', hashtagFilter: '' }}
      />
    );
    expect(mocks.local).toHaveLength(1);
    expect(mocks.local[0].getItemKey(item)).toBe('item');
    expect(mocks.local[0].getLanes(800)).toBe(2);
    expect(mocks.local[0].getLanes(500)).toBe(1);
    const open = mocks.local[0].renderItem(item, 20);
    const { container } = render(<>{open}</>);
    expect(container.querySelector('.civic-load-card-reveal')).toBeTruthy();
    expect(container.querySelectorAll('[style]').length).toBe(1);
  });
});

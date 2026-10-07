/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: any) => [query ? mocks.rows : undefined],
}));
vi.mock('@/zero/queries', () => ({
  queries: { amendments: { groupAmendmentCountRows: (args: any) => args } },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtags: (rows: any) => rows ?? [] }));

import { useAmendmentGroupsController } from '../useAmendmentGroupsController';

const groups = (populated = false) =>
  ({
    accepted: populated
      ? [
          {
            id: 'a',
            amendment_id: 'original',
            title: 'Accepted',
            subtitle: 'Desc',
            group_status: 'approved',
            amendment_hashtags: [{ hashtag: { id: 'h', tag: 'tag' } }],
            branchStatuses: [],
          },
        ]
      : [],
    pending: populated
      ? [
          {
            id: 'p',
            amendment_id: null,
            title: null,
            subtitle: null,
            group_status: null,
            decision_status: null,
          },
        ]
      : [],
    rejected: [],
    withdrawn: [],
  }) as any;

beforeEach(() => {
  mocks.rows = [];
});
afterEach(cleanup);

describe('useAmendmentGroupsController', () => {
  it('uses local counts and default filters without a group id and maps fallback card data', () => {
    const { result } = renderHook(() =>
      useAmendmentGroupsController({ groupedAmendments: groups(true) })
    );
    expect(result.current.queryFilters).toEqual({
      searchQuery: '',
      statusFilter: 'all',
      hashtagFilter: '',
    });
    expect(result.current.sectionOrder.map(section => section.count)).toEqual([1, 1, 0, 0]);
    expect(result.current.sectionOrder[0].items[0].cardAmendment).toMatchObject({
      id: 'original',
      title: 'Accepted',
      description: 'Desc',
      status: 'approved',
    });
    expect(result.current.sectionOrder[1].items[0].cardAmendment).toMatchObject({
      id: 'p',
      title: '',
      description: undefined,
      status: 'pending',
    });
  });

  it('uses queried counts only for enabled sections and toggles sections both ways', () => {
    mocks.rows = [
      { id: 'a', group_decisions: [{ group_id: 'g', status: 'accepted' }] },
      { id: 'b', group_decisions: [{ group_id: 'g', status: 'approved' }] },
      { id: 'c', group_decisions: [{ group_id: 'g', status: 'rejected' }] },
    ];
    const { result } = renderHook(() =>
      useAmendmentGroupsController({
        groupedAmendments: groups(),
        groupId: 'g',
        groupName: 'Group',
        filters: { searchQuery: 'query', statusFilter: 'accepted', hashtagFilter: 'tag' },
      })
    );
    expect(result.current.sectionOrder.map(section => section.count)).toEqual([2, 0, 0, 0]);
    expect(result.current.sectionOrder[0].ids).toEqual(['a', 'b']);
    act(() => result.current.onToggleSection('accepted'));
    expect(result.current.openSections.accepted).toBe(false);
    act(() => result.current.onToggleSection('accepted'));
    expect(result.current.openSections.accepted).toBe(true);
  });

  it('assigns each queried amendment to one group status before an event exists', () => {
    mocks.rows = [
      {
        id: 'start',
        current_process_run: { selected_source_group_id: 'g', step_runs: [] },
      },
      {
        id: 'target',
        current_process_run: {
          selected_target_group_id: 'g',
          step_runs: [{ target_group_id: 'g', status: 'pending_event', event: null }],
        },
      },
      {
        id: 'decided',
        group_decisions: [{ group_id: 'g', status: 'accepted' }],
        current_process_run: {
          step_runs: [{ target_group_id: 'g', status: 'pending_event', event: null }],
        },
      },
    ];
    const { result } = renderHook(() =>
      useAmendmentGroupsController({ groupedAmendments: groups(), groupId: 'g' })
    );
    expect(result.current.sectionOrder.map(section => section.ids)).toEqual([
      ['decided'],
      ['start', 'target'],
      [],
      [],
    ]);
  });

  it('normalizes missing query rows and empty hashtag for all enabled sections', () => {
    mocks.rows = undefined as any;
    const { result } = renderHook(() =>
      useAmendmentGroupsController({
        groupedAmendments: groups(),
        groupId: 'g',
        filters: { searchQuery: '', statusFilter: 'all', hashtagFilter: '' },
      })
    );
    expect(result.current.sectionOrder.every(section => section.count === 0)).toBe(true);
  });
});

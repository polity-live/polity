import { describe, expect, it } from 'vitest';
import {
  createBranchDisplayNumberMap,
  createBranchScopedChangeRequestDisplayMap,
  decorateBranchScopedChangeRequests,
  decorateBranchScopedTimelineItems,
  filterTimelineItemsForProcessBranch,
  getTimelineItemProcessBranchId,
} from '../branchScopedDisplay';

describe('branchScopedDisplay', () => {
  it('keeps sequence boundary votes while filtering timeline items by process branch', () => {
    const items = [
      {
        id: 'variant-vote',
        _voteStepKind: 'merge_variant',
        change_request: null,
      },
      {
        id: 'branch-a-cr',
        change_request: { id: 'cr-a', process_branch_id: 'branch-a' },
      },
      {
        id: 'branch-b-cr',
        change_request: { id: 'cr-b', process_branch_id: 'branch-b' },
      },
      {
        id: 'closing-vote',
        is_closing_vote: true,
        change_request: null,
      },
    ];

    expect(filterTimelineItemsForProcessBranch(items, 'branch-b').map(item => item.id)).toEqual([
      'variant-vote',
      'branch-b-cr',
      'closing-vote',
    ]);
  });

  it('keeps branch-scoped display ids and generated CR titles aligned', () => {
    const items = [
      {
        id: 'timeline-1',
        change_request_id: 'cr-1',
        order_index: 0,
        is_closing_vote: false,
        change_request: {
          id: 'cr-1',
          process_branch_id: 'branch-a',
          cr_id: 'CR-1',
          title: 'CR-1',
        },
      },
      {
        id: 'timeline-2',
        change_request_id: 'cr-2',
        order_index: 1,
        is_closing_vote: false,
        change_request: {
          id: 'cr-2',
          process_branch_id: 'branch-a',
          cr_id: 'CR-2',
          title: 'CR-2',
        },
      },
      {
        id: 'timeline-3',
        change_request_id: 'cr-3',
        order_index: 2,
        is_closing_vote: false,
        change_request: {
          id: 'cr-3',
          process_branch_id: 'branch-a',
          cr_id: 'CR-3',
          title: 'CR-3',
        },
      },
      {
        id: 'timeline-4',
        change_request_id: 'cr-4',
        order_index: 3,
        is_closing_vote: false,
        change_request: {
          id: 'cr-4',
          process_branch_id: 'branch-a',
          cr_id: 'CR-3',
          title: 'CR-3',
        },
      },
    ];

    const decorated = decorateBranchScopedTimelineItems([{ id: 'branch-a', created_at: 1 }], items);

    expect(decorated.map(item => (item.change_request as any)?.display_cr_id)).toEqual([
      'Branch 1 CR-1',
      'Branch 1 CR-2',
      'Branch 1 CR-3',
      'Branch 1 CR-4',
    ]);
    expect(decorated.map(item => (item.change_request as any)?.title)).toEqual([
      'CR-1',
      'CR-2',
      'CR-3',
      'CR-4',
    ]);
    expect(decorated.map(item => (item.change_request as any)?.cr_id)).toEqual([
      'CR-1',
      'CR-2',
      'CR-3',
      'CR-4',
    ]);
  });

  it('uses persisted branch sequence numbers instead of agenda order for labels', () => {
    const items = [
      {
        id: 'timeline-later',
        change_request_id: 'cr-later',
        order_index: 0,
        is_closing_vote: false,
        change_request: {
          id: 'cr-later',
          process_branch_id: 'branch-a',
          title: 'CR-9',
          branch_sequence_number: 9,
        },
      },
      {
        id: 'timeline-earlier',
        change_request_id: 'cr-earlier',
        order_index: 1,
        is_closing_vote: false,
        change_request: {
          id: 'cr-earlier',
          process_branch_id: 'branch-a',
          title: 'CR-2',
          branch_sequence_number: 2,
        },
      },
    ];

    const decorated = decorateBranchScopedTimelineItems([{ id: 'branch-a', created_at: 1 }], items);

    expect(decorated.map(item => (item.change_request as any)?.display_cr_id)).toEqual([
      'Branch 1 CR-9',
      'Branch 1 CR-2',
    ]);
    expect(decorated.map(item => (item.change_request as any)?.title)).toEqual(['CR-9', 'CR-2']);
  });

  it('orders branches by normalized timestamps and stable ids', () => {
    const map = createBranchDisplayNumberMap([
      { id: 'invalid', created_at: 'not-a-date' },
      { id: 'date', created_at: '2024-01-02T00:00:00Z' },
      { id: 'number', created_at: 1 },
      { id: 'infinite', created_at: Number.POSITIVE_INFINITY },
      { id: 'null', created_at: null },
      { id: 'actual-date', created_at: new Date(2) } as any,
    ]);

    expect([...map.entries()]).toEqual([
      ['infinite', 1],
      ['invalid', 2],
      ['null', 3],
      ['number', 4],
      ['actual-date', 5],
      ['date', 6],
    ]);
  });

  it('decorates scoped requests with persisted and collision-free fallback numbers', () => {
    const requests = [
      {
        id: 'persisted-snake',
        process_branch_id: 'branch-a',
        branch_sequence_number: 2.9,
      },
      {
        id: 'persisted-camel',
        processBranchId: 'branch-a',
        branchSequenceNumber: 4,
      },
      { id: 'fallback-first', process_branch_id: 'branch-a', created_at: 1 },
      { id: 'fallback-second', process_branch_id: 'branch-a', createdAt: 2 },
      {
        id: 'stable-from-cr-id',
        process_branch_id: 'branch-a',
        crId: 'CR-8',
        branch_sequence_number: Number.NaN,
      },
      {
        id: 'order-index-a',
        process_branch_id: 'branch-a',
        order_index: 2,
        title: 'Zulu',
      },
      {
        id: 'order-index-b',
        process_branch_id: 'branch-a',
        order_index: 1,
        title: 'Alpha',
      },
      { id: 'unknown-branch', process_branch_id: 'missing', cr_id: 'CR-12' },
      { id: 'main-title', title: 'Named request' },
      { id: 'main-generated', title: 'CR-13' },
      { id: 'main-empty' },
    ];

    const map = createBranchScopedChangeRequestDisplayMap(
      [{ id: 'branch-a', created_at: 1 }],
      requests
    );
    expect(map.get('persisted-snake')).toMatchObject({
      displayCrId: 'Branch 1 CR-2',
      branchScopedCrNumber: 2,
    });
    expect(map.get('persisted-camel')).toMatchObject({ branchScopedCrNumber: 4 });
    expect(map.get('stable-from-cr-id')).toMatchObject({ branchScopedCrNumber: 1 });
    expect(map.get('fallback-first')).toMatchObject({ branchScopedCrNumber: 6 });
    expect(map.get('fallback-second')).toMatchObject({ branchScopedCrNumber: 7 });
    expect(map.get('unknown-branch')).toEqual({ displayCrId: 'CR-12' });
    expect(map.get('main-title')).toEqual({ displayCrId: 'Named request' });
    expect(map.get('main-generated')).toEqual({ displayCrId: 'CR-13' });
    expect(map.get('main-empty')).toEqual({ displayCrId: undefined });

    const decorated = decorateBranchScopedChangeRequests(
      [{ id: 'branch-a' }],
      [{ id: 'decorated', processBranchId: 'branch-a' }]
    );
    expect(decorated[0]).toMatchObject({
      id: 'decorated',
      displayCrId: 'Branch 1 CR-1',
      branchDisplayNumber: 1,
    });
  });

  it('uses creation time, order index, title, custom CR id, and id as stable sort fallbacks', () => {
    const branches = [{ id: 'branch-a' }];
    const scenarios = [
      [
        { id: 'later', processBranchId: 'branch-a', createdAt: 2 },
        { id: 'earlier', processBranchId: 'branch-a', created_at: 1 },
      ],
      [
        { id: 'indexed-two', processBranchId: 'branch-a', order_index: 2 },
        { id: 'indexed-one', processBranchId: 'branch-a', order_index: 1 },
        { id: 'indexed-none', processBranchId: 'branch-a', order_index: null },
      ],
      [
        { id: 'title-z', processBranchId: 'branch-a', title: 'Zulu' },
        { id: 'title-a', processBranchId: 'branch-a', title: 'Alpha' },
      ],
      [
        { id: 'custom-z', processBranchId: 'branch-a', crId: 'Z-custom' },
        { id: 'custom-a', processBranchId: 'branch-a', crId: 'A-custom' },
      ],
      [
        { id: 'id-z', processBranchId: 'branch-a' },
        { id: 'id-a', processBranchId: 'branch-a' },
      ],
      [
        { id: 'same-index-z', processBranchId: 'branch-a', order_index: 1 },
        { id: 'same-index-a', processBranchId: 'branch-a', order_index: 1 },
      ],
    ];

    for (const requests of scenarios) {
      expect(createBranchScopedChangeRequestDisplayMap(branches, requests).size).toBe(
        requests.length
      );
      expect(
        createBranchScopedChangeRequestDisplayMap(branches, [...requests].reverse()).size
      ).toBe(requests.length);
    }
  });

  it('preserves timeline rows that cannot or must not be decorated', () => {
    const missing = { id: 'missing' };
    const closing = {
      id: 'closing',
      is_closing_vote: true,
      change_request: { id: 'closing-cr', process_branch_id: 'branch-a' },
    };
    const unscoped = { id: 'unscoped', change_request: {} };

    const decorated = decorateBranchScopedTimelineItems(
      [{ id: 'branch-a' }],
      [missing, closing, unscoped]
    );

    expect(decorated[0]).toBe(missing);
    expect(decorated[1]).toBe(closing);
    expect(decorated[2]).toBe(unscoped);
  });

  it('decorates unscoped generated titles through the existing-title fallback', () => {
    const [decorated] = decorateBranchScopedTimelineItems(
      [],
      [
        {
          id: 'unscoped-generated',
          change_request: { id: 'cr-unscoped', title: 'CR-7' },
        },
      ]
    );

    expect(decorated.change_request).toMatchObject({
      title: 'CR-7',
      display_cr_id: 'CR-7',
    });
    const changeRequest = decorated.change_request as Record<string, unknown>;
    expect(changeRequest.cr_id).toBeUndefined();
    expect(changeRequest.crId).toBeUndefined();
  });

  it('normalizes timeline identity, titles, ids, and sequence aliases', () => {
    const items: any[] = [
      {
        id: 'item-camel',
        _processBranchId: 'branch-a',
        order_index: null,
        change_request: {
          id: 'camel',
          processBranchId: 'branch-a',
          crId: 'CR-1',
          displayCrId: 'CR-1',
          title: 'Custom title',
          branchSequenceNumber: 1,
          created_at: 1,
        },
      },
      {
        id: 'item-fallback',
        _processBranchId: 'branch-a',
        change_request: {
          processBranchId: 'branch-a',
          crId: 'CR-2',
          display_cr_id: 'CR-2',
          title: null,
          branchSequenceNumber: 2,
        },
      },
      {
        id: 'item-snake-title',
        change_request: {
          id: 'snake-title',
          process_branch_id: 'branch-a',
          cr_id: 'CR-3',
          display_cr_id: 'CR-3',
          title: 'CR-3',
          branch_sequence_number: 3,
        },
      },
      {
        id: 'item-display-camel-title',
        change_request: {
          id: 'display-camel-title',
          process_branch_id: 'branch-a',
          cr_id: null,
          crId: null,
          displayCrId: 'Old display',
          title: 'Old display',
          branch_sequence_number: 4,
        },
      },
    ];

    const decorated = decorateBranchScopedTimelineItems([{ id: 'branch-a' }], items);

    expect(decorated[0].change_request.title).toBe('Custom title');
    expect(decorated[0].change_request.cr_id).toBe('CR-1');
    expect(decorated[0].change_request.branch_sequence_number).toBe(1);
    expect(decorated[1].change_request.title).toBe('CR-2');
    expect(decorated[1].change_request.id).toBeUndefined();
    expect(decorated[2].change_request.crId).toBe('CR-3');
    expect(decorated[2].change_request.branchSequenceNumber).toBe(3);
    expect(decorated[3].change_request.title).toBe('CR-4');
  });

  it('reads every process-branch alias and filters main plus every boundary kind', () => {
    expect(getTimelineItemProcessBranchId({ process_branch_id: 'snake' })).toBe('snake');
    expect(getTimelineItemProcessBranchId({ processBranchId: 'camel' })).toBe('camel');
    expect(
      getTimelineItemProcessBranchId({ change_request: { process_branch_id: 'nested-snake' } })
    ).toBe('nested-snake');
    expect(
      getTimelineItemProcessBranchId({ change_request: { processBranchId: 'nested-camel' } })
    ).toBe('nested-camel');
    expect(getTimelineItemProcessBranchId({ _processBranchId: 'private' })).toBe('private');
    expect(getTimelineItemProcessBranchId({})).toBeNull();

    const items = [
      { id: 'main' },
      { id: 'branch', processBranchId: 'branch-a' },
      { id: 'placeholder', _voteStepKind: 'change_request_votes_placeholder' },
      { id: 'closing', _voteStepKind: 'closing' },
      { id: 'closing-placeholder', _voteStepKind: 'closing_placeholder' },
    ];
    expect(filterTimelineItemsForProcessBranch(items).map(item => item.id)).toEqual([
      'main',
      'placeholder',
      'closing',
      'closing-placeholder',
    ]);
  });
});

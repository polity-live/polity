import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/amendments/logic/amendmentTargetEventEligibility', () => ({
  isAmendmentTargetEventOpen: (event: { status?: string | null }) => event.status !== 'closed',
}));

import {
  amendmentPathHelperInternals as internals,
  calculateProcessPathWithClosestEvents,
  calculateProcessPathWithClosestEventsForGroupIds,
  calculateWorkflowPathWithClosestEvents,
  calculateWorkflowProcessPathWithClosestEvents,
  getDirectReachableTargetGroupsFromSource,
  getEligibleEventsForPathSegment,
  getProcessPathGroupOptions,
  getReachableWorkflowsFromSource,
  getWorkflowFinalGroupId,
  getWorkflowStartGroupId,
} from '../amendmentPathHelpers';

function group(id: string, name = id) {
  return { id, name, description: null } as any;
}

function relationship(
  id: string,
  source: string | undefined,
  target: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    grant_id: `grant:${id}`,
    with_right: 'amendmentRight',
    status: 'active',
    group_id: source,
    related_group_id: target,
    group: source === undefined ? null : group(source),
    related_group: group(target),
    ...overrides,
  } as any;
}

function event(
  id: string,
  groupId: string,
  startDate: number | null,
  endDate: number | null = null,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    title: id,
    group_id: groupId,
    group: null,
    start_date: startDate,
    end_date: endDate,
    status: 'active',
    ...overrides,
  } as any;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('amendmentPathHelpers M10 mutation boundaries', () => {
  it('rejects an absent current traversal node and keeps empty membership roles inert', () => {
    const context = internals.buildUserMembershipTraversalContext(
      [
        {
          status: 'active',
          group: { id: 'source' },
          user: { id: 'user' },
          membership_roles: undefined,
        },
      ] as any,
      'user'
    );

    expect(context.activeGroupIds).toEqual(new Set(['source']));
    expect(context.roleIdsByGroupId.get('source')).toEqual(new Set());
    expect(
      internals.getTraversableRelationshipsForPath({
        relationships: [relationship('undefined-source', undefined, 'target')],
        currentPathGroupIds: [],
        membershipContext: context,
      })
    ).toEqual([]);
  });

  it('terminates cyclic traversal while preserving deterministic breadth-first paths', () => {
    const relationships = [
      relationship('source-b', 'source', 'b'),
      relationship('source-a', 'source', 'a'),
      relationship('a-source', 'a', 'source'),
      relationship('b-a', 'b', 'a'),
      relationship('a-target', 'a', 'target'),
      relationship('b-target', 'b', 'target'),
    ];

    expect(
      internals.findShortestProcessPath({
        sourceGroupId: 'source',
        targetGroupId: 'target',
        relationships,
      })
    ).toEqual(['source', 'a', 'target']);
    expect(
      [...internals.collectReachableGroupIds({ sourceGroupId: 'source', relationships })].sort()
    ).toEqual(['a', 'b', 'source', 'target']);
  });

  it('enforces the default extra-step limit and permits a path exactly at max depth', () => {
    const defaultBoundRelationships = [
      relationship('source-target', 'source', 'target'),
      relationship('source-a', 'source', 'a'),
      relationship('a-b', 'a', 'b'),
      relationship('b-c', 'b', 'c'),
      relationship('c-d', 'c', 'd'),
      relationship('d-target', 'd', 'target'),
    ];
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'source',
        targetGroupId: 'target',
        groups: ['source', 'target', 'a', 'b', 'c', 'd'].map(id => group(id)),
        relationships: defaultBoundRelationships,
      }).map(option => option.id)
    ).toEqual(['source>target']);

    const exactDepthIds = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5'];
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'g0',
        targetGroupId: 'g5',
        groups: exactDepthIds.slice(0, 5).map(id => group(id)),
        relationships: exactDepthIds
          .slice(0, -1)
          .map((id, index) =>
            relationship(`${id}-${exactDepthIds[index + 1]}`, id, exactDepthIds[index + 1])
          ),
      })
    ).toEqual([{ id: exactDepthIds.join('>'), groupIds: exactDepthIds }]);

    const overDepthIds = [...exactDepthIds, 'g6'];
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'g0',
        targetGroupId: 'g6',
        groups: exactDepthIds.slice(0, 5).map(id => group(id)),
        relationships: overDepthIds
          .slice(0, -1)
          .map((id, index) =>
            relationship(`${id}-${overDepthIds[index + 1]}`, id, overDepthIds[index + 1])
          ),
      })
    ).toEqual([]);
  });

  it('keeps event lower and upper bounds inclusive and rejects forced boundary branches', () => {
    const now = 100_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const exact = event('exact', 'a', now + 10, now + 20);

    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: new Map([['a', [exact]]]),
        groupId: 'a',
        requiredAfter: now + 10,
        requiredBefore: now + 20,
      })
    ).toBe(exact);
    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: new Map(),
        groupId: 'a',
      })
    ).toBeNull();
    expect(
      getEligibleEventsForPathSegment({
        segment: { groupId: 'a', requiredAfter: now + 10, requiredBefore: now + 20 },
        events: [exact],
      })
    ).toEqual([exact]);

    vi.spyOn(Date, 'now').mockReturnValue(-100);
    const negativeFuture = event('negative-future', 'a', -50, -40);
    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: new Map([['a', [negativeFuture]]]),
        groupId: 'a',
        requiredAfter: null,
      })
    ).toBe(negativeFuture);
    expect(
      getEligibleEventsForPathSegment({
        segment: { groupId: 'a', requiredAfter: null, requiredBefore: null },
        events: [negativeFuture],
      })
    ).toEqual([negativeFuture]);
  });

  it('retains the preceding event window across a missing middle event', () => {
    const now = 200_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const steps = [
      { id: 'first', group_id: 'a', order_index: 0 },
      { id: 'missing', group_id: 'b', order_index: 1 },
      { id: 'third', group_id: 'c', order_index: 2 },
    ];
    const path = calculateWorkflowPathWithClosestEvents(steps, [
      event('a-event', 'a', now + 10, now + 20),
      event('c-too-early', 'c', now + 15, now + 16),
      event('c-valid', 'c', now + 21, now + 22),
    ]);

    expect(path.map(item => item.eventId)).toEqual(['a-event', null, 'c-valid']);
    expect(path.map(item => item.requiredAfter)).toEqual([null, now + 20, now + 20]);

    const hierarchyPath = calculateProcessPathWithClosestEventsForGroupIds({
      groupIds: ['a', 'b', 'c'],
      groups: ['a', 'b', 'c'].map(id => group(id)),
      events: [
        event('a-event', 'a', now + 10, now + 20),
        event('c-too-early', 'c', now + 15, now + 16),
        event('c-valid', 'c', now + 21, now + 22),
      ],
    });
    expect(hierarchyPath?.map(item => item.eventId)).toEqual(['a-event', null, 'c-valid']);
    expect(hierarchyPath?.map(item => item.requiredAfter)).toEqual([null, now + 20, now + 20]);
  });

  it('uses exact direct-source inclusion semantics for self relationships', () => {
    const groups = [group('source'), group('target')];
    const relationships = [
      relationship('self', 'source', 'source'),
      relationship('target', 'source', 'target'),
    ];

    expect(
      getDirectReachableTargetGroupsFromSource({
        sourceGroupId: 'source',
        groups,
        relationships,
        includeSourceGroup: false,
      }).map(item => item.id)
    ).toEqual(['target']);
    expect(
      getDirectReachableTargetGroupsFromSource({
        sourceGroupId: 'source',
        groups,
        relationships,
        includeSourceGroup: true,
      }).map(item => item.id)
    ).toEqual(['source', 'target']);
  });

  it('sorts workflow fallbacks and process steps by exact order indices', () => {
    const unordered = [
      { id: 'last', group_id: 'last', order_index: 2, group: group('last') },
      { id: 'first', group_id: 'first', order_index: 0, group: group('first') },
      { id: 'middle', group_id: 'middle', order_index: 1, group: group('middle') },
    ];

    expect(getWorkflowStartGroupId({ group_id: 'fallback', steps: unordered })).toBe('first');
    expect(getWorkflowFinalGroupId({ group_id: 'fallback', steps: unordered })).toBe('last');
    expect(getWorkflowStartGroupId({ group_id: 'fallback', steps: [] })).toBe('fallback');
    expect(getWorkflowFinalGroupId({ group_id: 'fallback', steps: null })).toBe('fallback');
    expect(getWorkflowFinalGroupId({ group_id: 'fallback', steps: [] })).toBe('fallback');

    const adversarialOrder = [
      { group_id: 'one', order_index: 1 },
      { group_id: 'two', order_index: 2 },
      { group_id: 'zero', order_index: 0 },
    ];
    expect(getWorkflowStartGroupId({ steps: adversarialOrder })).toBe('zero');
    expect(getWorkflowFinalGroupId({ steps: adversarialOrder })).toBe('two');
    expect(
      getWorkflowStartGroupId({
        steps: [
          { group_id: 'one', order_index: 1 },
          { group_id: 'two', order_index: 2 },
        ],
      })
    ).toBe('one');

    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: { start_group_id: 'first', steps: unordered },
        groups: ['source', 'first', 'middle', 'last'].map(id => group(id)),
        relationships: [relationship('source-first', 'source', 'first')],
        events: [],
      })?.map(item => item.groupId)
    ).toEqual(['source', 'first', 'middle', 'last']);
  });

  it('rejects workflows without a usable start and preserves explicit selection mode', () => {
    expect(
      getReachableWorkflowsFromSource({
        sourceGroupId: 'source',
        workflows: [{ id: 'missing', status: 'active', start_group_id: null, steps: [] }],
        groups: [group('source')],
        relationships: [],
      })
    ).toEqual([]);

    expect(
      calculateWorkflowPathWithClosestEvents(
        [
          {
            id: 'explicit',
            group_id: 'source',
            selection_mode: 'explicit_workflow',
          },
        ],
        []
      )[0]?.selectionMode
    ).toBe('explicit_workflow');
    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        targetGroupId: 'source',
        groups: [group('source')],
        relationships: [],
        events: [],
      })?.map(item => item.groupId)
    ).toEqual(['source']);
  });
});

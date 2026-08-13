import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/amendments/logic/amendmentTargetEventEligibility', () => ({
  isAmendmentTargetEventOpen: (event: { status?: string | null }) => event.status !== 'closed',
}));

import {
  amendmentPathHelperInternals as internals,
  calculateProcessPathWithClosestEvents,
  calculateProcessPathWithClosestEventsForGroupIds,
  calculateUpwardPathWithClosestEvents,
  calculateWorkflowPathWithClosestEvents,
  calculateWorkflowProcessPathWithClosestEvents,
  enrichPathSegments,
  getActiveUserGroupIds,
  getDirectReachableTargetGroupsFromSource,
  getEligibleEventsForPathSegment,
  getProcessPathGroupOptions,
  getReachableWorkflowsFromSource,
  getUpwardConnectedGroupsForUser,
  getWorkflowFinalGroupId,
  getWorkflowStartGroupId,
} from '../amendmentPathHelpers';

function group(id: string, name: string | null = id) {
  return { id, name, description: null } as any;
}

function relationship(
  id: string,
  source: string,
  target: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    grant_id: `grant-${id}`,
    with_right: 'amendmentRight',
    status: 'active',
    group_id: source,
    related_group_id: target,
    group: group(source),
    related_group: group(target),
    ...overrides,
  } as any;
}

function event(
  id: string,
  groupId: string | null,
  startDate: number | null,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    title: id,
    group_id: groupId,
    group: null,
    start_date: startDate,
    end_date: null,
    status: 'active',
    ...overrides,
  } as any;
}

function segment(overrides: Record<string, unknown> = {}) {
  return {
    segmentKey: 'segment',
    groupId: 'a',
    groupName: 'A',
    eventId: null,
    eventTitle: 'Pending event',
    eventStartDate: null,
    eventEndDate: null,
    ...overrides,
  } as any;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('amendmentPathHelpers mutation contracts', () => {
  it('preserves exact policy, membership, indexing, and traversal semantics', () => {
    expect(Object.keys(internals).sort()).toEqual(
      [
        'buildGroupsById',
        'buildProcessPathOptionId',
        'buildSegmentsFromGroupIds',
        'buildUpcomingEventsByGroupId',
        'buildUserMembershipTraversalContext',
        'canTraverseRelationship',
        'collectReachableGroupIds',
        'finalizeSegmentWindows',
        'findClosestEligibleEvent',
        'findShortestProcessPath',
        'getAmendmentTraversalEndpoints',
        'getEventOrderingAnchor',
        'getGroupName',
        'getTraversableRelationshipsForPath',
        'isActiveMembershipStatus',
        'isActiveRelationshipStatus',
        'recomputeSegmentWindows',
      ].sort()
    );

    const now = 10_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const indexed = internals.buildUpcomingEventsByGroupId([
      event('at-now', 'a', now),
      event('after-now', 'a', now + 1),
      event('closed', 'a', now + 2, { status: 'closed' }),
      event('nested', null, now + 3, { group: { id: 'a' } }),
    ]);
    expect([...indexed.keys()]).toEqual(['a']);
    expect(indexed.get('a')?.map(item => item.id)).toEqual(['after-now', 'nested']);

    const memberships = [
      { status: 'active', group: { id: 'a' }, user: null, membership_roles: [] },
      { status: 'active', group: { id: 'b' }, user: { id: 'other' }, membership_roles: [] },
      {
        status: 'member',
        group: { id: 'c' },
        user: { id: 'user' },
        membership_roles: [
          { role: { id: 'editor' } },
          { role: { id: 'moderator' } },
          { role: null },
        ],
      },
      { status: 'admin', group: { id: 'c' }, user: { id: 'user' } },
    ] as any;
    const context = internals.buildUserMembershipTraversalContext(memberships, 'user');
    expect([...context.activeGroupIds]).toEqual(['c']);
    expect([...context.roleIdsByGroupId.entries()].map(([id, roles]) => [id, [...roles]])).toEqual([
      ['c', ['editor', 'moderator']],
    ]);
    expect(context.hasUserContext).toBe(true);

    const valid = relationship('valid', 'a', 'b');
    expect(
      [
        valid,
        relationship('missing-grant', 'a', 'b', { grant_id: null }),
        relationship('wrong-right', 'a', 'b', { with_right: 'differentRight' }),
        relationship('inactive', 'a', 'b', { status: 'inactive' }),
      ].map(candidate =>
        internals.canTraverseRelationship({
          relationship: candidate,
          pathGroupIds: ['a'],
          membershipContext: context,
        })
      )
    ).toEqual([true, false, false, false]);
    expect(internals.getAmendmentTraversalEndpoints(valid)).toEqual([
      {
        sourceGroupId: 'a',
        targetGroupId: 'b',
        sourceGroup: group('a'),
        targetGroup: group('b'),
      },
    ]);
  });

  it('enforces path limits, shortest-path alternatives, cycle rejection, and depth boundaries', () => {
    const groups = ['a', 'b', 'c', 'target'].map(id => group(id));
    const relationships = [
      relationship('ab', 'a', 'b'),
      relationship('ac', 'a', 'c'),
      relationship('bt', 'b', 'target'),
      relationship('ct', 'c', 'target'),
      relationship('bc', 'b', 'c'),
      relationship('cb', 'c', 'b'),
      relationship('ba', 'b', 'a'),
    ];

    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: 'target',
        groups,
        relationships,
        maxPaths: 1,
        maxExtraSteps: 0,
      })
    ).toEqual([{ id: 'a>b>target', groupIds: ['a', 'b', 'target'] }]);
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: 'target',
        groups,
        relationships,
        maxPaths: 8,
        maxExtraSteps: 0,
      })
    ).toEqual([
      { id: 'a>b>target', groupIds: ['a', 'b', 'target'] },
      { id: 'a>c>target', groupIds: ['a', 'c', 'target'] },
    ]);
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: 'target',
        groups,
        relationships,
        maxPaths: 8,
        maxExtraSteps: 1,
      }).map(option => option.id)
    ).toEqual(['a>b>target', 'a>c>target', 'a>b>c>target', 'a>c>b>target']);

    const longGroups = Array.from({ length: 8 }, (_, index) => group(`g${index}`));
    const longRelationships = Array.from({ length: 7 }, (_, index) =>
      relationship(`g${index}-g${index + 1}`, `g${index}`, `g${index + 1}`)
    );
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'g0',
        targetGroupId: 'g7',
        groups: longGroups,
        relationships: longRelationships,
      })
    ).toEqual([
      {
        id: 'g0>g1>g2>g3>g4>g5>g6>g7',
        groupIds: ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'],
      },
    ]);
    expect(
      internals.findShortestProcessPath({
        sourceGroupId: 'a',
        targetGroupId: 'target',
        groups,
        relationships,
        events: [],
      })
    ).toEqual(['a', 'b', 'target']);

    const emptyGroup = group('');
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: '',
        targetGroupId: 'target',
        groups: [emptyGroup, group('target')],
        relationships: [relationship('empty-target', '', 'target')],
      })
    ).toEqual([]);
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: '',
        groups: [group('a'), emptyGroup],
        relationships: [relationship('a-empty', 'a', '')],
      })
    ).toEqual([]);
    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: '',
        targetGroupId: 'target',
        groups: [emptyGroup, group('target')],
        relationships: [relationship('empty-target', '', 'target')],
        events: [],
      })
    ).toBeNull();
    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: 'a',
        targetGroupId: '',
        groups: [group('a'), emptyGroup],
        relationships: [relationship('a-empty', 'a', '')],
        events: [],
      })
    ).toBeNull();

    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: 'target',
        groups: [group('a'), group('target')],
        relationships: [
          relationship('first-copy', 'a', 'target'),
          relationship('second-copy', 'a', 'target'),
        ],
      })
    ).toEqual([{ id: 'a>target', groupIds: ['a', 'target'] }]);

    const cyclicRelationships = [
      relationship('a-target', 'a', 'target'),
      relationship('a-b', 'a', 'b'),
      relationship('b-a', 'b', 'a'),
    ];
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: 'target',
        groups: [group('a'), group('b'), group('target')],
        relationships: cyclicRelationships,
        maxExtraSteps: 2,
      })
    ).toEqual([{ id: 'a>target', groupIds: ['a', 'target'] }]);
    expect(
      internals.findShortestProcessPath({
        sourceGroupId: 'a',
        targetGroupId: 'missing',
        groups: [group('a'), group('b')],
        relationships: cyclicRelationships.filter(item => item.id !== 'a-target'),
        events: [],
      })
    ).toBeNull();
  });

  it('keeps event-window boundaries inclusive and segment fields exact', () => {
    const now = 20_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const eventMap = new Map([
      [
        'a',
        [
          event('closed', 'a', now + 10, { status: 'closed' }),
          event('no-start', 'a', null),
          event('before', 'a', now + 4, { end_date: now + 5 }),
          event('after', 'a', now + 20, { end_date: now + 31 }),
          event('lower-bound', 'a', now + 5, { end_date: now + 10 }),
          event('upper-bound', 'a', now + 6, { end_date: now + 30 }),
        ],
      ],
    ]);
    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: eventMap,
        groupId: 'a',
        requiredAfter: now + 5,
        requiredBefore: now + 30,
      })?.id
    ).toBe('lower-bound');
    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: new Map([
          ['a', [event('exact-upper-bound', 'a', now + 6, { end_date: now + 30 })]],
        ]),
        groupId: 'a',
        requiredBefore: now + 30,
      })?.id
    ).toBe('exact-upper-bound');
    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: new Map([
          ['a', [event('without-upper-bound', 'a', now + 6, { end_date: now + 30 })]],
        ]),
        groupId: 'a',
        requiredBefore: null,
      })?.id
    ).toBe('without-upper-bound');

    const eligible = getEligibleEventsForPathSegment({
      segment: { groupId: 'a', requiredAfter: now + 5, requiredBefore: now + 30 },
      events: [
        event('no-start', 'a', null),
        event('at-now', 'a', now),
        event('closed', 'a', now + 7, { status: 'closed' }),
        event('lower-bound', 'a', now + 5, { end_date: now + 10 }),
        event('upper-bound', 'a', now + 6, { end_date: now + 30 }),
        event('too-early', 'a', now + 4),
        event('too-late', 'a', now + 8, { end_date: now + 31 }),
      ],
    });
    expect(eligible.map(item => item.id)).toEqual(['lower-bound', 'upper-bound']);

    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: new Map([
          ['a', [event('no-start-first', 'a', null), event('eligible-second', 'a', now + 1)]],
        ]),
        groupId: 'a',
      })?.id
    ).toBe('eligible-second');

    vi.spyOn(Date, 'now').mockReturnValue(-1);
    expect(
      getEligibleEventsForPathSegment({
        segment: { groupId: 'a', requiredAfter: null, requiredBefore: null },
        events: [event('no-start', 'a', null)],
      })
    ).toEqual([]);
    expect(
      getEligibleEventsForPathSegment({
        segment: { groupId: 'a', requiredAfter: null, requiredBefore: null },
        events: [event('without-upper-bound', 'a', now + 1, { end_date: now + 100 })],
      }).map(item => item.id)
    ).toEqual(['without-upper-bound']);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(
      getEligibleEventsForPathSegment({
        segment: { groupId: 'a', requiredAfter: null, requiredBefore: null },
        events: [event('at-now', 'a', now)],
      })
    ).toEqual([]);

    const built = calculateProcessPathWithClosestEventsForGroupIds({
      groupIds: ['a', 'b'],
      groups: [group('a', 'Alpha'), group('b', 'Beta')],
      events: [event('a-event', 'a', now + 10, { title: null, end_date: now + 15 })],
    });
    expect(built).toEqual([
      {
        segmentKey: 'hierarchy:0:a',
        groupId: 'a',
        groupName: 'Alpha',
        eventId: 'a-event',
        eventTitle: 'Pending event',
        eventStartDate: now + 10,
        eventEndDate: now + 15,
        stepLabel: null,
        stepKind: 'group_vote',
        selectionMode: null,
        mergeStrategy: null,
        eventRule: null,
        autoTaskOnMissingEvent: true,
        targetWorkflowId: null,
        requiredAfter: null,
        requiredBefore: null,
        missingEvent: false,
      },
      {
        segmentKey: 'hierarchy:1:b',
        groupId: 'b',
        groupName: 'Beta',
        eventId: null,
        eventTitle: 'Pending event',
        eventStartDate: null,
        eventEndDate: null,
        stepLabel: null,
        stepKind: 'group_vote',
        selectionMode: null,
        mergeStrategy: null,
        eventRule: null,
        autoTaskOnMissingEvent: true,
        targetWorkflowId: null,
        requiredAfter: now + 15,
        requiredBefore: null,
        missingEvent: true,
      },
    ]);
  });

  it('enriches only the target tail and selects the earliest dated event', () => {
    const randomUUID = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000004');

    expect(enrichPathSegments([], 'target', 'target-event', 'Target', 10)).toEqual([]);
    const untouched = enrichPathSegments(
      [segment({ groupId: 'different', missingEvent: true })],
      'target',
      'target-event',
      'Target',
      10
    );
    expect(untouched[0]).toMatchObject({
      groupId: 'different',
      eventId: null,
      missingEvent: true,
      agendaItemId: null,
      amendmentVoteId: null,
      forwardingStatus: 'previous_decision_outstanding',
    });

    const enriched = enrichPathSegments(
      [
        segment({ groupId: 'undated', eventId: 'undated-event' }),
        segment({ groupId: 'dated', eventId: 'dated-event', eventStartDate: 30 }),
        segment({ groupId: 'target', missingEvent: true }),
      ],
      'target',
      'target-event',
      null,
      40
    );
    expect(enriched.map(item => item.forwardingStatus)).toEqual([
      'previous_decision_outstanding',
      'forward_confirmed',
      'previous_decision_outstanding',
    ]);
    expect(enriched[0]).toMatchObject({
      agendaItemId: '00000000-0000-4000-8000-000000000001',
      amendmentVoteId: '00000000-0000-4000-8000-000000000002',
    });
    expect(enriched[1]).toMatchObject({
      agendaItemId: '00000000-0000-4000-8000-000000000003',
      amendmentVoteId: '00000000-0000-4000-8000-000000000004',
    });
    expect(enriched[2]).toMatchObject({
      eventId: 'target-event',
      eventTitle: 'Pending event',
      eventStartDate: 40,
      eventEndDate: 40,
      missingEvent: false,
    });
    expect(randomUUID).toHaveBeenCalledTimes(6);

    const memberships = [
      { status: 'active', user: null, group: { id: 'missing-user' } },
      { status: 'member', user: { id: 'user' }, group: { id: 'member' } },
      { status: 'inactive', user: { id: 'user' }, group: { id: 'inactive' } },
    ] as any;
    expect(getActiveUserGroupIds(memberships, 'user')).toEqual(['member']);
  });

  it('normalizes every workflow field and preserves ordered prefix composition', () => {
    const now = 30_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const workflowPath = calculateWorkflowPathWithClosestEvents(
      [
        {
          id: 'second',
          group_id: 'b',
          group: { id: 'b', name: 'Beta' },
          order_index: 2,
          label: 'Second',
          step_kind: 'workflow_handoff',
          selection_mode: 'explicit_workflow',
          merge_strategy: 'winner_continues',
          event_rule: 'after-vote',
          auto_task_on_missing_event: false,
          target_workflow_id: 'next-workflow',
        },
        {
          group_id: 'a',
          group: { id: 'a', name: null },
          order_index: 0,
          step_kind: 'invalid',
          selection_mode: 'invalid',
          merge_strategy: 'invalid',
        },
      ],
      [event('a-event', 'a', now + 10, { title: 'Assembly A', end_date: now + 20 })]
    );
    expect(workflowPath).toEqual([
      {
        segmentKey: 'workflow:a:0',
        groupId: 'a',
        groupName: 'Unknown',
        eventId: 'a-event',
        eventTitle: 'Assembly A',
        eventStartDate: now + 10,
        eventEndDate: now + 20,
        stepLabel: null,
        workflowStepId: null,
        stepKind: 'group_vote',
        selectionMode: 'explicit_workflow',
        mergeStrategy: null,
        eventRule: null,
        autoTaskOnMissingEvent: true,
        targetWorkflowId: null,
        requiredAfter: null,
        requiredBefore: null,
        missingEvent: false,
      },
      {
        segmentKey: 'workflow:second',
        groupId: 'b',
        groupName: 'Beta',
        eventId: null,
        eventTitle: 'Pending event',
        eventStartDate: null,
        eventEndDate: null,
        stepLabel: 'Second',
        workflowStepId: 'second',
        stepKind: 'workflow_handoff',
        selectionMode: 'explicit_workflow',
        mergeStrategy: 'winner_continues',
        eventRule: 'after-vote',
        autoTaskOnMissingEvent: false,
        targetWorkflowId: 'next-workflow',
        requiredAfter: now + 20,
        requiredBefore: null,
        missingEvent: true,
      },
    ]);

    expect(
      calculateWorkflowPathWithClosestEvents(
        [
          { id: 'a', group_id: 'a', order_index: 0 },
          { id: 'b', group_id: 'b', order_index: 1 },
        ],
        [
          event('a-event', 'a', now + 10, { end_date: now + 20 }),
          event('b-too-early', 'b', now + 15),
          event('b-eligible', 'b', now + 21),
        ]
      ).map(item => item.eventId)
    ).toEqual(['a-event', 'b-eligible']);

    const unordered = {
      group_id: 'fallback',
      steps: [
        { group_id: 'last', order_index: 3 },
        { group_id: 'first', order_index: null },
        { group_id: 'middle', order_index: 1 },
      ],
    };
    expect(getWorkflowStartGroupId(unordered)).toBe('first');
    expect(getWorkflowFinalGroupId(unordered)).toBe('last');
    expect(
      getWorkflowFinalGroupId({
        steps: [
          { group_id: 'first', order_index: null },
          { group_id: 'middle', order_index: 1 },
          { group_id: 'last', order_index: 2 },
        ],
      })
    ).toBe('last');

    const groups = ['source', 'middle', 'start', 'finish', 'unrelated'].map(id => group(id));
    const relationships = [
      relationship('source-middle', 'source', 'middle'),
      relationship('middle-start', 'middle', 'start'),
    ];
    const workflow = {
      start_group_id: 'start',
      steps: [
        { id: 'finish-step', group_id: 'finish', order_index: 2, group: group('finish') },
        { id: 'start-step', group_id: 'start', order_index: 0, group: group('start') },
      ],
    };
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow,
        groups,
        relationships,
        events: [],
      })?.map(item => [item.groupId, item.segmentKey])
    ).toEqual([
      ['source', 'hierarchy:0:source'],
      ['middle', 'hierarchy:1:middle'],
      ['start', 'workflow:start-step'],
      ['finish', 'workflow:finish-step'],
    ]);
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: { start_group_id: 'source', steps: [] },
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();

    const reachable = getReachableWorkflowsFromSource({
      sourceGroupId: 'source',
      workflows: [
        { id: 'implicit-active', status: null, start_group_id: 'start' },
        { id: 'active', status: 'active', start_group_id: 'start' },
        { id: 'inactive', status: 'inactive', start_group_id: 'start' },
        { id: 'missing-start', status: 'active', start_group_id: null },
        { id: 'unreachable', status: 'active', start_group_id: 'unrelated' },
      ],
      groups,
      relationships,
    });
    expect(reachable.map(item => item.id)).toEqual(['implicit-active', 'active']);

    expect(
      getDirectReachableTargetGroupsFromSource({
        sourceGroupId: 'source',
        groups,
        relationships,
        includeSourceGroup: false,
      }).map(item => item.id)
    ).toEqual(['middle']);
    expect(
      getDirectReachableTargetGroupsFromSource({
        sourceGroupId: 'source',
        groups: [group('source')],
        relationships: [relationship('self', 'source', 'source')],
        includeSourceGroup: false,
      })
    ).toEqual([]);
    expect(
      calculateUpwardPathWithClosestEvents({
        userGroupIds: ['unrelated', 'source'],
        targetGroupId: 'start',
        groups,
        relationships,
        events: [],
      })?.map(item => item.groupId)
    ).toEqual(['source', 'middle', 'start']);
    expect(getUpwardConnectedGroupsForUser([], groups, relationships)).toEqual([]);
    expect(
      getUpwardConnectedGroupsForUser(['source'], groups, relationships).map(item => item.id)
    ).toEqual(['source', 'middle', 'start']);
  });
});

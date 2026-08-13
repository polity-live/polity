import { describe, expect, it, vi } from 'vitest';

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
  getReachableTargetGroupsFromSource,
  getReachableWorkflowsFromSource,
  getUpwardConnectedGroupsForUser,
  getWorkflowFinalGroupId,
  getWorkflowStartGroupId,
  rehydratePathSegmentsWithWindows,
} from '../amendmentPathHelpers';

const future = Date.now() + 1_000_000;

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

describe('amendmentPathHelpers A04 branch contracts', () => {
  it('covers membership, naming, event indexing, and traversal policy primitives', () => {
    expect(['active', 'admin', 'member'].map(internals.isActiveMembershipStatus)).toEqual([
      true,
      true,
      true,
    ]);
    expect(internals.isActiveMembershipStatus('inactive')).toBe(false);
    expect(internals.isActiveRelationshipStatus('active')).toBe(true);
    expect(internals.isActiveRelationshipStatus(null)).toBe(false);
    expect(internals.getGroupName(group('named', 'Named'))).toBe('Named');
    expect(internals.getGroupName({ name: null, description: 'Description' } as any)).toBe(
      'Description'
    );
    expect(internals.getGroupName(null)).toBe('Unknown');
    expect(internals.buildProcessPathOptionId(['a', 'b'])).toBe('a>b');
    expect(internals.buildGroupsById([group('a')]).get('a')?.id).toBe('a');

    const indexed = internals.buildUpcomingEventsByGroupId([
      event('missing-group', null, future),
      event('past', 'a', 1),
      event('closed', 'a', future, { status: 'closed' }),
      event('late', 'a', future + 20),
      event('early', null, future + 10, { group: { id: 'a' } }),
      event('other', 'b', future + 5),
    ]);
    expect(indexed.get('a')?.map((item: any) => item.id)).toEqual(['early', 'late']);
    expect(indexed.get('b')?.[0].id).toBe('other');

    const memberships = [
      { status: 'active', group: null, user: { id: 'user' } },
      { status: 'inactive', group: { id: 'a' }, user: { id: 'user' } },
      { status: 'active', group: { id: 'a' }, user: { id: 'other' } },
      {
        status: 'admin',
        group: { id: 'a' },
        user: { id: 'user' },
        membership_roles: [{ role: { id: 'role-a' } }, { role: null }],
      },
      {
        status: 'member',
        group: { id: 'a' },
        user: { id: 'user' },
        membership_roles: null,
      },
    ] as any;
    const context = internals.buildUserMembershipTraversalContext(memberships, 'user');
    expect([...context.activeGroupIds]).toEqual(['a']);
    expect([...context.roleIdsByGroupId.get('a')!]).toEqual(['role-a']);
    expect(context.hasUserContext).toBe(true);
    expect(internals.buildUserMembershipTraversalContext([], undefined).hasUserContext).toBe(false);

    const valid = relationship('valid', 'a', 'b');
    expect(internals.getAmendmentTraversalEndpoints(valid)[0]).toMatchObject({
      sourceGroupId: 'a',
      targetGroupId: 'b',
    });
    expect(
      internals.getAmendmentTraversalEndpoints({
        ...valid,
        group: undefined,
        related_group: undefined,
      })[0]
    ).toMatchObject({ sourceGroup: null, targetGroup: null });
    for (const candidate of [
      valid,
      relationship('no-grant', 'a', 'b', { grant_id: null }),
      relationship('wrong-right', 'a', 'b', { with_right: 'other' }),
      relationship('inactive', 'a', 'b', { status: 'inactive' }),
    ]) {
      internals.canTraverseRelationship({
        relationship: candidate,
        pathGroupIds: ['a'],
        membershipContext: context,
      });
    }
    expect(
      internals
        .getTraversableRelationshipsForPath({
          relationships: [
            relationship('z', 'a', 'z', { related_group: null }),
            relationship('y', 'a', 'y', { related_group: null }),
            relationship('b', 'a', 'b', { related_group: { id: 'b', name: 'Bee' } }),
            relationship('other-source', 'x', 'c'),
            relationship('invalid', 'a', 'd', { grant_id: null }),
          ],
          currentPathGroupIds: ['a'],
          membershipContext: context,
        })
        .map((item: any) => item.related_group_id)
    ).toEqual(['b', 'y', 'z']);
    expect(
      internals.getTraversableRelationshipsForPath({
        relationships: [],
        currentPathGroupIds: [],
        membershipContext: context,
      })
    ).toEqual([]);
  });

  it('covers breadth-first path discovery, alternatives, cycles, bounds, and reachability', () => {
    const groups = ['a', 'b', 'c', 'd', 'e'].map(id => group(id));
    const relationships = [
      relationship('ab', 'a', 'b'),
      relationship('ab-duplicate', 'a', 'b'),
      relationship('ac', 'a', 'c'),
      relationship('bd', 'b', 'd'),
      relationship('cd', 'c', 'd'),
      relationship('de', 'd', 'e'),
      relationship('ba-cycle', 'b', 'a'),
      relationship('bc', 'b', 'c'),
    ];
    const context = internals.buildUserMembershipTraversalContext([], undefined);

    expect(
      internals.findShortestProcessPath({
        sourceGroupId: 'a',
        targetGroupId: 'a',
        groups,
        relationships,
        events: [],
      })
    ).toEqual(['a']);
    expect(
      internals.findShortestProcessPath({
        sourceGroupId: 'e',
        targetGroupId: 'a',
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
    expect(
      internals.findShortestProcessPath({
        sourceGroupId: 'a',
        targetGroupId: 'e',
        groups,
        relationships,
        events: [],
      })
    ).toEqual(['a', 'b', 'd', 'e']);
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: '',
        targetGroupId: 'e',
        groups,
        relationships,
      })
    ).toEqual([]);
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'root',
        targetGroupId: 'z-target',
        groups: ['root', 'branch', 'tail', 'z-target'].map(id => group(id)),
        relationships: [
          relationship('root-branch', 'root', 'branch'),
          relationship('root-target', 'root', 'z-target'),
          relationship('branch-tail', 'branch', 'tail'),
        ],
        maxExtraSteps: 0,
      })[0].groupIds
    ).toEqual(['root', 'z-target']);
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: '',
        groups,
        relationships,
      })
    ).toEqual([]);
    const options = getProcessPathGroupOptions({
      sourceGroupId: 'a',
      targetGroupId: 'e',
      groups,
      relationships,
      maxPaths: 2,
      maxExtraSteps: 0,
    });
    expect(options.length).toBeGreaterThan(0);
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'a',
        targetGroupId: 'a',
        groups,
        relationships,
        maxPaths: 1,
      })[0].groupIds
    ).toEqual(['a']);

    const longRelationships = Array.from({ length: 8 }, (_, index) =>
      relationship(`long-${index}`, `long-${index}`, `long-${index + 1}`)
    );
    expect(
      getProcessPathGroupOptions({
        sourceGroupId: 'long-0',
        targetGroupId: 'missing',
        groups: [],
        relationships: longRelationships,
      })
    ).toEqual([]);

    const reachable = internals.collectReachableGroupIds({
      sourceGroupId: 'a',
      relationships,
    });
    expect([...reachable]).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd', 'e']));
    expect(
      getReachableTargetGroupsFromSource({
        sourceGroupId: 'a',
        groups,
        relationships,
        includeSourceGroup: false,
      }).map(item => item.id)
    ).toEqual(['b', 'c', 'd', 'e']);
    expect(
      getDirectReachableTargetGroupsFromSource({
        sourceGroupId: 'a',
        groups,
        relationships,
        includeSourceGroup: true,
      }).map(item => item.id)
    ).toEqual(['a', 'b', 'c']);
    expect(getUpwardConnectedGroupsForUser([], groups, relationships)).toEqual([]);
    expect(getUpwardConnectedGroupsForUser(['a', 'e'], groups, relationships).length).toBe(5);
    expect(context.hasUserContext).toBe(false);
  });

  it('covers event windows, eligibility filters, segment building, enrichment, and upward lookup', () => {
    expect(internals.getEventOrderingAnchor(segment({ eventEndDate: 3, eventStartDate: 2 }))).toBe(
      3
    );
    expect(
      internals.getEventOrderingAnchor(segment({ eventEndDate: null, eventStartDate: 2 }))
    ).toBe(2);
    expect(internals.getEventOrderingAnchor(segment())).toBeNull();

    const eventMap = new Map<string, any[]>([
      [
        'a',
        [
          event('closed', 'a', future, { status: 'closed' }),
          event('no-start', 'a', null),
          event('too-early', 'a', 5, { end_date: 6 }),
          event('too-late', 'a', 20, { end_date: 30 }),
          event('eligible', 'a', 12, { end_date: 15 }),
        ],
      ],
    ]);
    expect(
      internals.findClosestEligibleEvent({
        eventsByGroupId: eventMap,
        groupId: 'a',
        requiredAfter: 10,
        requiredBefore: 20,
      })?.id
    ).toBe('eligible');
    expect(
      internals.findClosestEligibleEvent({ eventsByGroupId: eventMap, groupId: 'missing' })
    ).toBeNull();

    const hydrated = rehydratePathSegmentsWithWindows([
      segment({ segmentKey: 'a', eventId: 'event-a', eventStartDate: 10, eventEndDate: 20 }),
      segment({ segmentKey: 'b', groupId: 'b', eventStartDate: null, eventEndDate: null }),
      segment({ segmentKey: 'c', groupId: 'c', eventId: 'event-c', eventStartDate: 30 }),
    ]);
    expect(hydrated[0]).toMatchObject({
      requiredAfter: null,
      requiredBefore: 30,
      missingEvent: false,
    });
    expect(hydrated[1]).toMatchObject({
      requiredAfter: 20,
      requiredBefore: 30,
      missingEvent: true,
    });
    expect(hydrated[2]).toMatchObject({ requiredAfter: 20, requiredBefore: null });

    const eligible = getEligibleEventsForPathSegment({
      segment: { groupId: 'a', requiredAfter: future + 10, requiredBefore: future + 50 },
      events: [
        event('wrong-group', 'b', future + 20),
        event('nested-group', null, future + 30, { group: { id: 'a' } }),
        event('no-start', 'a', null),
        event('past', 'a', 1),
        event('closed', 'a', future + 20, { status: 'closed' }),
        event('before-window', 'a', future + 5),
        event('after-window', 'a', future + 40, { end_date: future + 60 }),
        event('open-late', 'a', future + 30),
        event('open-early', 'a', future + 20),
      ],
    });
    expect(eligible.map(item => item.id)).toEqual(['open-early', 'nested-group', 'open-late']);

    expect(
      calculateProcessPathWithClosestEventsForGroupIds({ groupIds: [], groups: [], events: [] })
    ).toBeNull();
    const built = calculateProcessPathWithClosestEventsForGroupIds({
      groupIds: ['missing', 'a', 'b'],
      groups: [group('a', null), { ...group('b'), name: null, description: 'Bee' }],
      events: [
        event('event-a', 'a', future + 1, { title: null, end_date: future + 2 }),
        event('event-b-early', 'b', future + 1),
        event('event-b', 'b', future + 3),
      ],
      segmentPrefix: 'custom',
    })!;
    expect(built.map(item => item.groupId)).toEqual(['a', 'b']);
    expect(built[0].segmentKey).toContain('custom');
    expect(built[0].eventTitle).toBe('Pending event');

    const enriched = enrichPathSegments(
      [
        segment({ groupId: 'a', eventId: 'event-a', eventStartDate: 20 }),
        segment({ groupId: 'other', eventId: 'event-other', eventStartDate: 30 }),
        segment({ groupId: 'target', eventId: null, eventStartDate: null }),
      ],
      'target',
      'event-target',
      null,
      10,
      undefined
    );
    expect(enriched[2]).toMatchObject({
      eventId: 'event-target',
      eventTitle: 'Pending event',
      eventEndDate: 10,
      forwardingStatus: 'forward_confirmed',
    });
    expect(enriched[0].forwardingStatus).toBe('previous_decision_outstanding');
    expect(enrichPathSegments([], 'target', null, null, null)).toEqual([]);
    expect(
      enrichPathSegments([segment()], 'different-target', null, null, null)[0].forwardingStatus
    ).toBe('previous_decision_outstanding');
    expect(
      enrichPathSegments(
        [segment({ groupId: 'target' })],
        'target',
        'target-event',
        'Target',
        null,
        null
      )[0]
    ).toMatchObject({ eventStartDate: null, eventEndDate: null });
    expect(
      enrichPathSegments(
        [segment({ groupId: 'target' })],
        'target',
        'target-event',
        'Target',
        null,
        50
      )[0].eventEndDate
    ).toBe(50);

    const memberships = [
      { status: 'active', user: { id: 'user' }, group: { id: 'a' } },
      { status: 'admin', user: { id: 'user' }, group: null },
      { status: 'inactive', user: { id: 'user' }, group: { id: 'b' } },
      { status: 'member', user: { id: 'other' }, group: { id: 'c' } },
    ] as any;
    expect(getActiveUserGroupIds(memberships, 'user')).toEqual(['a']);

    const groups = [group('a'), group('b')];
    const relationships = [relationship('ab', 'a', 'b')];
    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: '',
        targetGroupId: 'b',
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: 'b',
        targetGroupId: 'a',
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
    expect(
      calculateUpwardPathWithClosestEvents({
        userGroupIds: ['b', 'a'],
        targetGroupId: 'b',
        groups,
        relationships,
        events: [],
      })?.map(item => item.groupId)
    ).toEqual(['b']);
    expect(
      calculateUpwardPathWithClosestEvents({
        userGroupIds: ['b'],
        targetGroupId: 'a',
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
  });

  it('covers workflow normalization, group fallbacks, reachability, and prefix composition', () => {
    const steps = [
      {
        id: undefined,
        group_id: 'b',
        group: null,
        order_index: null,
        label: null,
        step_kind: 'merge_vote',
        selection_mode: 'default_target_workflow',
        merge_strategy: 'winner_continues',
        event_rule: null,
        auto_task_on_missing_event: null,
        target_workflow_id: null,
      },
      {
        id: 'handoff',
        group_id: 'c',
        group: { id: 'c', name: 'C' },
        order_index: 2,
        label: 'Handoff',
        step_kind: 'workflow_handoff',
        selection_mode: 'explicit_workflow',
        merge_strategy: 'invalid',
        event_rule: 'rule',
        auto_task_on_missing_event: false,
        target_workflow_id: 'next',
      },
      {
        id: 'vote',
        group_id: 'd',
        group: { id: 'd', name: null },
        order_index: 3,
        step_kind: 'invalid',
        selection_mode: 'invalid',
      },
    ] as any;
    const workflowPath = calculateWorkflowPathWithClosestEvents(steps, [
      event('event-b', 'b', future + 1, { end_date: future + 2 }),
      event('event-c-too-early', 'c', future + 1),
      event('event-c', 'c', future + 3),
    ]);
    expect(workflowPath.map(item => item.stepKind)).toEqual([
      'merge_vote',
      'workflow_handoff',
      'group_vote',
    ]);
    expect(workflowPath.map(item => item.selectionMode)).toEqual([
      'default_target_workflow',
      'explicit_workflow',
      'explicit_workflow',
    ]);
    expect(workflowPath[0]).toMatchObject({
      groupName: 'Unknown',
      mergeStrategy: 'winner_continues',
      autoTaskOnMissingEvent: true,
    });
    expect(
      calculateWorkflowPathWithClosestEvents(
        [
          { group_id: 'late', order_index: 2 },
          { group_id: 'early', order_index: null },
        ],
        []
      ).map(item => item.groupId)
    ).toEqual(['early', 'late']);

    expect(getWorkflowStartGroupId({ start_group_id: 'explicit' })).toBe('explicit');
    expect(
      getWorkflowStartGroupId({
        steps: [
          { group_id: 'later', order_index: 2 },
          { group_id: 'first', order_index: null },
        ],
      })
    ).toBe('first');
    expect(getWorkflowStartGroupId({ steps: null, group_id: 'owner' })).toBe('owner');
    expect(getWorkflowStartGroupId({ steps: null, group_id: null })).toBeNull();
    expect(
      getWorkflowStartGroupId({
        steps: [
          { group_id: 'late', order_index: 2 },
          { group_id: 'early', order_index: null },
        ],
      })
    ).toBe('early');
    expect(
      getWorkflowStartGroupId({
        steps: [
          { group_id: 'early', order_index: null },
          { group_id: 'late', order_index: 2 },
        ],
      })
    ).toBe('early');
    expect(
      getWorkflowFinalGroupId({
        steps: [
          { group_id: 'first', order_index: null },
          { group_id: 'last', order_index: 2 },
        ],
      })
    ).toBe('last');
    expect(getWorkflowFinalGroupId({ steps: null, group_id: 'owner' })).toBe('owner');
    expect(getWorkflowFinalGroupId({ steps: null, group_id: null })).toBeNull();
    expect(
      getWorkflowFinalGroupId({
        steps: [
          { group_id: 'late', order_index: 2 },
          { group_id: 'early', order_index: null },
        ],
      })
    ).toBe('late');

    const groups = ['source', 'start', 'b', 'c', 'd', 'other'].map(id => group(id));
    const relationships = [
      relationship('source-start', 'source', 'start'),
      relationship('start-b', 'start', 'b'),
      relationship('source-other', 'source', 'other'),
    ];
    const workflows = [
      { id: 'inactive', status: 'inactive', start_group_id: 'start', steps },
      { id: 'missing-start', status: 'active', start_group_id: null, group_id: null, steps: [] },
      { id: 'unreachable', status: null, start_group_id: 'd', steps },
      { id: 'reachable', status: 'active', start_group_id: 'start', steps },
    ];
    expect(
      getReachableWorkflowsFromSource({
        sourceGroupId: 'source',
        workflows,
        groups,
        relationships,
      }).map(item => item.id)
    ).toEqual(['reachable']);

    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: { steps: [] },
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: { steps: null },
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: { steps: [{ group_id: '', order_index: 0 }] },
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'other',
        workflow: { start_group_id: 'start', steps },
        groups,
        relationships,
        events: [],
      })
    ).toBeNull();
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: { start_group_id: 'start', steps },
        groups,
        relationships,
        events: [],
      })?.map(item => item.groupId)
    ).toEqual(['source', 'start', 'b', 'c', 'd']);
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: {
          start_group_id: 'other',
          steps: [{ id: 'only', group_id: 'b', order_index: 0, group: group('b') }],
        },
        groups,
        relationships,
        events: [],
      })?.map(item => item.groupId)
    ).toEqual(['source', 'other', 'b']);
    expect(
      calculateWorkflowProcessPathWithClosestEvents({
        sourceGroupId: 'source',
        workflow: {
          start_group_id: 'start',
          steps: [
            { id: 'later', group_id: 'b', order_index: 2, group: group('b') },
            { id: 'start', group_id: 'start', order_index: null, group: group('start') },
          ],
        },
        groups,
        relationships,
        events: [],
      })?.map(item => item.groupId)
    ).toEqual(['source', 'start', 'b']);
  });
});

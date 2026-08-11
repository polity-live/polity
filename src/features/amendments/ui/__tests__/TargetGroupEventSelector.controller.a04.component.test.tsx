/* @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const viewPropsMock = vi.hoisted(() => vi.fn());
const tutorialMock = vi.hoisted(() => vi.fn());
const model = vi.hoisted(() => ({
  groups: [] as any[],
  relationships: [] as any[],
  memberships: [] as any[],
  events: [] as any[],
  workflows: [] as any[],
  activeGroupIds: [] as string[],
  reachableGroups: [] as any[],
  reachableWorkflows: [] as any[],
  pathOptions: [] as any[],
  hierarchyPath: null as any,
  fallbackPath: null as any,
  workflowPath: null as any,
  eligibleEvents: [] as any[],
}));

vi.mock('../TargetGroupEventSelectorView', () => ({
  TargetGroupEventSelectorView: (props: any) => {
    viewPropsMock(props);
    return <div data-testid="selector-view" />;
  },
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    allGroups: model.groups,
    allGroupRelationships: model.relationships,
    allGroupMemberships: model.memberships,
    allEvents: model.events,
  }),
}));

vi.mock('@/zero/network/useWorkflowState', () => ({
  useWorkflowState: () => ({ allWorkflows: model.workflows }),
}));

vi.mock('@/features/amendments/logic/amendmentPathHelpers', () => ({
  getActiveUserGroupIds: () => model.activeGroupIds,
  getReachableTargetGroupsFromSource: () => model.reachableGroups,
  getReachableWorkflowsFromSource: () => model.reachableWorkflows,
  getProcessPathGroupOptions: () => model.pathOptions,
  calculateProcessPathWithClosestEventsForGroupIds: () => model.hierarchyPath,
  calculateProcessPathWithClosestEvents: () => model.fallbackPath,
  calculateWorkflowProcessPathWithClosestEvents: () => model.workflowPath,
  getEligibleEventsForPathSegment: () => model.eligibleEvents,
  getWorkflowStartGroupId: (workflow: any) =>
    workflow.start_group_id ?? workflow.steps?.[0]?.group_id ?? workflow.group_id ?? null,
  getWorkflowFinalGroupId: (workflow: any) =>
    workflow.steps?.at(-1)?.group_id ?? workflow.group_id ?? null,
  rehydratePathSegmentsWithWindows: (segments: any[]) => segments.map(segment => ({ ...segment })),
}));

vi.mock('@/features/shared/ui/typeahead/toTypeaheadItems', () => ({
  toTypeaheadItems: (
    items: any[],
    _type: string,
    getTitle: (item: any) => string,
    getSubtitle: (item: any) => string,
    _unused: unknown,
    getHref: (item: any) => string
  ) =>
    items.map(item => ({
      id: item.id,
      title: getTitle(item),
      subtitle: getSubtitle(item),
      href: getHref(item),
    })),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: (...args: unknown[]) => tutorialMock(...args),
}));

vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: { group: { name?: string | null } }) => <div>{group.name}</div>,
}));

vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: ({ event: currentEvent }: { event: { title?: string | null } }) => (
    <div>{currentEvent.title}</div>
  ),
}));

import {
  TargetGroupEventDisplay,
  TargetGroupEventSelector,
  targetGroupEventSelectorInternals,
} from '../TargetGroupEventSelector';

function group(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id.toUpperCase(),
    description: null,
    member_count: null,
    event_count: null,
    amendment_count: null,
    ...overrides,
  } as any;
}

function event(id: string, groupId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: id,
    group_id: groupId,
    group: null,
    start_date: 100,
    end_date: null,
    location_name: null,
    participant_count: null,
    ...overrides,
  } as any;
}

function segment(key: string, groupId: string, overrides: Record<string, unknown> = {}) {
  return {
    segmentKey: key,
    groupId,
    groupName: groupId.toUpperCase(),
    eventId: null,
    eventTitle: 'Pending event',
    eventStartDate: null,
    eventEndDate: null,
    requiredAfter: null,
    requiredBefore: null,
    missingEvent: true,
    ...overrides,
  } as any;
}

function latestProps() {
  return viewPropsMock.mock.calls.at(-1)?.[0] as any;
}

describe('TargetGroupEventSelector A04 controller branches', () => {
  beforeEach(() => {
    model.groups = [group('a'), group('b'), group('c')];
    model.relationships = [];
    model.memberships = [];
    model.events = [];
    model.workflows = [];
    model.activeGroupIds = ['a'];
    model.reachableGroups = [model.groups[1], model.groups[2]];
    model.reachableWorkflows = [];
    model.pathOptions = [{ id: 'a>b', groupIds: ['a', 'b'] }];
    model.hierarchyPath = [segment('a', 'a'), segment('b', 'b')];
    model.fallbackPath = [segment('fallback', 'b')];
    model.workflowPath = null;
    model.eligibleEvents = [];
    viewPropsMock.mockClear();
    tutorialMock.mockClear();
  });

  afterEach(() => cleanup());

  it('covers primitive formatting, deduplication, and sparse display cards', () => {
    expect(targetGroupEventSelectorInternals.formatEventWindowLabel(null)).toBeNull();
    expect(targetGroupEventSelectorInternals.formatEventWindowLabel(1)).toBeTruthy();
    expect(
      targetGroupEventSelectorInternals
        .dedupeGroupsById([group('a'), group('a'), group('b')])
        .map(item => item.id)
    ).toEqual(['a', 'b']);

    const { rerender } = render(
      <TargetGroupEventDisplay
        groupData={group('a', { name: null })}
        eventData={null}
        pathWithEvents={[]}
      />
    );
    rerender(
      <TargetGroupEventDisplay
        groupData={group('a')}
        eventData={event('event', 'a', {
          title: null,
          start_date: null,
          location_name: null,
          description: null,
          participant_count: null,
        })}
        pathWithEvents={[
          segment('one', 'a', { eventId: 'event', eventTitle: null, stepLabel: 'First step' }),
          segment('two', 'b'),
        ]}
      />
    );
  });

  it('covers hierarchy selection, handler guards, event changes, and emitted selection dedupe', async () => {
    const onSelect = vi.fn();
    const callbacks = {
      onSourceGroupSelectionChange: vi.fn(),
      onGroupSelectionChange: vi.fn(),
      onPathModeChange: vi.fn(),
      onWorkflowSelectionChange: vi.fn(),
    };
    model.groups = [
      group('a', { tutorial_run_id: 'tutorial' }),
      group('a', { name: 'duplicate' }),
      group('b', { tutorial_run_id: 'tutorial' }),
      group('c'),
    ];
    model.activeGroupIds = ['a'];
    model.reachableGroups = [model.groups[2], model.groups[3]];
    model.events = [
      event('event-b', 'b', { title: null, start_date: null }),
      event('event-b-2', 'b', { start_date: 200, location_name: 'Hall' }),
      event('event-c', 'c'),
    ];
    model.eligibleEvents = model.events.slice(0, 2);

    render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        layoutScope="amendment-process-start"
        allowGroupWithoutEvent
        allowSourceGroupAsTarget
        excludedSourceGroupIds={['excluded']}
        {...callbacks}
      />
    );

    await act(async () => latestProps().handleSourceGroupSelection({ id: 'missing' }));
    await act(async () => latestProps().handleStartGraphGroupClick('missing'));
    await act(async () => latestProps().handleTargetGraphGroupClick('missing'));
    await act(async () => latestProps().onTargetEventChange({ id: 'missing' }));
    await act(async () => latestProps().handleSourceGroupSelection({ id: 'a' }));
    await waitFor(() => expect(latestProps().selectedSourceGroup?.id).toBe('a'));
    expect(tutorialMock).toHaveBeenCalled();
    await act(async () => latestProps().handleTargetGraphGroupClick('a'));
    await waitFor(() => expect(latestProps().selectedGroup?.id).toBe('a'));
    await act(async () => latestProps().onTargetGroupChange({ id: 'missing' }));
    await act(async () => latestProps().handleTargetGraphGroupClick('missing'));
    await act(async () => latestProps().onTargetGroupChange({ id: 'b' }));
    await waitFor(() => expect(latestProps().pathWithEvents.length).toBe(2));
    await waitFor(() => expect(onSelect).toHaveBeenCalled());

    await act(async () => latestProps().onPathSegmentEventChange('missing', null));
    await act(async () => latestProps().onPathSegmentEventChange('a', { id: 'missing' }));
    await act(async () => latestProps().onPathSegmentEventChange('a', null));
    await act(async () => latestProps().onTargetEventChange({ id: 'event-b' }));
    await act(async () => latestProps().onTargetEventChange({ id: 'event-b-2' }));
    await waitFor(() => expect(latestProps().selectedEvent?.id).toBe('event-b-2'));
    await act(async () => latestProps().onTargetEventChange(null));
    await act(async () => latestProps().onHierarchyPathValueChange('alternate'));
    await act(async () => latestProps().onSelectedUserChange(null));
    await act(async () => latestProps().onSelectedUserChange({ id: 'collaborator' }));
    await act(async () => latestProps().onTargetGroupChange(null));
    await act(async () => latestProps().handleSourceGroupSelection(null));
    expect(callbacks.onSourceGroupSelectionChange).toHaveBeenCalledWith(null);
    expect(callbacks.onGroupSelectionChange).toHaveBeenCalledWith(null);
  });

  it('covers fixed workflow, invalid workflow, workflow target, and path validation branches', async () => {
    const onSelect = vi.fn();
    const workflow = {
      id: 'workflow',
      start_group_id: 'a',
      group_id: 'c',
      steps: [{ id: 'step', group_id: 'c' }],
    };
    model.workflows = [workflow];
    model.reachableWorkflows = [workflow];
    model.workflowPath = [
      segment('workflow-a', 'a', { eventId: 'event-a', eventStartDate: 20, eventEndDate: 30 }),
      segment('workflow-c', 'c', {
        eventId: 'event-c',
        eventStartDate: 10,
        eventEndDate: 40,
        requiredAfter: 30,
        requiredBefore: 35,
      }),
    ];
    model.events = [event('event-a', 'a'), event('event-c', 'c')];
    model.eligibleEvents = model.events;
    const onWorkflowSelectionChange = vi.fn();
    const { rerender } = render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        fixedWorkflowId="workflow"
        fixedTargetGroupId="c"
        lockTargetSelection
        selectedSourceGroupId="a"
        selectedGroupId="c"
        selectedEventId="event-c"
        onWorkflowSelectionChange={onWorkflowSelectionChange}
      />
    );
    await waitFor(() => expect(latestProps().pathMode).toBe('workflow'));
    await waitFor(() => expect(latestProps().selectedGroup?.id).toBe('c'));
    await waitFor(() => expect(latestProps().pathValidationError).toBeTruthy());
    expect(onSelect).toHaveBeenCalledWith(null);

    await act(async () => latestProps().onWorkflowItemChange(null));
    await act(async () => latestProps().onWorkflowItemChange({ id: 'workflow' }));
    await act(async () => latestProps().onPathModeValueChange('hierarchy'));
    expect(onWorkflowSelectionChange).toHaveBeenCalledWith(null);
    await act(async () => latestProps().onPathModeValueChange('workflow'));

    model.reachableWorkflows = [];
    rerender(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedPathMode="workflow"
        selectedWorkflowId="workflow"
        onWorkflowSelectionChange={onWorkflowSelectionChange}
      />
    );
    await waitFor(() => expect(onWorkflowSelectionChange).toHaveBeenCalledWith(null));
  });

  it('covers null network data, controlled prefills, unavailable paths, and fallback calculation', async () => {
    model.groups = null as never;
    model.relationships = null as never;
    model.memberships = null as never;
    model.events = null as never;
    model.workflows = [];
    model.activeGroupIds = [];
    const onSelect = vi.fn();
    const sparse = render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="missing"
        selectedGroupId="missing"
        selectedEventId="missing"
        selectedPathMode="hierarchy"
        selectedWorkflowId=""
      />
    );
    expect(latestProps().networkGroups).toEqual([]);
    sparse.unmount();

    model.groups = [group('only'), group('target')];
    model.activeGroupIds = ['only'];
    model.reachableGroups = [model.groups[1]];
    model.pathOptions = [];
    model.hierarchyPath = null;
    model.fallbackPath = null;
    render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="only"
        selectedGroupId="target"
        allowGroupWithoutEvent={false}
      />
    );
    await waitFor(() => expect(latestProps().selectedSourceGroup?.id).toBe('only'));
    await waitFor(() => expect(latestProps().selectedGroup?.id).toBe('target'));
    await waitFor(() => expect(latestProps().pathValidationError).toBeTruthy());

    model.fallbackPath = [segment('fallback-target', 'target')];
    await act(async () => latestProps().onTargetGroupChange(null));
    await act(async () => latestProps().onTargetGroupChange({ id: 'target' }));
    await waitFor(() => expect(latestProps().pathWithEvents).toHaveLength(1));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('covers workflow group misses, reachable workflow retention, and nullable workflow props', async () => {
    const onSelect = vi.fn();
    const missingGroupsWorkflow = {
      id: 'workflow-missing-groups',
      start_group_id: 'missing-start',
      group_id: 'missing-final',
      steps: [{ group_id: 'missing-final' }],
    };
    model.workflows = [missingGroupsWorkflow];
    model.reachableWorkflows = [missingGroupsWorkflow];
    const first = render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        fixedWorkflowId="workflow-missing-groups"
        selectedSourceGroupId="a"
      />
    );
    await waitFor(() => expect(latestProps().selectedWorkflow).toBeTruthy());
    expect(latestProps().selectedWorkflowStartGroup).toBeNull();
    expect(latestProps().selectedWorkflowFinalGroup).toBeNull();
    first.unmount();

    viewPropsMock.mockClear();
    render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedPathMode="workflow"
        selectedWorkflowId="workflow-missing-groups"
      />
    );
    await waitFor(() => expect(latestProps().selectedSourceGroup?.id).toBe('a'));
    await waitFor(() =>
      expect(latestProps().selectedWorkflowIdState).toBe('workflow-missing-groups')
    );

    cleanup();
    render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedWorkflowId={null as never}
      />
    );
    await waitFor(() => expect(latestProps().selectedWorkflowIdState).toBe(''));

    cleanup();
    render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        fixedWorkflowId="missing-workflow"
        selectedSourceGroupId="a"
      />
    );
    await waitFor(() => expect(latestProps().selectedSourceGroup?.id).toBe('a'));
    expect(latestProps().selectedWorkflow).toBeNull();

    cleanup();
    model.reachableWorkflows = [missingGroupsWorkflow];
    render(<TargetGroupEventSelector userId="user" onSelect={onSelect} />);
    await act(async () => latestProps().handleSourceGroupSelection({ id: 'a' }));
    await waitFor(() => expect(latestProps().selectedSourceGroup?.id).toBe('a'));
    await act(async () => latestProps().onWorkflowItemChange({ id: 'workflow-missing-groups' }));
    await waitFor(() =>
      expect(latestProps().selectedWorkflowIdState).toBe('workflow-missing-groups')
    );
  });

  it('covers missing controlled target/event prefills and selected-event path synchronization', async () => {
    const onSelect = vi.fn();
    const missing = render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedGroupId="missing-target"
        selectedEventId="missing-event"
      />
    );
    await waitFor(() => expect(latestProps().selectedSourceGroup?.id).toBe('a'));
    expect(latestProps().selectedGroup).toBeNull();
    missing.unmount();

    viewPropsMock.mockClear();
    const missingEvent = render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedGroupId="b"
        selectedEventId="missing-event"
      />
    );
    await waitFor(() => expect(latestProps().selectedGroup?.id).toBe('b'));
    expect(latestProps().selectedEvent).toBeNull();
    missingEvent.unmount();

    viewPropsMock.mockClear();
    model.events = [
      event('event-old', 'b'),
      event('event-new', 'wrong-group'),
      event('event-new', 'b', {
        group_id: null,
        group: { id: 'b' },
        title: null,
        start_date: null,
        end_date: null,
      }),
    ];
    model.eligibleEvents = model.events;
    model.hierarchyPath = [
      segment('a', 'a'),
      segment('b', 'b', { eventId: 'event-old', eventTitle: 'Old' }),
    ];
    const { rerender } = render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedGroupId="b"
        selectedEventId="event-new"
        allowGroupWithoutEvent
      />
    );
    await waitFor(() => expect(latestProps().selectedEvent?.id).toBe('event-new'));
    await waitFor(() =>
      expect(latestProps().pathWithEvents.find((item: any) => item.groupId === 'b')?.eventId).toBe(
        'event-new'
      )
    );
    model.events = [event('event-old', 'b')];
    model.eligibleEvents = [];
    model.hierarchyPath = [segment('a', 'a'), segment('b', 'b')];
    rerender(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedGroupId="b"
        selectedEventId="event-new"
        allowGroupWithoutEvent
        disablePortal
      />
    );
    await waitFor(() => expect(latestProps().selectedEvent).toBeNull());
  });

  it('covers selected target and source reconciliation as available options change', async () => {
    const onSelect = vi.fn();
    const onGroupSelectionChange = vi.fn();
    const onSourceGroupSelectionChange = vi.fn();
    const { rerender } = render(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedGroupId="b"
        onGroupSelectionChange={onGroupSelectionChange}
        onSourceGroupSelectionChange={onSourceGroupSelectionChange}
      />
    );
    await waitFor(() => expect(latestProps().selectedGroup?.id).toBe('b'));
    await act(async () => latestProps().onHierarchyPathValueChange('stale-path'));

    model.pathOptions = [];
    model.reachableGroups = [model.groups[2]];
    model.groups = [...model.groups];
    rerender(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        selectedGroupId="b"
        onGroupSelectionChange={onGroupSelectionChange}
        onSourceGroupSelectionChange={onSourceGroupSelectionChange}
        disablePortal
      />
    );
    await waitFor(() => expect(latestProps().selectedHierarchyPathId).toBe(''));
    expect(latestProps().selectedGroup?.id).toBe('b');

    model.reachableGroups = [];
    model.groups = [...model.groups];
    rerender(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        onGroupSelectionChange={onGroupSelectionChange}
        onSourceGroupSelectionChange={onSourceGroupSelectionChange}
        layoutScope="empty-options"
      />
    );
    expect(latestProps().selectedGroup?.id).toBe('b');

    model.reachableGroups = [model.groups[2]];
    model.groups = [...model.groups];
    rerender(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        selectedSourceGroupId="a"
        onGroupSelectionChange={onGroupSelectionChange}
        onSourceGroupSelectionChange={onSourceGroupSelectionChange}
        layoutScope="replace-options"
      />
    );
    await waitFor(() => expect(latestProps().selectedGroup).toBeNull());
    expect(onGroupSelectionChange).toHaveBeenCalledWith(null);

    await act(async () => latestProps().handleSourceGroupSelection({ id: 'a' }));
    model.activeGroupIds = ['c'];
    model.groups = [...model.groups];
    rerender(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        onGroupSelectionChange={onGroupSelectionChange}
        onSourceGroupSelectionChange={onSourceGroupSelectionChange}
        layoutScope="amendment-process-start"
      />
    );
    await waitFor(() => expect(latestProps().selectedSourceGroup).toBeNull());
    expect(onSourceGroupSelectionChange).toHaveBeenCalledWith(null);
  });

  it('preserves only still-eligible events on recalculation and covers final-segment fallbacks', async () => {
    const onSelect = vi.fn();
    model.events = [
      event('event-a', 'a', { title: null, start_date: null, end_date: null }),
      event('event-b', 'b', { title: null, start_date: null, end_date: null }),
    ];
    model.eligibleEvents = model.events;
    const { rerender } = render(
      <TargetGroupEventSelector userId="user" onSelect={onSelect} allowGroupWithoutEvent />
    );
    await act(async () => latestProps().handleSourceGroupSelection({ id: 'a' }));
    await act(async () => latestProps().onTargetGroupChange({ id: 'b' }));
    await waitFor(() => expect(latestProps().pathWithEvents).toHaveLength(2));
    await act(async () => latestProps().onTargetEventChange({ id: 'event-b' }));
    await waitFor(() => expect(latestProps().selectedEvent?.id).toBe('event-b'));
    await act(async () => latestProps().onPathSegmentEventChange('a', { id: 'event-a' }));
    await waitFor(() =>
      expect(latestProps().pathWithEvents.find((item: any) => item.groupId === 'a')?.eventId).toBe(
        'event-a'
      )
    );

    model.eligibleEvents = [model.events[1]];
    model.events = [...model.events];
    rerender(
      <TargetGroupEventSelector
        userId="user"
        onSelect={onSelect}
        allowGroupWithoutEvent
        disablePortal
      />
    );
    await waitFor(() =>
      expect(
        latestProps().pathWithEvents.find((item: any) => item.groupId === 'a')?.eventId
      ).toBeNull()
    );

    model.pathOptions = [{ id: 'ghost', groupIds: ['ghost'] }];
    model.hierarchyPath = [segment('ghost', 'ghost', { eventId: 'ghost-event' })];
    await act(async () => latestProps().onHierarchyPathValueChange('ghost'));
    await waitFor(() => expect(latestProps().pathWithEvents[0]?.groupId).toBe('ghost'));
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'ghost-event', eventData: null })
      )
    );
  });
});

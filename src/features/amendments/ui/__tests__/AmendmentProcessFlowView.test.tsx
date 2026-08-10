/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AmendmentProcessFlowView,
  amendmentProcessFlowViewInternals,
  type AmendmentProcessFlowViewProps,
} from '../AmendmentProcessFlowView';

const branchSelectorMock = vi.hoisted(() => vi.fn(() => <div data-testid="branch-selector" />));
const pathVisualizationMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div
      data-testid="path-visualization"
      data-segment-count={String((props.enrichedPathData as unknown[]).length)}
    />
  ))
);
const languageStoreState = vi.hoisted(() => ({ language: 'de' }));
const tutorialState = vi.hoisted(() => ({ active: false }));
const actionOverlayMock = vi.hoisted(() => vi.fn(() => <div data-testid="action-overlay" />));
const typeaheadMock = vi.hoisted(() => vi.fn(() => <div data-testid="typeahead-search" />));
const dialogPropsMock = vi.hoisted(() => vi.fn());
const scrollableDialogPropsMock = vi.hoisted(() => vi.fn());
const toTypeaheadItemsMock = vi.hoisted(() =>
  vi.fn(
    (
      items: any[],
      _type: string,
      getTitle: (item: any) => string,
      getSubtitle: (item: any) => string,
      _unused: unknown,
      getHref: (item: any) => string
    ) => {
      for (const item of items) {
        getTitle(item);
        getSubtitle(item);
        getHref(item);
      }
      return [];
    }
  )
);

vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: { getState: () => languageStoreState },
}));

vi.mock('@/features/app-tutorial/events', () => ({
  isAppTutorialActiveInDocument: () => tutorialState.active,
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: actionOverlayMock,
}));

vi.mock('@/features/shared/ui/ui/dialog', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/ui/dialog')>();
  return {
    ...actual,
    Dialog: (props: ComponentProps<typeof actual.Dialog>) => {
      dialogPropsMock(props);
      const ActualDialog = actual.Dialog;
      return <ActualDialog {...props} />;
    },
  };
});

vi.mock('@/features/shared/ui/dialog', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/dialog')>();
  return {
    ...actual,
    ScrollableDialogContent: (props: ComponentProps<typeof actual.ScrollableDialogContent>) => {
      scrollableDialogPropsMock(props);
      const ActualContent = actual.ScrollableDialogContent;
      return <ActualContent {...props} />;
    },
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;
    const query = search?.branch ? `?branch=${search.branch}` : '';

    return (
      <a href={`${href ?? '#'}${query}`} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EditingModeBadge: () => <span data-testid="editing-mode-badge" />,
  getAmendmentProcessInfoBadgeClassName: () => '',
  getAmendmentProcessStatusBadgeClassName: () => '',
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({
    children,
    value,
    ...props
  }: {
    children: ReactNode;
    value: string;
    [key: string]: unknown;
  }) => (
    <div role="tabpanel" data-value={value} {...props}>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: ReactNode }) => <div role="tablist">{children}</div>,
  TabsTrigger: ({
    children,
    value,
    ...props
  }: {
    children: ReactNode;
    value: string;
    [key: string]: unknown;
  }) => (
    <button type="button" role="tab" data-value={value} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/amendments/ui/AmendmentBranchSelectorSection', () => ({
  AmendmentBranchSelectorSection: branchSelectorMock,
}));

vi.mock('@/features/network/ui/AmendmentPathVisualization', () => ({
  AmendmentPathVisualization: pathVisualizationMock,
}));

vi.mock('@/features/amendments/ui/TargetGroupEventSelector', () => ({
  TargetGroupEventDisplay: () => <div data-testid="target-group-event-display" />,
  TargetGroupEventSelector: () => <div data-testid="target-group-event-selector" />,
}));

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: typeaheadMock,
}));

vi.mock('@/features/shared/ui/typeahead/toTypeaheadItems', () => ({
  toTypeaheadItems: toTypeaheadItemsMock,
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/groups/logic/groupAmendmentStatus', () => ({
  normalizeGroupAmendmentDisplayStatus: (status?: string | null) =>
    status === 'raw' ? null : (status ?? null),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (
    _key: string,
    paramsOrFallback?: string | Record<string, unknown>,
    fallback?: string
  ) => (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? _key,
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) =>
      (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  languageStoreState.language = 'de';
  tutorialState.active = false;
});

function t(key: string, paramsOrFallback?: string | Record<string, string | number>) {
  const translations: Record<string, string> = {
    'features.amendments.process.title': 'Antragsprozess',
    'features.amendments.process.activeRunDescription': 'Active run',
    'features.amendments.process.addAdditionalPath': 'Add additional path',
    'features.amendments.process.targetGroup': 'Zielgruppe',
    'features.amendments.process.branchCount': '{{count}} text variants',
    'features.amendments.process.branchCount_one': '{{count}} text variant',
    'features.amendments.process.branchCount_other': '{{count}} text variants',
    'features.amendments.process.openTasks': '{{count}} open tasks',
    'features.amendments.process.openTasks_one': '{{count}} open task',
    'features.amendments.process.openTasks_other': '{{count}} open tasks',
    'features.amendments.process.flowTab': 'Flow',
    'features.amendments.process.stepsTab': 'Steps',
    'features.amendments.process.pathVisualization': 'Process flow',
    'features.amendments.process.activeBranch': 'Active branch steps',
    'features.amendments.process.activeBranchDescription': 'Selected branch',
    'features.amendments.process.step': 'Step',
    'features.amendments.process.currentStep': 'Current step',
    'features.amendments.process.pendingEvent': 'Event pending',
    'features.amendments.process.branches': 'Branches',
    'features.amendments.process.branchesDescription': 'Branch overview',
    'features.amendments.process.branchBadge': 'Branch',
    'features.amendments.process.activeBranchBadge': 'Active',
    'features.amendments.process.branchDocumentMissing': 'No text variant',
    'features.amendments.process.openChangeRequests': 'open change requests',
    'features.amendments.process.openTextVariant': 'Open text variant',
    'features.amendments.process.editEvents': 'Edit events',
    'features.amendments.process.groupDecisions': 'Group decisions',
    'features.amendments.process.groupDecisionsDescription': 'Group decisions',
    'features.amendments.process.noGroupDecisions': 'No group decisions',
  };

  const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined;
  const pluralKey =
    typeof params?.count === 'number' ? `${key}_${params.count === 1 ? 'one' : 'other'}` : key;
  const template =
    translations[pluralKey] ??
    translations[key] ??
    (typeof paramsOrFallback === 'string' ? paramsOrFallback : key);

  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    params?.[name] === undefined ? match : String(params[name])
  );
}

function step(id: string, branchId: string, order: number, groupName: string) {
  return {
    id,
    branch_id: branchId,
    order_index: order,
    status: order === 0 ? 'completed' : 'scheduled',
    decision_status: null,
    event_id: null,
    event: null,
    starts_at: null,
    step_kind: 'group_vote',
    target_group: {
      id: `${id}-group`,
      name: groupName,
    },
    workflow_step: null,
    workflow: null,
  };
}

function branch(id: string, groupName: string) {
  return {
    id,
    title: groupName,
    status: 'scheduled',
    resolution: null,
    document_id: null,
    change_requests: [],
    tasks: [],
    step_runs: [step(`${id}-step`, id, 0, groupName)],
  };
}

function baseProps(): AmendmentProcessFlowViewProps {
  const branches = [
    branch('branch-1', 'Other Branch Group'),
    branch('branch-2', 'Selected Branch Group'),
  ];
  const selectedSteps = branches[1].step_runs;

  return {
    amendmentId: 'amendment-1',
    t,
    navigate: vi.fn(),
    user: { id: 'user-1' },
    selectorOpen: false,
    setSelectorOpen: vi.fn(),
    pendingSelection: null,
    setPendingSelection: vi.fn(),
    isSaving: false,
    setIsSaving: vi.fn(),
    processSubmission: {
      isActive: false,
      status: 'idle',
      progressSteps: [],
      error: null,
      reset: vi.fn(),
      retry: vi.fn(),
    } as never,
    createAmendmentPath: vi.fn(),
    updateAmendment: vi.fn(),
    amendment: {
      id: 'amendment-1',
      title: 'Amendment',
      reason: 'Unique amendment details reason',
      preamble: 'Unique amendment details preamble',
      editing_mode: 'view',
      group: null,
    },
    collaborators: [],
    isLoading: false,
    currentRun: {
      id: 'run-1',
      status: 'scheduled',
      implementation_status: null,
      active_branch_id: 'branch-1',
      selected_source_group: { id: 'source-1', name: 'B1' },
      selected_target_group: { id: 'target-1', name: 'K1' },
      selected_target_workflow: { name: 'Workflow A' },
    },
    allRuns: [],
    historicalRuns: [],
    branches,
    currentRunStepRuns: [],
    displayPath: null,
    displayPathSegments: [],
    displayPathSegmentByStepRunId: new Map(),
    displayPathSegmentByOrder: new Map(),
    currentRunDisplayStepRuns: [],
    derivedActiveStepRun: null,
    resolvedActiveBranchId: 'branch-2',
    selectedBranchId: 'branch-2',
    activeBranch: branches[1],
    activeBranchStepRuns: selectedSteps,
    firstUnresolvedStepId: selectedSteps[0].id,
    openTasks: [
      {
        id: 'task-1',
        step_run_id: selectedSteps[0].id,
        status: 'open',
        task_type: 'schedule_event',
      },
    ],
    groupDecisions: [],
    groupTypeById: new Map(),
    pathVisualizationData: [{ groupName: 'Selected Branch Group' }],
    branchDiffCandidates: [],
    defaultBranchDiffRightCandidateId: null,
    onBranchChange: vi.fn(),
    selectorCollaborators: [],
    existingBranchStartGroupIds: [],
    currentRunPathMode: 'hierarchy',
    eventEditorBranch: null,
    branchEventEditorRows: [],
    eventDraftsByStepRunId: {},
    isReplanningBranchEvents: false,
    openBranchEventEditor: vi.fn(),
    closeBranchEventEditor: vi.fn(),
    updateBranchEventDraft: vi.fn(),
    saveBranchEventReplan: vi.fn(),
    handleConfirmSelection: vi.fn(),
  };
}

describe('AmendmentProcessFlowView branch redesign', () => {
  it('covers formatting, badge, group-reference, and event-reference primitives', () => {
    const { formatDateTime, getBadgeVariant, GroupReference, EventReference } =
      amendmentProcessFlowViewInternals;

    expect(formatDateTime(null)).toBe('features.amendments.process.notScheduled');
    languageStoreState.language = 'en';
    expect(formatDateTime(Date.UTC(2026, 0, 2, 3, 4))).toContain('2026');
    for (const status of [
      'approved',
      'accepted',
      'completed',
      'merged',
      'rejected',
      'pending_event',
      'scheduled',
      'in_vote',
      'supported',
      'unknown',
      null,
    ]) {
      expect(getBadgeVariant(status)).toBeTruthy();
    }

    const emptyGroup = render(<GroupReference group={null} />);
    expect(emptyGroup.container.innerHTML).toBe('');
    emptyGroup.unmount();
    const plainGroup = render(<GroupReference group={{ name: 'Plain group' }} />);
    expect(screen.getByText('Plain group')).toBeTruthy();
    plainGroup.unmount();
    const emptyEvent = render(<EventReference event={{ id: 'event' }} />);
    expect(emptyEvent.container.innerHTML).toBe('');
    emptyEvent.unmount();
    render(<EventReference event={{ title: 'Unlinked event' }} />);
    expect(screen.getByText('Unlinked event')).toBeTruthy();
  });

  it('moves the start-group tutorial anchor from the opener into the selector', () => {
    const props = { ...baseProps(), currentRun: null };
    const { rerender } = render(<AmendmentProcessFlowView {...props} />);
    const opener = screen.getByRole('button', { name: 'Create path' });

    expect(opener.getAttribute('data-tutorial-anchor')).toBe('tutorial-process-start-group');

    rerender(<AmendmentProcessFlowView {...props} selectorOpen />);

    expect(opener.getAttribute('data-tutorial-anchor')).toBeNull();
    expect(screen.getByTestId('target-group-event-selector')).toBeTruthy();
  });

  it('renders the public process read-only without management actions', () => {
    render(<AmendmentProcessFlowView {...baseProps()} user={null} canManageProcess={false} />);

    expect(screen.getByText('Antragsprozess')).toBeTruthy();
    expect(screen.getByTestId('branch-selector')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open text variant' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Unique amendment details reason')).toBeNull();
    expect(screen.queryByText('Unique amendment details preamble')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add additional path' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit events' })).toBeNull();
  });

  it('hides the source group from the summary and shows process stats', () => {
    render(<AmendmentProcessFlowView {...baseProps()} />);

    expect(screen.getByText('Antragsprozess')).toBeTruthy();
    expect(screen.queryByText('B1')).toBeNull();
    expect(screen.getByText('K1')).toBeTruthy();
    expect(screen.getByText('Workflow A')).toBeTruthy();
    expect(screen.getByText('2 text variants')).toBeTruthy();
    expect(screen.getByText('1 open task')).toBeTruthy();
  });

  it('renders the shared branch switcher and default flow tab for the selected branch', () => {
    render(<AmendmentProcessFlowView {...baseProps()} />);

    expect(screen.getByTestId('branch-selector')).toBeTruthy();
    expect(branchSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedBranchId: 'branch-2',
      }),
      undefined
    );
    expect(screen.getByTestId('path-visualization').getAttribute('data-segment-count')).toBe('1');
    expect(pathVisualizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enrichedPathData: [{ groupName: 'Selected Branch Group' }],
      }),
      undefined
    );
  });

  it('renders the branches section without a shared outer card', () => {
    render(<AmendmentProcessFlowView {...baseProps()} />);

    const heading = screen.getByRole('heading', { name: 'Branches' });
    expect(heading.closest('[data-slot="card"]')).toBeNull();
    expect(screen.getByText('Branch overview')).toBeTruthy();
  });

  it('shows only the selected branch steps in the steps tab', () => {
    render(<AmendmentProcessFlowView {...baseProps()} />);

    const stepsTab = screen.getByTestId('amendment-process-steps-tab');
    expect(within(stepsTab).getAllByText('Selected Branch Group').length).toBeGreaterThan(0);
    expect(within(stepsTab).queryByText('Other Branch Group')).toBeNull();
  });

  it('dispatches process management and replan actions through stable intents', () => {
    const initial = baseProps();
    const { container, rerender } = render(<AmendmentProcessFlowView {...initial} />);

    fireEvent.click(
      container.querySelector('[data-action-id="amendments.process-path.open.selector"]')!
    );
    expect(initial.setPendingSelection).toHaveBeenCalledWith(null);
    expect(initial.setSelectorOpen).toHaveBeenCalledWith(true);
    for (const value of ['flow', 'steps']) {
      expect(
        container.querySelector(`[data-action-id="amendments.process-view.select.${value}"]`)
      ).toBeTruthy();
    }
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.process-replan.open.event-editor"]')!
    );
    expect(initial.openBranchEventEditor).toHaveBeenCalledWith(initial.branches[0]);

    const updateBranchEventDraft = vi.fn();
    const saveBranchEventReplan = vi.fn();
    const closeBranchEventEditor = vi.fn();
    rerender(
      <AmendmentProcessFlowView
        {...initial}
        eventEditorBranch={initial.branches[1]}
        branchEventEditorRows={[
          {
            step: initial.branches[1].step_runs[0],
            selectedEventId: 'event-1',
            eligibleEvents: [],
            editable: true,
            isDecided: false,
            segment: null,
          },
        ]}
        updateBranchEventDraft={updateBranchEventDraft}
        saveBranchEventReplan={saveBranchEventReplan}
        closeBranchEventEditor={closeBranchEventEditor}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.process-replan.clear.event"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.process-replan.cancel.event-editor"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.process-replan.save.events"]')!
    );
    expect(updateBranchEventDraft).toHaveBeenCalledWith(initial.branches[1].step_runs[0].id, null);
    expect(closeBranchEventEditor).toHaveBeenCalledOnce();
    expect(saveBranchEventReplan).toHaveBeenCalledOnce();

    const setSelectorOpen = vi.fn();
    const pendingSelection = {
      pathMode: 'hierarchy',
      startGroupId: 'source-1',
      targetGroupId: 'target-1',
      groupData: { id: 'target-1', name: 'K1', description: '' },
      eventData: null,
      pathWithEvents: [],
    } as never;
    const handleConfirmSelection = vi.fn();
    rerender(
      <AmendmentProcessFlowView
        {...initial}
        eventEditorBranch={null}
        selectorOpen
        setSelectorOpen={setSelectorOpen}
        pendingSelection={pendingSelection}
        handleConfirmSelection={handleConfirmSelection}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.process-selection.cancel.dialog"]')!
    );
    expect(setSelectorOpen).toHaveBeenCalledWith(false);
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.process-selection.confirm.path"]')!
    );
    expect(handleConfirmSelection).toHaveBeenCalledOnce();
  });

  it('renders loading, empty, terminal, historical, decision, task, and event variants', () => {
    const loading = render(
      <AmendmentProcessFlowView
        {...baseProps()}
        amendment={null}
        currentRun={null}
        isLoading
        branches={[]}
        activeBranch={null}
        activeBranchStepRuns={[]}
        pathVisualizationData={[]}
      />
    );
    expect(loading.container).toBeTruthy();
    cleanup();

    const props = baseProps();
    const richSteps = [
      {
        ...step('step-completed', 'branch-rich', 0, 'Completed Group'),
        status: 'completed',
        decision_status: 'approved',
        event_id: 'event-1',
        event: { id: 'event-1', title: 'Event One' },
        starts_at: 100,
        workflow_step: { label: 'Workflow step' },
      },
      {
        ...step('step-active', 'branch-rich', 1, 'Active Group'),
        status: 'active',
        decision_status: 'rejected',
        step_kind: 'support_confirmation',
        event_id: null,
      },
      {
        ...step('step-pending', 'branch-rich', 2, 'Pending Group'),
        status: null,
        decision_status: null,
        target_group: null,
        source_group: { id: 'source', name: 'Source Group' },
        workflow_step: null,
      },
    ];
    const richBranch = {
      ...branch('branch-rich', 'Rich Branch'),
      title: null,
      status: 'completed',
      resolution: 'winner',
      document_id: 'document-1',
      document: { content: 'content' },
      change_requests: [
        { id: 'cr-open', status: 'open', voting_status: 'open' },
        { id: 'cr-closed', status: 'approved', voting_status: 'completed' },
      ],
      tasks: [{ id: 'branch-task', status: 'open' }],
      step_runs: richSteps,
    };
    const alternateBranch = {
      ...branch('branch-loser', 'Loser'),
      status: 'rejected',
      resolution: 'merge_loser',
      document: null,
      document_version: null,
      change_requests: null,
      step_runs: [],
    };
    render(
      <AmendmentProcessFlowView
        {...props}
        amendment={{ ...props.amendment, title: null, group: { name: null } } as never}
        currentRun={
          {
            ...props.currentRun,
            status: 'completed',
            implementation_status: 'implemented',
            selected_source_group: null,
            selected_target_group: null,
            selected_target_workflow: null,
          } as never
        }
        allRuns={[{ id: 'run-1' }, { id: 'run-old' }] as never}
        historicalRuns={
          [
            { id: 'run-approved', status: 'approved', created_at: 2 },
            { id: 'run-rejected', status: 'rejected', created_at: 1 },
          ] as never
        }
        branches={[richBranch, alternateBranch] as never}
        currentRunStepRuns={richSteps as never}
        currentRunDisplayStepRuns={richSteps as never}
        activeBranch={richBranch as never}
        activeBranchStepRuns={richSteps as never}
        derivedActiveStepRun={richSteps[1] as never}
        firstUnresolvedStepId="step-active"
        openTasks={
          [
            {
              id: 'schedule',
              status: 'open',
              task_type: 'schedule_event',
              step_run_id: 'step-active',
            },
            { id: 'evaluation', status: 'scheduled', task_type: 'implementation_evaluation' },
            { id: 'confirmation', status: 'open', task_type: 'support_confirmation' },
          ] as never
        }
        groupDecisions={
          [
            {
              id: 'pending',
              group: { name: 'Pending group' },
              status: 'pending',
              decided_at: null,
            },
            {
              id: 'accepted',
              group: null,
              group_id: 'group-2',
              status: 'accepted',
              decided_at: 100,
            },
            { id: 'rejected', group: { name: null }, status: 'rejected', decided_at: 200 },
          ] as never
        }
        groupTypeById={
          new Map([
            ['step-completed-group', 'source'],
            ['step-active-group', 'target'],
          ])
        }
        pathVisualizationData={[{ groupName: 'A' }, { groupName: 'B' }] as never}
        branchDiffCandidates={
          [
            { id: 'original', label: 'Original', content: 'a' },
            { id: 'branch-rich', label: 'Rich', content: 'b', isWinner: true },
          ] as never
        }
        defaultBranchDiffRightCandidateId="branch-rich"
        canManageProcess
        isSaving
      />
    );
    expect(screen.getAllByText('Completed Group')).toHaveLength(2);
    expect(screen.getByText('Pending group')).toBeTruthy();
    cleanup();

    render(
      <AmendmentProcessFlowView
        {...props}
        eventEditorBranch={richBranch as never}
        branchEventEditorRows={
          [
            {
              step: richSteps[0],
              segment: { eventTitle: null },
              selectedEventId: null,
              eligibleEvents: [{ id: 'event-2', title: 'Eligible Event' }],
              editable: true,
              isDecided: true,
            },
            {
              step: richSteps[1],
              segment: null,
              selectedEventId: 'event-1',
              eligibleEvents: [],
              editable: true,
              isDecided: false,
            },
          ] as never
        }
        isReplanningBranchEvents
      />
    );
    expect(screen.getByTestId('typeahead-search')).toBeTruthy();
  });

  it('renders sparse process records, shared events, raw decisions, and historical details', () => {
    const props = baseProps();
    const sparseStep = {
      ...step('sparse-step', 'sparse', 0, 'No-link group'),
      status: 'pending_event',
      target_group: { id: null, name: 'No-link group' },
      workflow: { name: 'Named step workflow' },
      event: { id: null, title: 'Unlinked step event' },
      starts_at: 0,
    };
    const unknownStep = {
      ...step('unknown-step', 'sparse', 1, 'unused'),
      status: 'in_vote',
      target_group: null,
      workflow_step: null,
      workflow: null,
      step_kind: null,
    };
    const sharedStepA = {
      ...step('shared-a-step', 'shared-a', 0, 'Shared A'),
      event_id: 'shared-event',
    };
    const sharedStepB = {
      ...step('shared-b-step', 'shared-b', 0, 'Shared B'),
      event_id: 'shared-event',
    };
    const sparseBranch = {
      id: 'sparse',
      title: null,
      status: 'supported',
      resolution: null,
      document_id: null,
      document: null,
      document_version: null,
      tasks: null,
      change_requests: [
        { id: 'null-status', voting_status: 'open', status: null },
        { id: 'completed-vote', voting_status: 'completed', status: null },
        { id: 'accepted', voting_status: 'open', status: 'accepted' },
      ],
      step_runs: [sparseStep, unknownStep],
    };
    const noStepsBranch = {
      ...branch('no-steps', 'No Steps'),
      step_runs: null,
      tasks: [{ id: 'closed', status: 'completed' }],
      change_requests: null,
    };
    const sharedA = {
      ...branch('shared-a', 'Shared A'),
      step_runs: [sharedStepA],
      tasks: [{ id: 'scheduled', status: 'scheduled' }],
    };
    const sharedB = { ...branch('shared-b', 'Shared B'), step_runs: [sharedStepB] };

    render(
      <AmendmentProcessFlowView
        {...props}
        currentRun={
          {
            ...props.currentRun,
            status: 'pending_event',
            implementation_status: null,
            active_branch_id: 'sparse',
            selected_target_group: { id: null, name: 'No-link target' },
            selected_target_workflow: null,
          } as never
        }
        branches={[sparseBranch, noStepsBranch, sharedA, sharedB] as never}
        activeBranch={sparseBranch as never}
        activeBranchStepRuns={[sparseStep, unknownStep] as never}
        firstUnresolvedStepId="unknown-step"
        openTasks={[]}
        groupDecisions={
          [
            {
              id: 'linked-raw',
              status: 'raw',
              group: { id: 'group-linked', name: 'Linked decision group' },
              process_run_id: 'run-123456789',
              process_branch_id: 'branch-123456789',
              decided_at: null,
              updated_at: 1,
            },
          ] as never
        }
        historicalRuns={
          [
            {
              id: 'history-rich',
              status: 'supported',
              created_at: 1,
              selected_target_workflow: { name: 'Historic workflow' },
              selected_target_group: { id: 'historic-group', name: 'Historic group' },
              branches: null,
              tasks: [{ status: 'open' }, { status: 'completed' }],
            },
            {
              id: 'history-plain',
              status: null,
              created_at: null,
              selected_target_group: { id: null, name: 'Historic plain group' },
              branches: [],
              tasks: [{ status: 'completed' }],
            },
          ] as never
        }
      />
    );

    expect(screen.getAllByText('No-link group').length).toBeGreaterThan(0);
    expect(screen.getByText('Linked decision group')).toBeTruthy();
    expect(screen.getByText('Historic workflow')).toBeTruthy();
    expect(screen.getAllByText('shared event').length).toBeGreaterThan(0);
  });

  it('renders every event-editor fallback and selector-preview shape', () => {
    const props = baseProps();
    const editorSteps = [
      {
        ...step('editor-current', 'editor', 0, 'Current event group'),
        event_id: 'event-current',
        event: { id: 'event-current', title: 'Current event' },
        target_group: { id: null, name: 'Current event group' },
        workflow_step: { label: null },
      },
      {
        ...step('editor-step-event', 'editor', 1, 'unused'),
        event_id: 'event-other',
        event: { id: 'event-other', title: 'Step event' },
        target_group: null,
        source_group: { name: 'Source event group' },
        workflow_step: null,
      },
      {
        ...step('editor-unknown', 'editor', 2, 'unused'),
        event_id: null,
        event: null,
        target_group: null,
        source_group: null,
        workflow_step: null,
      },
      {
        ...step('editor-workflow', 'editor', 3, 'unused'),
        event_id: null,
        event: null,
        target_group: null,
        source_group: null,
        workflow_step: { label: 'Workflow fallback' },
      },
    ];
    const editorBranch = { ...branch('editor', 'Editor'), step_runs: editorSteps };
    const closeBranchEventEditor = vi.fn();
    render(
      <AmendmentProcessFlowView
        {...props}
        eventEditorBranch={editorBranch as never}
        closeBranchEventEditor={closeBranchEventEditor}
        branchEventEditorRows={
          [
            {
              step: editorSteps[0],
              segment: { requiredAfter: 1, requiredBefore: null },
              selectedEventId: 'event-current',
              eligibleEvents: [],
              editable: false,
              isDecided: true,
            },
            {
              step: editorSteps[1],
              segment: { requiredAfter: null, requiredBefore: 2 },
              selectedEventId: 'different',
              eligibleEvents: [],
              editable: false,
              isDecided: false,
            },
            {
              step: editorSteps[2],
              segment: null,
              selectedEventId: null,
              eligibleEvents: [],
              editable: false,
              isDecided: false,
            },
            {
              step: editorSteps[3],
              segment: { requiredAfter: null, requiredBefore: null },
              selectedEventId: null,
              eligibleEvents: [
                { id: 'untitled', title: null, start_date: null },
                { id: 'titled', title: 'Titled eligible', start_date: 1 },
              ],
              editable: true,
              isDecided: false,
            },
          ] as never
        }
      />
    );
    expect(screen.getByText('Current event')).toBeTruthy();
    expect(screen.getByText('Step event')).toBeTruthy();
    expect(screen.getByText('No event selected')).toBeTruthy();
    const typeaheadProps = (typeaheadMock.mock.calls.at(-1) as any)?.[0];
    typeaheadProps.onChange(null);
    typeaheadProps.onChange({ id: 'titled' });
    expect(props.updateBranchEventDraft).toHaveBeenCalledWith('editor-workflow', null);
    expect(props.updateBranchEventDraft).toHaveBeenCalledWith('editor-workflow', 'titled');

    fireEvent.click(document.querySelector('[data-slot="dialog-close"]')!);
    expect(closeBranchEventEditor).toHaveBeenCalled();
    cleanup();

    const pendingSelection = {
      groupId: 'group-fallback',
      groupData: {
        id: 'group-fallback',
        name: null,
        description: null,
        member_count: null,
        event_count: null,
        amendment_count: null,
      },
      eventId: 'event-fallback',
      eventData: {
        id: 'event-fallback',
        title: null,
        start_date: null,
        location_name: null,
        description: null,
        participant_count: null,
      },
      pathMode: 'workflow',
      pathWithEvents: [
        { group: { name: 'Nested name' } },
        { group: null, groupName: 'Flat name' },
        { group: null, groupName: null, group_id: 'raw-group' },
      ],
    } as never;
    render(
      <AmendmentProcessFlowView
        {...props}
        amendment={{ ...props.amendment, title: null } as never}
        selectorOpen
        pendingSelection={pendingSelection}
      />
    );
    expect(screen.getByTestId('target-group-event-display')).toBeTruthy();
    const overlayProps = (actionOverlayMock.mock.calls.at(-1) as any)?.[0];
    expect(overlayProps.preview.path).toEqual(['Nested name', 'Flat name', 'raw-group']);
    expect(overlayProps.preview.badges[0]).toContain('workflow');
    overlayProps.target.onClick();
    overlayProps.onBack();
    overlayProps.onRetry();
  });

  it('covers dialog callbacks, tutorial outside-interaction guards, and initial preview fallbacks', () => {
    const props = baseProps();
    const inactiveFlow = render(
      <AmendmentProcessFlowView
        {...props}
        branches={[]}
        activeBranch={null}
        activeBranchStepRuns={[]}
      />
    );
    expect(inactiveFlow.queryByTestId('amendment-process-flow-tab')).toBeNull();
    inactiveFlow.unmount();

    const initialSelection = {
      groupId: 'initial-group',
      groupData: {
        id: 'initial-group',
        name: null,
        description: null,
        member_count: null,
        event_count: null,
        amendment_count: null,
      },
      eventId: 'initial-event',
      eventData: {
        id: 'initial-event',
        title: 'Initial event',
        start_date: null,
        location_name: null,
        description: null,
        participant_count: null,
      },
      pathMode: 'hierarchy',
      pathWithEvents: null,
    } as never;

    dialogPropsMock.mockClear();
    scrollableDialogPropsMock.mockClear();
    actionOverlayMock.mockClear();
    const activeSubmission = render(
      <AmendmentProcessFlowView
        {...props}
        amendment={{ ...props.amendment, title: null } as never}
        currentRun={null}
        activeBranch={null}
        activeBranchStepRuns={[]}
        selectorOpen
        pendingSelection={initialSelection}
        processSubmission={{ ...props.processSubmission, isActive: true } as never}
      />
    );
    const activeSelectorDialog = dialogPropsMock.mock.calls
      .map(call => call[0] as any)
      .find(call => Object.prototype.hasOwnProperty.call(call, 'modal'));
    act(() => activeSelectorDialog.onOpenChange(false));
    const activeOverlay = (actionOverlayMock.mock.calls.at(-1) as any)?.[0];
    expect(activeOverlay.preview.title).toBe('features.amendments.process.startDialogTitle');
    expect(activeOverlay.preview.description).toBe('initial-group · Initial event');
    expect(activeOverlay.preview.path).toEqual([]);
    expect(activeOverlay.preview.badges[0]).toContain('hierarchy');
    activeSubmission.unmount();

    dialogPropsMock.mockClear();
    scrollableDialogPropsMock.mockClear();
    const setSelectorOpen = vi.fn();
    const setPendingSelection = vi.fn();
    render(
      <AmendmentProcessFlowView
        {...props}
        currentRun={null}
        activeBranch={null}
        activeBranchStepRuns={[]}
        selectorOpen
        pendingSelection={initialSelection}
        setSelectorOpen={setSelectorOpen}
        setPendingSelection={setPendingSelection}
      />
    );
    const inactiveSelectorDialog = dialogPropsMock.mock.calls
      .map(call => call[0] as any)
      .find(call => Object.prototype.hasOwnProperty.call(call, 'modal'));
    act(() => inactiveSelectorDialog.onOpenChange(true));
    act(() => inactiveSelectorDialog.onOpenChange(false));
    expect(setSelectorOpen).toHaveBeenCalledWith(true);
    expect(setSelectorOpen).toHaveBeenCalledWith(false);
    expect(setPendingSelection).toHaveBeenCalledWith(null);

    const selectorContent = scrollableDialogPropsMock.mock.calls
      .map(call => call[0] as any)
      .find(call => typeof call.onInteractOutside === 'function');
    const plain = document.createElement('div');
    const spotlight = document.createElement('div');
    spotlight.setAttribute('data-testid', 'app-tutorial-spotlight');
    const spotlightChild = document.createElement('span');
    spotlight.appendChild(spotlightChild);
    const preventDefault = vi.fn();
    tutorialState.active = false;
    selectorContent.onInteractOutside({ target: spotlightChild, preventDefault });
    tutorialState.active = true;
    selectorContent.onInteractOutside({ target: {}, preventDefault });
    selectorContent.onInteractOutside({ target: plain, preventDefault });
    selectorContent.onInteractOutside({ target: spotlightChild, preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();

    const eventDialog = dialogPropsMock.mock.calls
      .map(call => call[0] as any)
      .find(call => !Object.prototype.hasOwnProperty.call(call, 'modal'));
    act(() => eventDialog.onOpenChange(true));
  });
});

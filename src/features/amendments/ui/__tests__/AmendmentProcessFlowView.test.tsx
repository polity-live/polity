/* @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AmendmentProcessFlowView,
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
  TabsTrigger: ({ children, value }: { children: ReactNode; value: string }) => (
    <button type="button" role="tab" data-value={value}>
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
  TypeaheadSearch: () => <div data-testid="typeahead-search" />,
}));

vi.mock('@/features/shared/ui/typeahead/toTypeaheadItems', () => ({
  toTypeaheadItems: () => [],
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/groups/logic/groupAmendmentStatus', () => ({
  normalizeGroupAmendmentDisplayStatus: (status?: string | null) => status ?? null,
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
});

/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentProcess: null as any,
  displayTimes: { displayStartTime: 100, displayEndTime: 200 },
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: vi.fn(() => ({ amendmentProcess: mocks.amendmentProcess })),
}));
vi.mock('@/features/agendas/logic/getAgendaDisplayTimes', () => ({
  getAgendaDisplayTimes: vi.fn(() => mocks.displayTimes),
}));
vi.mock('@/features/agendas/logic/getAgendaRuntimeStatus', () => ({
  getAgendaRuntimeStatus: vi.fn(({ status }: { status: string }) => `runtime:${status}`),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, string>) => {
    if (key === 'generated.inline.0109_label_64c65374') return 'label';
    return values ? `${key}:${Object.values(values).join(',')}` : key;
  },
}));

import {
  processAgendaPreviewInternals as helpers,
  useProcessAgendaPreviewDialogController,
} from '../useProcessAgendaPreviewDialogController';

const baseStep = {
  id: 'step',
  step_kind: 'discussion',
  status: 'pending',
  decision_status: 'pending',
  order_index: 1,
  starts_at: 50,
  support_confirmation_id: null,
  event: { id: 'event', title: ' Event ', start_date: 10, end_date: 20 },
  agenda_item: {
    id: 'agenda',
    title: ' Agenda ',
    description: ' Description ',
    type: 'speech',
    status: 'pending',
    forwarding_status: null,
    duration: 45,
    start_time: 30,
    end_time: 40,
    activated_at: 25,
    completed_at: null,
  },
  target_group: { name: 'Target' },
  workflow_step: { label: 'Workflow' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.amendmentProcess = null;
  mocks.displayTimes = { displayStartTime: 100, displayEndTime: 200 };
});

describe('process agenda preview helpers', () => {
  it('classifies terminal states and every supported agenda display type', () => {
    for (const status of ['approved', 'rejected', 'merged', 'withdrawn', 'completed']) {
      expect(helpers.isTerminalStatus(status)).toBe(true);
    }
    expect(helpers.isTerminalStatus(null)).toBe(false);
    expect(helpers.getAgendaDisplayType({ supportConfirmationId: 'support' })).toBe('vote');
    expect(helpers.getAgendaDisplayType({ stepKind: 'merge_vote' })).toBe('vote');
    for (const type of ['election', 'vote', 'speech', 'discussion', 'accreditation']) {
      expect(helpers.getAgendaDisplayType({ agendaItemType: type })).toBe(type);
    }
    for (const type of ['amendment', 'implementation_review', 'support_confirmation']) {
      expect(helpers.getAgendaDisplayType({ agendaItemType: type })).toBe('vote');
    }
    expect(helpers.getAgendaDisplayType({ agendaItemType: 'unknown' })).toBe('discussion');
  });

  it('builds fallback titles, group labels, descriptions, and links', () => {
    expect(
      helpers.buildFallbackAgendaTitle({ support_confirmation_id: 'support' }, 'Amendment')
    ).toContain('supportConfirmationTitle');
    expect(helpers.buildFallbackAgendaTitle({ step_kind: 'merge_vote' }, 'Amendment')).toContain(
      'mergeConfirmationTitle'
    );
    expect(helpers.buildFallbackAgendaTitle({}, 'Amendment')).toContain('amendmentTitle');

    expect(helpers.buildStepTargetGroupName({ ...baseStep }, 'Fallback')).toBe('Target');
    expect(
      helpers.buildStepTargetGroupName(
        { ...baseStep, target_group: { name: '' }, workflow_step: { label: 'Workflow' } },
        'Fallback'
      )
    ).toBe('Workflow');
    expect(helpers.buildStepTargetGroupName({ id: 'minimal', order_index: 0 }, 'Fallback')).toBe(
      'Fallback'
    );
    expect(
      helpers.buildStepTargetGroupName(
        { id: 'empty', order_index: 0, target_group: null, workflow_step: null },
        'Fallback'
      )
    ).toBe('Fallback');

    expect(
      helpers.buildPreviewDescription({
        step: baseStep,
        isPredicted: false,
        state: 'scheduled',
        targetGroupName: 'Target',
      })
    ).toBe('Description');
    expect(
      helpers.buildPreviewDescription({
        step: { ...baseStep, agenda_item: null },
        isPredicted: true,
        state: 'scheduled',
        targetGroupName: 'Target',
      })
    ).toContain('predicted');
    expect(
      helpers.buildPreviewDescription({
        step: { ...baseStep, agenda_item: { description: ' ' } },
        isPredicted: false,
        state: 'scheduled_but_not_confirmed',
        targetGroupName: 'Target',
      })
    ).toContain('pendingVote');
    expect(
      helpers.buildPreviewDescription({
        step: { ...baseStep, agenda_item: {} },
        isPredicted: false,
        state: 'scheduled',
        targetGroupName: 'Target',
      })
    ).toContain('confirmedVote');

    expect(helpers.buildDetailsLink(baseStep, 'amendment')).toBe('/event/event/agenda/agenda');
    expect(helpers.buildDetailsLink({ ...baseStep, agenda_item: null }, 'amendment')).toBe(
      '/event/event/agenda'
    );
    expect(
      helpers.buildDetailsLink({ ...baseStep, event: null, agenda_item: null }, 'amendment')
    ).toBe('/amendment/amendment');
  });

  it('builds scheduled, pending, predicted, and fallback preview items', () => {
    expect(
      helpers.buildPreviewItem({
        step: { ...baseStep, status: 'completed' },
        amendmentId: 'amendment',
        amendmentTitle: 'Title',
        fallbackTargetGroupName: 'Fallback',
      })
    ).toBeNull();
    expect(
      helpers.buildPreviewItem({
        step: { ...baseStep, decision_status: 'approved' },
        amendmentId: 'amendment',
        amendmentTitle: 'Title',
        fallbackTargetGroupName: 'Fallback',
      })
    ).toBeNull();

    const scheduled = helpers.buildPreviewItem({
      step: baseStep,
      amendmentId: 'amendment',
      amendmentTitle: 'Title',
      fallbackTargetGroupName: 'Fallback',
    });
    expect(scheduled).toMatchObject({
      id: 'agenda',
      title: 'Agenda',
      subtitle: 'Event',
      type: 'speech',
      status: 'runtime:pending',
      state: 'scheduled',
      order: 2,
      duration: 45,
      displayStartTime: 100,
      displayEndTime: 200,
    });

    const pending = helpers.buildPreviewItem({
      step: {
        ...baseStep,
        decision_status: 'previous_decision_outstanding',
        agenda_item: {
          ...baseStep.agenda_item,
          id: undefined,
          title: ' ',
          description: null,
          type: 'amendment',
          status: null,
          duration: 0,
          start_time: null,
          end_time: null,
          activated_at: null,
          completed_at: null,
        },
        event: { id: null, title: ' ', start_date: null, end_date: null },
        starts_at: null,
        target_group: { name: null },
        workflow_step: { label: null },
      },
      amendmentId: 'amendment',
      amendmentTitle: 'Title',
      fallbackTargetGroupName: 'Fallback',
    });
    expect(pending).toMatchObject({
      id: 'step',
      type: 'vote',
      status: 'runtime:planned',
      state: 'scheduled_but_not_confirmed',
      duration: 30,
    });

    const forwarded = helpers.buildPreviewItem({
      step: {
        ...baseStep,
        decision_status: null,
        agenda_item: {
          ...baseStep.agenda_item,
          forwarding_status: 'previous_decision_outstanding',
          status: null,
        },
      },
      amendmentId: 'amendment',
      amendmentTitle: 'Title',
      fallbackTargetGroupName: 'Fallback',
    });
    expect(forwarded?.state).toBe('scheduled_but_not_confirmed');

    const predicted = helpers.buildPreviewItem({
      step: {
        id: 'predicted',
        order_index: 0,
        status: null,
        decision_status: null,
        step_kind: null,
        support_confirmation_id: null,
        agenda_item: null,
        event: null,
      },
      amendmentId: 'amendment',
      amendmentTitle: 'Title',
      fallbackTargetGroupName: 'Fallback',
    });
    expect(predicted).toMatchObject({ status: 'runtime:pending', type: 'discussion' });
  });
});

describe('useProcessAgendaPreviewDialogController', () => {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    amendmentId: 'amendment',
    amendmentTitle: ' Prop title ',
    processRunId: null,
    focusStepRunId: null,
  };

  it('returns empty defaults without amendment process data', () => {
    const { result } = renderHook(() => useProcessAgendaPreviewDialogController(props));
    expect(result.current).toMatchObject({
      activeRun: null,
      activeBranch: null,
      resolvedAmendmentTitle: 'Prop title',
      previewItems: [],
      scheduledItems: [],
      scheduledButNotConfirmedItems: [],
    });
  });

  it('selects current and historical runs, branches, focused steps, and title fallbacks', () => {
    const firstStep = { ...baseStep, id: 'first', order_index: 2 };
    const focusedStep = {
      ...baseStep,
      id: 'focused',
      order_index: 1,
      decision_status: 'previous_decision_outstanding',
    };
    const currentRun = {
      id: 'current',
      active_branch_id: 'active-branch',
      selected_target_group: { name: 'Selected' },
      branches: [
        { id: 'fallback-branch', step_runs: [] },
        { id: 'active-branch', step_runs: [firstStep, focusedStep] },
      ],
    };
    const historicalRun = {
      id: 'historical',
      active_branch_id: 'missing',
      selected_target_group: null,
      branches: [{ id: 'historical-branch', step_runs: [firstStep] }],
    };
    mocks.amendmentProcess = {
      title: ' Process title ',
      current_process_run: currentRun,
      process_runs: [historicalRun],
    };

    const current = renderHook(() =>
      useProcessAgendaPreviewDialogController({
        ...props,
        processRunId: 'current',
        focusStepRunId: 'focused',
      })
    );
    expect(current.result.current.activeRun?.id).toBe('current');
    expect(current.result.current.activeBranch?.id).toBe('active-branch');
    expect(current.result.current.resolvedAmendmentTitle).toBe('Process title');
    expect(current.result.current.scheduledButNotConfirmedItems).toHaveLength(1);

    const historical = renderHook(() =>
      useProcessAgendaPreviewDialogController({ ...props, processRunId: 'historical' })
    );
    expect(historical.result.current.activeRun?.id).toBe('historical');
    expect(historical.result.current.activeBranch?.id).toBe('historical-branch');
    expect(historical.result.current.scheduledItems).toHaveLength(1);

    const missingRun = renderHook(() =>
      useProcessAgendaPreviewDialogController({ ...props, processRunId: 'missing' })
    );
    expect(missingRun.result.current.activeRun?.id).toBe('current');

    mocks.amendmentProcess = { title: 'Title', current_process_run: currentRun };
    const missingRunList = renderHook(() =>
      useProcessAgendaPreviewDialogController({ ...props, processRunId: 'missing' })
    );
    expect(missingRunList.result.current.activeRun?.id).toBe('current');
  });

  it('falls back to the first process run and handles missing branches or focused steps', () => {
    const fallbackRun = {
      id: 'fallback',
      active_branch_id: null,
      branches: [{ id: 'branch', step_runs: [baseStep] }],
    };
    mocks.amendmentProcess = {
      title: ' ',
      current_process_run: null,
      process_runs: [fallbackRun],
    };
    const first = renderHook(() =>
      useProcessAgendaPreviewDialogController({
        ...props,
        amendmentTitle: ' ',
        focusStepRunId: 'missing',
      })
    );
    expect(first.result.current.activeRun?.id).toBe('fallback');
    expect(first.result.current.resolvedAmendmentTitle).toBe('Änderungsantrag');
    expect(first.result.current.previewItems).toEqual([]);

    mocks.amendmentProcess = {
      title: null,
      current_process_run: { ...fallbackRun, branches: [] },
      process_runs: [],
    };
    const noBranch = renderHook(() => useProcessAgendaPreviewDialogController(props));
    expect(noBranch.result.current.activeBranch).toBeNull();

    mocks.amendmentProcess = { title: null, current_process_run: null, process_runs: [] };
    const noRun = renderHook(() => useProcessAgendaPreviewDialogController(props));
    expect(noRun.result.current.activeRun).toBeNull();
  });

  it('filters terminal focused steps out of the preview', () => {
    mocks.amendmentProcess = {
      title: 'Title',
      current_process_run: {
        id: 'run',
        active_branch_id: 'branch',
        branches: [{ id: 'branch', step_runs: [{ ...baseStep, status: 'completed' }] }],
      },
      process_runs: [],
    };
    const { result } = renderHook(() => useProcessAgendaPreviewDialogController(props));
    expect(result.current.previewItems).toEqual([]);
  });
});

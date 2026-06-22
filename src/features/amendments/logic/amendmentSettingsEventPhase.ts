import { findLikelyActiveAmendmentStep } from './buildAmendmentPathVisualizationData';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';

interface SettingsProcessStep {
  id?: string;
  event_id?: string | null;
  event?: { id?: string | null; title?: string | null } | null;
  status?: string | null;
  decision_status?: string | null;
  order_index?: number | null;
}

export interface SettingsAmendmentProcess {
  current_process_run?: {
    step_runs?: readonly SettingsProcessStep[] | null;
  } | null;
}

export interface SettingsControllingEvent {
  id: string | null;
  title: string | null;
}

const TERMINAL_STEP_STATUSES = new Set([
  'approved',
  'accepted',
  'supported',
  'merged',
  'completed',
  'rejected',
  'withdrawn',
]);

function hasEvent(step: SettingsProcessStep) {
  return Boolean(step.event_id || step.event?.id);
}

function isTerminalStep(step: SettingsProcessStep) {
  const status = step.decision_status ?? step.status ?? null;
  return Boolean(status && TERMINAL_STEP_STATUSES.has(status));
}

function normalizeEventTitle(title: string | null | undefined) {
  const trimmed = title?.trim();
  return trimmed ? trimmed : null;
}

export function deriveControllingEventForSettings(
  amendmentProcess: SettingsAmendmentProcess | null | undefined,
  editingMode: EditingMode | null | undefined
): SettingsControllingEvent | null {
  const mode = editingMode ?? 'edit';
  if (mode !== 'suggest_event' && mode !== 'event_final_closing_vote') {
    return null;
  }

  const eventSteps = [...(amendmentProcess?.current_process_run?.step_runs ?? [])]
    .filter(hasEvent)
    .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0));

  const selectedStep =
    findLikelyActiveAmendmentStep(eventSteps) ??
    eventSteps.find(step => !isTerminalStep(step)) ??
    eventSteps[0] ??
    null;

  if (!selectedStep) {
    return null;
  }

  return {
    id: selectedStep.event?.id ?? selectedStep.event_id ?? null,
    title: normalizeEventTitle(selectedStep.event?.title),
  };
}

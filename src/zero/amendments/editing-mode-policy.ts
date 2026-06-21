/**
 * Shared amendment editing-mode policy.
 *
 * This module is intentionally React-free so server mutators and UI components
 * can use the same mode order and transition rules.
 */

export type EditingMode =
  | 'edit'
  | 'view'
  | 'suggest_internal'
  | 'suggest_event'
  | 'vote_internal'
  | 'event_final_closing_vote'
  | 'passed'
  | 'rejected';

export type NonTerminalEditingMode = Exclude<EditingMode, 'passed' | 'rejected'>;
export type ManualInternalEditingMode = 'edit' | 'suggest_internal' | 'vote_internal';
export type AutomaticEventEditingMode = 'suggest_event' | 'event_final_closing_vote';

export const AMENDMENT_EDITING_MODE_ORDER = [
  'view',
  'edit',
  'suggest_internal',
  'vote_internal',
  'suggest_event',
  'event_final_closing_vote',
] as const satisfies readonly NonTerminalEditingMode[];

export const MANUAL_INTERNAL_MODES = [
  'edit',
  'suggest_internal',
  'vote_internal',
] as const satisfies readonly ManualInternalEditingMode[];

export const AUTOMATIC_EVENT_MODES = [
  'suggest_event',
  'event_final_closing_vote',
] as const satisfies readonly AutomaticEventEditingMode[];

export const MANUALLY_SELECTABLE_MODES = [
  'view',
  ...MANUAL_INTERNAL_MODES,
] as const satisfies readonly NonTerminalEditingMode[];

export const TERMINAL_EDITING_MODES = [
  'passed',
  'rejected',
] as const satisfies readonly EditingMode[];

const LEGACY_MODE_MAP: Record<string, EditingMode> = {
  collaborative_editing: 'edit',
  internal_suggesting: 'suggest_internal',
  internal_voting: 'vote_internal',
  viewing: 'view',
  event_suggesting: 'suggest_event',
  event_voting: 'event_final_closing_vote',
  vote_event: 'event_final_closing_vote',
  Drafting: 'edit',
  'Under Review': 'suggest_internal',
  Passed: 'passed',
  Rejected: 'rejected',
};

export interface AmendmentEditingModePolicyContext {
  currentMode?: string | null;
  hasProcess?: boolean;
  firstAgendaItemStarted?: boolean;
  eventSuggestionOpen?: boolean;
  eventVotingOpen?: boolean;
  now?: number;
}

export interface AmendmentEditingModePolicy {
  orderedModes: readonly NonTerminalEditingMode[];
  manuallySelectableModes: readonly NonTerminalEditingMode[];
  automaticModes: readonly AutomaticEventEditingMode[];
  allowedModes: readonly NonTerminalEditingMode[];
  disabledModeReasons: Partial<Record<NonTerminalEditingMode, string>>;
  automaticTargetMode: AutomaticEventEditingMode | null;
  canUserChangeMode: boolean;
  internalModesAllowed: boolean;
}

const STARTED_AGENDA_ITEM_STATUSES = new Set([
  'active',
  'in-progress',
  'completed',
  'done',
  'closed',
]);

export interface AmendmentEditingModeAgendaItemState {
  status?: string | null;
  activated_at?: number | null;
  start_time?: number | null;
  completed_at?: number | null;
}

export function isAgendaItemStarted(item: AmendmentEditingModeAgendaItemState | null | undefined) {
  if (!item) return false;
  return (
    Boolean(item.activated_at || item.start_time || item.completed_at) ||
    STARTED_AGENDA_ITEM_STATUSES.has(item.status ?? '')
  );
}

export function normalizeEditingMode(raw: string | null | undefined): EditingMode {
  if (!raw) return 'edit';
  return LEGACY_MODE_MAP[raw] ?? (isEditingMode(raw) ? raw : 'edit');
}

export function isEditingMode(raw: string | null | undefined): raw is EditingMode {
  return (
    raw === 'edit' ||
    raw === 'view' ||
    raw === 'suggest_internal' ||
    raw === 'suggest_event' ||
    raw === 'vote_internal' ||
    raw === 'event_final_closing_vote' ||
    raw === 'passed' ||
    raw === 'rejected'
  );
}

export function isManualInternalMode(
  mode: string | null | undefined
): mode is ManualInternalEditingMode {
  return mode === 'edit' || mode === 'suggest_internal' || mode === 'vote_internal';
}

export function isAutomaticEventMode(
  mode: string | null | undefined
): mode is AutomaticEventEditingMode {
  const normalizedMode = normalizeEditingMode(mode);
  return normalizedMode === 'suggest_event' || normalizedMode === 'event_final_closing_vote';
}

export function isTerminalEditingMode(
  mode: string | null | undefined
): mode is 'passed' | 'rejected' {
  return mode === 'passed' || mode === 'rejected';
}

export function areInternalModesAllowed(context: AmendmentEditingModePolicyContext): boolean {
  if (context.eventSuggestionOpen || context.eventVotingOpen) {
    return false;
  }

  if (!context.hasProcess) {
    return true;
  }

  return !context.firstAgendaItemStarted;
}

export function getAutomaticEditingMode(
  context: AmendmentEditingModePolicyContext
): AutomaticEventEditingMode | null {
  if (context.eventVotingOpen) {
    return 'event_final_closing_vote';
  }

  if (context.eventSuggestionOpen) {
    return 'suggest_event';
  }

  return null;
}

export function canManuallySelectEditingMode(
  targetMode: string | null | undefined,
  context: AmendmentEditingModePolicyContext = {}
): targetMode is NonTerminalEditingMode {
  if (context.eventSuggestionOpen || context.eventVotingOpen) {
    return false;
  }

  const target = normalizeEditingMode(targetMode);
  if (target === 'view') {
    return areInternalModesAllowed(context);
  }

  if (isManualInternalMode(target)) {
    return areInternalModesAllowed(context);
  }

  return false;
}

export function getAmendmentEditingModePolicy(
  context: AmendmentEditingModePolicyContext = {}
): AmendmentEditingModePolicy {
  const internalModesAllowed = areInternalModesAllowed(context);
  const automaticTargetMode = getAutomaticEditingMode(context);
  const allowedModes = AMENDMENT_EDITING_MODE_ORDER.filter(mode => {
    if (automaticTargetMode) return automaticTargetMode === mode;
    if (mode === 'view') return internalModesAllowed;
    if (isManualInternalMode(mode)) return internalModesAllowed;
    return false;
  });
  const disabledModeReasons: Partial<Record<NonTerminalEditingMode, string>> = {};

  for (const mode of AMENDMENT_EDITING_MODE_ORDER) {
    if (allowedModes.includes(mode)) {
      continue;
    }

    disabledModeReasons[mode] = isAutomaticEventMode(mode)
      ? 'event-controlled'
      : 'internal-window-closed';
  }

  return {
    orderedModes: AMENDMENT_EDITING_MODE_ORDER,
    manuallySelectableModes: MANUALLY_SELECTABLE_MODES,
    automaticModes: AUTOMATIC_EVENT_MODES,
    allowedModes,
    disabledModeReasons,
    automaticTargetMode,
    canUserChangeMode: MANUALLY_SELECTABLE_MODES.some(mode =>
      canManuallySelectEditingMode(mode, context)
    ),
    internalModesAllowed,
  };
}

export function getDefaultEditingMode(): EditingMode {
  return 'edit';
}

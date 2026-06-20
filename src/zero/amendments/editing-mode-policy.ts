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
  | 'vote_event'
  | 'passed'
  | 'rejected';

export type NonTerminalEditingMode = Exclude<EditingMode, 'passed' | 'rejected'>;
export type ManualInternalEditingMode = 'edit' | 'suggest_internal' | 'vote_internal';
export type AutomaticEventEditingMode = 'suggest_event' | 'vote_event';

export const AMENDMENT_EDITING_MODE_ORDER = [
  'view',
  'edit',
  'suggest_internal',
  'vote_internal',
  'suggest_event',
  'vote_event',
] as const satisfies readonly NonTerminalEditingMode[];

export const MANUAL_INTERNAL_MODES = [
  'edit',
  'suggest_internal',
  'vote_internal',
] as const satisfies readonly ManualInternalEditingMode[];

export const AUTOMATIC_EVENT_MODES = [
  'suggest_event',
  'vote_event',
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
  event_voting: 'vote_event',
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

export function normalizeEditingMode(raw: string | null | undefined): EditingMode {
  if (!raw) return 'edit';
  if (isEditingMode(raw)) return raw;
  return LEGACY_MODE_MAP[raw] ?? 'edit';
}

export function isEditingMode(raw: string | null | undefined): raw is EditingMode {
  return (
    raw === 'edit' ||
    raw === 'view' ||
    raw === 'suggest_internal' ||
    raw === 'suggest_event' ||
    raw === 'vote_internal' ||
    raw === 'vote_event' ||
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
  return mode === 'suggest_event' || mode === 'vote_event';
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
    return 'vote_event';
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

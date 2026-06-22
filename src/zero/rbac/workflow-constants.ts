import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  AUTOMATIC_EVENT_MODES,
  EDITING_MODE_TRANSITIONS as POLICY_EDITING_MODE_TRANSITIONS,
  MANUALLY_SELECTABLE_MODES,
  TERMINAL_EDITING_MODES,
  canTransitionTo as canPolicyTransitionTo,
  getDefaultEditingMode as getPolicyDefaultEditingMode,
  isEventPhase as isPolicyEventPhase,
  isSelectableByCollaborator as isPolicySelectableByCollaborator,
  isSuggestingMode as isPolicySuggestingMode,
  isTerminalEditingMode,
  isVotingMode as isPolicyVotingMode,
  normalizeEditingMode as normalizePolicyEditingMode,
  type EditingMode,
} from '../amendments/editing-mode-policy';
export {
  AMENDMENT_EDITING_MODE_ORDER,
  AUTOMATIC_EVENT_MODES,
  EDITING_MODE_TRANSITIONS,
  MANUAL_INTERNAL_MODES,
  MANUALLY_SELECTABLE_MODES,
} from '../amendments/editing-mode-policy';
/**
 * Amendment Editing Mode Constants
 *
 * Defines editing modes, transitions, and validation rules.
 * Unified type replaces the old WorkflowStatus and EditorMode.
 */

/**
 * Editing mode for amendments — single source of truth for both
 * the amendment lifecycle and the editor behaviour.
 */
export type { EditingMode } from '../amendments/editing-mode-policy';

/** @deprecated Use EditingMode instead */
export type WorkflowStatus = EditingMode;

/**
 * Voting session types
 */
export type VotingSessionType = 'internal' | 'event';

/**
 * Voting session statuses
 */
export type VotingSessionStatus = 'pending' | 'active' | 'completed';

/**
 * Change request sources
 */
export type ChangeRequestSource = 'collaborator' | 'event_participant';

/** @deprecated Use EDITING_MODE_TRANSITIONS instead */
export const WORKFLOW_TRANSITIONS = POLICY_EDITING_MODE_TRANSITIONS;

/**
 * Non-terminal editing modes available for manual selection
 */
export const SELECTABLE_MODES: EditingMode[] = [...MANUALLY_SELECTABLE_MODES];

/** @deprecated Use SELECTABLE_MODES instead */
export const COLLABORATOR_SELECTABLE_STATUSES = SELECTABLE_MODES;

/**
 * Event-phase editing modes
 */
export const EVENT_MODES: EditingMode[] = [...AUTOMATIC_EVENT_MODES];

/** @deprecated Use EVENT_MODES instead */
export const EVENT_CONTROLLED_STATUSES = EVENT_MODES;

/**
 * Terminal modes (cannot transition from these)
 */
export const TERMINAL_MODES: EditingMode[] = [...TERMINAL_EDITING_MODES];

/** @deprecated Use TERMINAL_MODES instead */
export const TERMINAL_STATUSES = TERMINAL_MODES;

/**
 * Editing mode display metadata
 */
export const EDITING_MODE_METADATA: Record<
  EditingMode,
  {
    label: string;
    description: string;
    color: string;
    icon: string;
  }
> = {
  edit: {
    label: translateText('generated.inline.0740_bearbeiten_104f3bfd'),
    description: translateText(
      'generated.inline.0741_alle_collaborators_k_nnen_direkt_bearbeiten_84c06ce2'
    ),
    color: 'bg-blue-500',
    icon: 'Edit',
  },
  view: {
    label: translateText('generated.inline.0742_ansicht_5c388792'),
    description: translateText('generated.inline.0743_nur_lesen_modus_054b6937'),
    color: 'bg-gray-500',
    icon: 'Eye',
  },
  suggest_internal: {
    label: translateText('generated.inline.0744_vorschl_ge_intern_cb3e8f05'),
    description: translateText(
      'generated.inline.0745_collaborators_k_nnen_vorschl_ge_einreichen_7f0ea119'
    ),
    color: 'bg-purple-500',
    icon: 'MessageSquare',
  },
  suggest_event: {
    label: translateText('generated.inline.0746_event_vorschl_ge_687919fd'),
    description: translateText(
      'generated.inline.0747_event_teilnehmer_k_nnen_vorschl_ge_einreichen_b811936d'
    ),
    color: 'bg-teal-500',
    icon: 'Calendar',
  },
  vote_internal: {
    label: translateText('generated.inline.0748_interne_abstimmung_a0face84'),
    description: translateText(
      'generated.inline.0749_abstimmung_unter_collaborators_zeitbasiert_41f561b1'
    ),
    color: 'bg-orange-500',
    icon: 'Vote',
  },
  event_final_closing_vote: {
    label: translateText('generated.inline.0750_event_abstimmung_96225579'),
    description: translateText(
      'generated.inline.0751_event_stimmt_sequentiell_ber_nderungen_ab_d1aa6df6'
    ),
    color: 'bg-red-500',
    icon: 'Gavel',
  },
  passed: {
    label: translateText('generated.inline.0752_angenommen_187cf380'),
    description: translateText('generated.inline.0753_amendment_wurde_angenommen_ee1c7af2'),
    color: 'bg-[var(--badge-success-fg)]',
    icon: 'CheckCircle',
  },
  rejected: {
    label: translateText('generated.inline.0754_abgelehnt_110d6fe7'),
    description: translateText('generated.inline.0755_amendment_wurde_abgelehnt_6d6cc595'),
    color: 'bg-[var(--badge-danger-fg)]',
    icon: 'XCircle',
  },
};

/** @deprecated Use EDITING_MODE_METADATA instead */
export const WORKFLOW_STATUS_METADATA = EDITING_MODE_METADATA;

/**
 * Normalize a raw value to a canonical EditingMode.
 * Unknown or missing values fall back to the default edit mode.
 */
export function normalizeEditingMode(raw: string | null | undefined): EditingMode {
  return normalizePolicyEditingMode(raw);
}

/**
 * Validate if an editing mode transition is allowed
 */
export const canTransitionTo = canPolicyTransitionTo;

/**
 * Check if a mode is in an event phase
 */
export const isEventPhase = isPolicyEventPhase;

/**
 * Check if a mode is terminal
 */
export function isTerminalStatus(mode: EditingMode): boolean {
  return isTerminalEditingMode(mode);
}

/**
 * Check if a mode is a voting mode
 */
export const isVotingMode = isPolicyVotingMode;

/**
 * Check if a mode is a suggesting mode
 */
export const isSuggestingMode = isPolicySuggestingMode;

/**
 * Check if a user can manually select a mode
 */
export const isSelectableByCollaborator = isPolicySelectableByCollaborator;

/**
 * Get the default editing mode for a new amendment
 */
export function getDefaultEditingMode(): EditingMode {
  return getPolicyDefaultEditingMode();
}

/** @deprecated Use getDefaultEditingMode instead */
export function getDefaultWorkflowStatus(): EditingMode {
  return getDefaultEditingMode();
}

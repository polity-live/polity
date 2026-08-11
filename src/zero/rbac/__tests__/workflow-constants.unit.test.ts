import { describe, expect, it } from 'vitest';

import {
  COLLABORATOR_SELECTABLE_STATUSES,
  EDITING_MODE_METADATA,
  EVENT_CONTROLLED_STATUSES,
  EVENT_MODES,
  SELECTABLE_MODES,
  TERMINAL_MODES,
  TERMINAL_STATUSES,
  WORKFLOW_STATUS_METADATA,
  WORKFLOW_TRANSITIONS,
  canTransitionTo,
  getDefaultEditingMode,
  getDefaultWorkflowStatus,
  isEventPhase,
  isSelectableByCollaborator,
  isSuggestingMode,
  isTerminalStatus,
  isVotingMode,
  normalizeEditingMode,
} from '../workflow-constants';

describe('RBAC workflow compatibility contracts', () => {
  it('normalizes invalid and missing modes through the canonical policy', () => {
    expect(normalizeEditingMode(null)).toBe('edit');
    expect(normalizeEditingMode(undefined)).toBe('edit');
    expect(normalizeEditingMode('voting')).toBe('edit');
    expect(normalizeEditingMode('suggest_event')).toBe('suggest_event');
    expect(normalizeEditingMode('unknown-mode')).toBe('edit');
  });

  it('delegates transition and mode predicates to one canonical policy', () => {
    expect(canTransitionTo('edit', 'suggest_internal')).toBe(true);
    expect(canTransitionTo('passed', 'edit')).toBe(false);
    expect(isEventPhase('suggest_event')).toBe(true);
    expect(isEventPhase('edit')).toBe(false);
    expect(isTerminalStatus('passed')).toBe(true);
    expect(isTerminalStatus('edit')).toBe(false);
    expect(isVotingMode('vote_internal')).toBe(true);
    expect(isVotingMode('edit')).toBe(false);
    expect(isSuggestingMode('suggest_internal')).toBe(true);
    expect(isSuggestingMode('view')).toBe(false);
    expect(isSelectableByCollaborator('edit')).toBe(true);
    expect(isSelectableByCollaborator('suggest_event')).toBe(false);
  });

  it('keeps deprecated aliases identical to their canonical exports', () => {
    expect(COLLABORATOR_SELECTABLE_STATUSES).toBe(SELECTABLE_MODES);
    expect(EVENT_CONTROLLED_STATUSES).toBe(EVENT_MODES);
    expect(TERMINAL_STATUSES).toBe(TERMINAL_MODES);
    expect(WORKFLOW_STATUS_METADATA).toBe(EDITING_MODE_METADATA);
    expect(WORKFLOW_TRANSITIONS.edit).toContain('suggest_internal');
  });

  it('provides complete metadata and stable default aliases', () => {
    expect(Object.keys(EDITING_MODE_METADATA).sort()).toEqual(
      [
        'edit',
        'event_final_closing_vote',
        'passed',
        'rejected',
        'suggest_event',
        'suggest_internal',
        'view',
        'vote_internal',
      ].sort()
    );
    for (const metadata of Object.values(EDITING_MODE_METADATA)) {
      expect(metadata.label).not.toBe('');
      expect(metadata.description).not.toBe('');
      expect(metadata.color).not.toBe('');
      expect(metadata.icon).not.toBe('');
    }
    expect(getDefaultEditingMode()).toBe('edit');
    expect(getDefaultWorkflowStatus()).toBe(getDefaultEditingMode());
  });
});

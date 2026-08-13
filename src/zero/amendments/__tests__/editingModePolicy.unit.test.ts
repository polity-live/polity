import { describe, expect, it } from 'vitest';

import {
  AMENDMENT_EDITING_MODE_ORDER,
  EDITING_MODE_TRANSITIONS,
  MANUALLY_SELECTABLE_MODES,
  areInternalModesAllowed,
  canTransitionTo,
  canManuallySelectEditingMode,
  getAutomaticEditingMode,
  getAmendmentEditingModePolicy,
  getDefaultEditingMode,
  isAgendaItemStarted,
  isAutomaticEventMode,
  isEditingMode,
  isEventPhase,
  isManualInternalMode,
  isSelectableByCollaborator,
  isSuggestingMode,
  isTerminalEditingMode,
  isVotingMode,
  normalizeEditingMode,
} from '../editing-mode-policy';
import { updateAmendmentProcessBranchSchema } from '../schema';

describe('amendment editing mode policy', () => {
  it('uses the canonical display order', () => {
    expect(AMENDMENT_EDITING_MODE_ORDER).toEqual([
      'view',
      'edit',
      'suggest_internal',
      'vote_internal',
      'suggest_event',
      'event_final_closing_vote',
    ]);
  });

  it('limits manual selection to view and internal modes', () => {
    expect(MANUALLY_SELECTABLE_MODES).toEqual([
      'view',
      'edit',
      'suggest_internal',
      'vote_internal',
    ]);
  });

  it('allows internal modes while no process exists', () => {
    const policy = getAmendmentEditingModePolicy({ hasProcess: false, now: 1_000 });

    expect(policy.internalModesAllowed).toBe(true);
    expect(policy.allowedModes).toEqual(['view', 'edit', 'suggest_internal', 'vote_internal']);
    expect(canManuallySelectEditingMode('vote_internal', { hasProcess: false })).toBe(true);
  });

  it('allows internal modes while the first process agenda item has not started', () => {
    const context = {
      hasProcess: true,
      firstAgendaItemStarted: false,
    };

    expect(canManuallySelectEditingMode('edit', context)).toBe(true);
    expect(canManuallySelectEditingMode('suggest_internal', context)).toBe(true);
    expect(canManuallySelectEditingMode('vote_internal', context)).toBe(true);
  });

  it('blocks manual modes after the first process agenda item started', () => {
    const context = {
      hasProcess: true,
      firstAgendaItemStarted: true,
    };

    expect(canManuallySelectEditingMode('view', context)).toBe(false);
    expect(canManuallySelectEditingMode('edit', context)).toBe(false);
    expect(canManuallySelectEditingMode('suggest_internal', context)).toBe(false);
    expect(canManuallySelectEditingMode('vote_internal', context)).toBe(false);
  });

  it('keeps event modes automatic only', () => {
    const policy = getAmendmentEditingModePolicy({
      hasProcess: true,
      eventSuggestionOpen: true,
      now: 20_000,
    });

    expect(policy.automaticTargetMode).toBe('suggest_event');
    expect(policy.allowedModes).toEqual(['suggest_event']);
    expect(canManuallySelectEditingMode('view', { eventSuggestionOpen: true })).toBe(false);
    expect(canManuallySelectEditingMode('suggest_event', { hasProcess: false })).toBe(false);
    expect(canManuallySelectEditingMode('event_final_closing_vote', { hasProcess: false })).toBe(
      false
    );
  });

  it('prefers event voting over event suggestions once voting is open', () => {
    const policy = getAmendmentEditingModePolicy({
      eventSuggestionOpen: true,
      eventVotingOpen: true,
    });

    expect(policy.automaticTargetMode).toBe('event_final_closing_vote');
    expect(policy.allowedModes).toEqual(['event_final_closing_vote']);
  });

  it('keeps canonical values and falls back for unknown values', () => {
    expect(normalizeEditingMode('vote_internal')).toBe('vote_internal');
    expect(normalizeEditingMode('passed')).toBe('passed');
    expect(normalizeEditingMode('collaborative_editing')).toBe('edit');
    expect(normalizeEditingMode('Passed')).toBe('edit');
  });

  it('rejects legacy editing modes at the mutator schema boundary', () => {
    expect(
      updateAmendmentProcessBranchSchema.safeParse({
        id: 'branch-1',
        editing_mode: 'internal_voting',
      }).success
    ).toBe(false);
  });

  it('detects started agenda items from server-relevant status and timestamps', () => {
    expect(isAgendaItemStarted(null)).toBe(false);
    expect(isAgendaItemStarted({ status: null })).toBe(false);
    expect(isAgendaItemStarted({ status: 'planned' })).toBe(false);
    expect(isAgendaItemStarted({ status: 'active' })).toBe(true);
    expect(isAgendaItemStarted({ activated_at: 10 })).toBe(true);
    expect(isAgendaItemStarted({ start_time: 20 })).toBe(true);
    expect(isAgendaItemStarted({ completed_at: 30 })).toBe(true);
  });

  it('exhaustively classifies canonical, automatic, terminal, and selectable modes', () => {
    const allModes = [
      'edit',
      'view',
      'suggest_internal',
      'suggest_event',
      'vote_internal',
      'event_final_closing_vote',
      'passed',
      'rejected',
    ] as const;
    expect(allModes.map(isEditingMode)).toEqual(allModes.map(() => true));
    expect(isEditingMode(undefined)).toBe(false);
    expect(isEditingMode('legacy')).toBe(false);
    expect(normalizeEditingMode(null)).toBe('edit');

    expect(allModes.filter(isManualInternalMode)).toEqual([
      'edit',
      'suggest_internal',
      'vote_internal',
    ]);
    expect(isManualInternalMode(null)).toBe(false);
    expect(allModes.filter(isAutomaticEventMode)).toEqual([
      'suggest_event',
      'event_final_closing_vote',
    ]);
    expect(isAutomaticEventMode('legacy')).toBe(false);
    expect(allModes.filter(isTerminalEditingMode)).toEqual(['passed', 'rejected']);
    expect(allModes.filter(isVotingMode)).toEqual(['vote_internal', 'event_final_closing_vote']);
    expect(allModes.filter(isSuggestingMode)).toEqual(['suggest_internal', 'suggest_event']);
    expect(allModes.filter(isSelectableByCollaborator)).toEqual([
      'edit',
      'view',
      'suggest_internal',
      'vote_internal',
    ]);
    expect(allModes.filter(isEventPhase)).toEqual([
      'suggest_event',
      'event_final_closing_vote',
      'passed',
      'rejected',
    ]);
    expect(getDefaultEditingMode()).toBe('edit');
  });

  it('covers every transition and automatic-policy boundary', () => {
    for (const [current, allowed] of Object.entries(EDITING_MODE_TRANSITIONS)) {
      for (const target of [
        'edit',
        'view',
        'suggest_internal',
        'suggest_event',
        'vote_internal',
        'event_final_closing_vote',
        'passed',
        'rejected',
      ] as const) {
        expect(canTransitionTo(current as never, target)).toBe(allowed.includes(target as never));
      }
    }

    expect(areInternalModesAllowed({ eventVotingOpen: true })).toBe(false);
    expect(areInternalModesAllowed({ hasProcess: true, firstAgendaItemStarted: true })).toBe(false);
    expect(getAutomaticEditingMode({})).toBeNull();
    expect(getAutomaticEditingMode({ eventSuggestionOpen: true })).toBe('suggest_event');
    expect(getAutomaticEditingMode({ eventVotingOpen: true })).toBe('event_final_closing_vote');
    expect(canManuallySelectEditingMode(undefined)).toBe(true);
    expect(canManuallySelectEditingMode('legacy')).toBe(true);

    const closed = getAmendmentEditingModePolicy({
      hasProcess: true,
      firstAgendaItemStarted: true,
    });
    expect(closed.allowedModes).toEqual([]);
    expect(closed.canUserChangeMode).toBe(false);
    expect(closed.disabledModeReasons).toEqual({
      view: 'internal-window-closed',
      edit: 'internal-window-closed',
      suggest_internal: 'internal-window-closed',
      vote_internal: 'internal-window-closed',
      suggest_event: 'event-controlled',
      event_final_closing_vote: 'event-controlled',
    });
  });
});

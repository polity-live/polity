import { describe, expect, it } from 'vitest';

import {
  AMENDMENT_EDITING_MODE_ORDER,
  MANUALLY_SELECTABLE_MODES,
  canManuallySelectEditingMode,
  getAmendmentEditingModePolicy,
  normalizeEditingMode,
} from '../editing-mode-policy';

describe('amendment editing mode policy', () => {
  it('uses the canonical display order', () => {
    expect(AMENDMENT_EDITING_MODE_ORDER).toEqual([
      'view',
      'edit',
      'suggest_internal',
      'vote_internal',
      'suggest_event',
      'vote_event',
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
    expect(canManuallySelectEditingMode('vote_event', { hasProcess: false })).toBe(false);
  });

  it('prefers event voting over event suggestions once voting is open', () => {
    const policy = getAmendmentEditingModePolicy({
      eventSuggestionOpen: true,
      eventVotingOpen: true,
    });

    expect(policy.automaticTargetMode).toBe('vote_event');
    expect(policy.allowedModes).toEqual(['vote_event']);
  });

  it('normalizes legacy database values', () => {
    expect(normalizeEditingMode('collaborative_editing')).toBe('edit');
    expect(normalizeEditingMode('event_voting')).toBe('vote_event');
    expect(normalizeEditingMode('Passed')).toBe('passed');
  });
});

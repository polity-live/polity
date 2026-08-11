import { describe, expect, it } from 'vitest';

import {
  activateCreateSubmitProgressStep,
  applyCreateSubmitProgressUpdate,
  completeCreateSubmitProgressSteps,
  failActiveCreateSubmitProgressStep,
  getDefaultCreateSubmitProgressSteps,
  normalizeCreateSubmitProgressSteps,
} from '../createSubmitProgress';

describe('create submit progress', () => {
  it('creates civic default steps for an entity', () => {
    expect(getDefaultCreateSubmitProgressSteps('amendment')).toEqual([
      { key: 'create', label: 'Creating amendment', status: 'pending' },
      { key: 'sync', label: 'Syncing content', status: 'pending' },
      { key: 'ready', label: 'Preparing destination', status: 'pending' },
    ]);
    expect(getDefaultCreateSubmitProgressSteps('image')).toHaveLength(3);
  });

  it('normalizes absent and custom step status values', () => {
    expect(normalizeCreateSubmitProgressSteps('event')).toHaveLength(3);
    expect(
      normalizeCreateSubmitProgressSteps('event', [
        { key: 'custom', label: 'Custom', status: undefined },
        { key: 'done', label: 'Done', status: 'complete' },
      ])
    ).toEqual([
      { key: 'custom', label: 'Custom', status: 'pending' },
      { key: 'done', label: 'Done', status: 'complete' },
    ]);
  });

  it('moves active steps forward without losing labels', () => {
    const initial = getDefaultCreateSubmitProgressSteps('group');
    const creating = activateCreateSubmitProgressStep(initial, 'create');
    const syncing = activateCreateSubmitProgressStep(creating, 'sync');

    expect(syncing.map(step => step.status)).toEqual(['complete', 'active', 'pending']);
  });

  it('applies labels and completion updates', () => {
    const initial = activateCreateSubmitProgressStep(
      getDefaultCreateSubmitProgressSteps('blog'),
      'sync'
    );
    const updated = applyCreateSubmitProgressUpdate(initial, {
      key: 'sync',
      label: 'Synchronisiert Testdaten',
      status: 'complete',
    });

    expect(updated[1]).toMatchObject({
      label: 'Synchronisiert Testdaten',
      status: 'complete',
    });
    expect(
      completeCreateSubmitProgressSteps(updated).every(step => step.status === 'complete')
    ).toBe(true);

    const unchanged = applyCreateSubmitProgressUpdate(updated, {
      key: 'sync',
      progress: 0,
    });
    expect(unchanged[1]).toMatchObject({
      label: 'Synchronisiert Testdaten',
      status: 'complete',
      progress: 0,
    });
    expect(applyCreateSubmitProgressUpdate(updated, { key: 'missing' })).toEqual(updated);
  });

  it('marks the active step as failed', () => {
    const steps = activateCreateSubmitProgressStep(
      getDefaultCreateSubmitProgressSteps('event'),
      'sync'
    );

    expect(failActiveCreateSubmitProgressStep(steps).map(step => step.status)).toEqual([
      'pending',
      'error',
      'pending',
    ]);
  });

  it('fails the first step when none is active and preserves later inactive steps', () => {
    expect(
      failActiveCreateSubmitProgressStep([
        { key: 'first', label: 'First', status: 'pending' },
        { key: 'second', label: 'Second', status: 'pending' },
      ]).map(step => step.status)
    ).toEqual(['error', 'pending']);
    expect(activateCreateSubmitProgressStep([], 'missing')).toEqual([]);
  });
});

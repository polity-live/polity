import { describe, expect, it } from 'vitest';

import {
  activateCreateSubmitProgressStep,
  applyCreateSubmitProgressUpdate,
  completeCreateSubmitProgressSteps,
  failActiveCreateSubmitProgressStep,
  getDefaultCreateSubmitProgressSteps,
} from '../createSubmitProgress';

describe('create submit progress', () => {
  it('creates civic default steps for an entity', () => {
    expect(getDefaultCreateSubmitProgressSteps('amendment')).toEqual([
      { key: 'create', label: 'Erstellt Antrag', status: 'pending' },
      { key: 'sync', label: 'Synchronisiert Inhalte', status: 'pending' },
      { key: 'ready', label: 'Bereitet Zielseite vor', status: 'pending' },
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
});

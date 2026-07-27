import { beforeEach, describe, expect, it } from 'vitest';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  buildCreateEventSearchFromProcessTask,
  getProcessTaskSchedulingWindow,
  getSchedulingWindowDisplayLabel,
  getSchedulingWindowValidationMessage,
  isEventWithinSchedulingWindow,
} from '../processTaskEventScheduling';

describe('processTaskEventScheduling', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'de' });
  });

  it('builds a readable scheduling window label', () => {
    expect(
      getSchedulingWindowDisplayLabel({
        minStartDate: '2026-06-10',
        minStartTime: '09:00',
        maxStartDate: '2026-06-12',
        maxStartTime: '18:00',
      })
    ).toBe('Erlaubter Zeitraum für diesen Auftrag: 2026-06-10 09:00 bis 2026-06-12 18:00.');
  });

  it('returns the concrete window label as validation feedback when the event is outside the allowed range', () => {
    expect(
      getSchedulingWindowValidationMessage({
        startDate: '2026-06-09',
        startTime: '12:00',
        minStartDate: '2026-06-10',
        minStartTime: '09:00',
        maxStartDate: '2026-06-12',
        maxStartTime: '18:00',
      })
    ).toBe('Erlaubter Zeitraum für diesen Auftrag: 2026-06-10 09:00 bis 2026-06-12 18:00.');

    expect(
      getSchedulingWindowValidationMessage({
        startDate: '2026-06-13',
        startTime: '12:00',
        minStartDate: '2026-06-10',
        minStartTime: '09:00',
        maxStartDate: '2026-06-12',
        maxStartTime: '18:00',
      })
    ).toBe('Erlaubter Zeitraum für diesen Auftrag: 2026-06-10 09:00 bis 2026-06-12 18:00.');
  });

  it('derives the event scheduling window and create-event search defaults from a process task', () => {
    const task = {
      id: 'task-1',
      process_run_id: 'run-1',
      step_run_id: 'step-1',
      due_at: null,
      metadata: {
        amendmentId: 'amendment-1',
        requiredAfter: new Date(2026, 5, 10, 9, 0, 0, 0).getTime(),
        requiredBefore: new Date(2026, 5, 12, 18, 0, 0, 0).getTime(),
      },
    };

    expect(getProcessTaskSchedulingWindow(task)).toEqual({
      minStartAt: new Date(2026, 5, 10, 9, 0, 0, 0).getTime(),
      maxStartAt: new Date(2026, 5, 12, 18, 0, 0, 0).getTime(),
    });

    expect(
      buildCreateEventSearchFromProcessTask({
        task,
        groupId: 'group-1',
        returnTo: '/group/group-1?tab=assignments',
      })
    ).toEqual({
      groupId: 'group-1',
      processTaskId: 'task-1',
      processRunId: 'run-1',
      stepRunId: 'step-1',
      amendmentId: 'amendment-1',
      minStartDate: '2026-06-10',
      minStartTime: '09:00',
      maxStartDate: '2026-06-12',
      maxStartTime: '18:00',
      returnTo: '/group/group-1?tab=assignments',
    });
  });

  it('checks event start dates against the computed scheduling window', () => {
    const minStartAt = new Date(2026, 5, 10, 9, 0, 0, 0).getTime();
    const maxStartAt = new Date(2026, 5, 12, 18, 0, 0, 0).getTime();

    expect(
      isEventWithinSchedulingWindow(
        { start_date: new Date(2026, 5, 11, 12, 0, 0, 0).getTime() },
        { minStartAt, maxStartAt }
      )
    ).toBe(true);
    expect(
      isEventWithinSchedulingWindow(
        { start_date: new Date(2026, 5, 9, 12, 0, 0, 0).getTime() },
        { minStartAt, maxStartAt }
      )
    ).toBe(false);
  });

  it('renders the scheduling window in English', () => {
    useLanguageStore.setState({ language: 'en' });

    expect(
      getSchedulingWindowDisplayLabel({
        minStartDate: '2026-06-10',
        minStartTime: '09:00',
        maxStartDate: '2026-06-12',
        maxStartTime: '18:00',
      })
    ).toBe('Allowed time for this task: 2026-06-10 09:00 to 2026-06-12 18:00.');
  });
});

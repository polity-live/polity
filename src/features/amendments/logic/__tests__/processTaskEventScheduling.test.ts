import { describe, expect, it } from 'vitest';
import {
  buildCreateEventSearchFromProcessTask,
  getSchedulingWindowValidationMessage,
  isEventWithinSchedulingWindow,
  parseProcessTaskScheduleMetadata,
} from '@/features/amendments/logic/processTaskEventScheduling';

describe('processTaskEventScheduling', () => {
  it('builds task-aware event create search params without empty window values', () => {
    const search = buildCreateEventSearchFromProcessTask({
      task: {
        id: 'task-1',
        process_run_id: 'run-1',
        step_run_id: 'step-1',
        due_at: null,
        metadata: {
          amendmentId: 'amendment-1',
          requiredAfter: new Date('2026-06-10T18:30:00').getTime(),
          requiredBefore: new Date('2026-06-12T20:00:00').getTime(),
        },
      },
      groupId: 'group-1',
      returnTo: '/group/group-1?tab=assignments',
    });

    expect(search).toMatchObject({
      groupId: 'group-1',
      processTaskId: 'task-1',
      processRunId: 'run-1',
      stepRunId: 'step-1',
      amendmentId: 'amendment-1',
      minStartDate: '2026-06-10',
      minStartTime: '18:30',
      maxStartDate: '2026-06-12',
      maxStartTime: '20:00',
      returnTo: '/group/group-1?tab=assignments',
    });
  });

  it('parses structured metadata and validates event start windows', () => {
    const metadata = parseProcessTaskScheduleMetadata({
      requiredAfter: new Date('2026-06-10T18:30:00').getTime(),
      requiredBefore: new Date('2026-06-12T20:00:00').getTime(),
      sourceGroupId: 'source-1',
      targetGroupId: 'target-1',
      pathMode: 'workflow',
    });

    expect(metadata).toMatchObject({
      sourceGroupId: 'source-1',
      targetGroupId: 'target-1',
      pathMode: 'workflow',
    });

    expect(
      getSchedulingWindowValidationMessage({
        startDate: '2026-06-10',
        startTime: '17:00',
        minStartDate: '2026-06-10',
        minStartTime: '18:30',
      })
    ).toContain('nach dem vorherigen Prozessschritt');

    expect(
      isEventWithinSchedulingWindow(
        { start_date: new Date('2026-06-11T19:00:00').getTime() },
        {
          minStartAt: new Date('2026-06-10T18:30:00').getTime(),
          maxStartAt: new Date('2026-06-12T20:00:00').getTime(),
        }
      )
    ).toBe(true);
  });
});

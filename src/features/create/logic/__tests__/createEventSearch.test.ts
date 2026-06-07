import { describe, expect, it } from 'vitest';
import { createEventSearchSchema } from '@/features/create/logic/createEventSearch';

describe('createEventSearch', () => {
  it('accepts process-task prefills and scheduling bounds', () => {
    const parsed = createEventSearchSchema.parse({
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

    expect(parsed).toMatchObject({
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
});

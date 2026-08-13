import { describe, expect, it } from 'vitest';
import {
  createEventSearchSchema,
  getCreateEventSearchDefaults,
  toCreateEventSearch,
} from '@/features/create/logic/createEventSearch';

describe('createEventSearch', () => {
  it('formats local date-time ranges for search parameters', () => {
    expect(
      toCreateEventSearch({
        start: new Date(2026, 0, 2, 3, 4),
        end: new Date(2026, 10, 12, 13, 14),
      })
    ).toEqual({
      startDate: '2026-01-02',
      startTime: '03:04',
      endDate: '2026-11-12',
      endTime: '13:14',
    });
  });

  it('preserves valid defaults and clears invalid or absent values', () => {
    expect(
      getCreateEventSearchDefaults({
        eventType: 'meeting',
        startDate: '2026-01-02',
        startTime: '03:04',
        endDate: '2026-01-03',
        endTime: '05:06',
      })
    ).toEqual({
      eventType: 'meeting',
      startDate: '2026-01-02',
      startTime: '03:04',
      endDate: '2026-01-03',
      endTime: '05:06',
    });
    expect(
      getCreateEventSearchDefaults({ startDate: 'invalid', startTime: 'invalid' } as never)
    ).toEqual({
      eventType: 'open',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
    });
  });

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

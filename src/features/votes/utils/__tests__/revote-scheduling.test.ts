import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeRoleScheduledRevoteDate,
  getRoleRevoteStatus,
  scheduleRoleRevote,
} from '../revote-scheduling';

describe('role revote scheduling', () => {
  const start = new Date('2024-02-01T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes yearly and four-yearly recurrence from dates and timestamps', () => {
    expect(
      computeRoleScheduledRevoteDate({ termStartDate: start, recurrencePattern: 'yearly' })
    ).toBe(new Date('2025-02-01T00:00:00.000Z').getTime());
    expect(
      computeRoleScheduledRevoteDate({
        termStartDate: start.getTime(),
        recurrencePattern: 'yearly',
        recurrenceInterval: 2,
      })
    ).toBe(new Date('2026-02-01T00:00:00.000Z').getTime());
    expect(
      computeRoleScheduledRevoteDate({
        termStartDate: start.getTime(),
        recurrencePattern: 'four-yearly',
        recurrenceInterval: 2,
      })
    ).toBe(new Date('2032-02-01T00:00:00.000Z').getTime());
  });

  it('rejects absent starts and unsupported patterns while clamping intervals', () => {
    expect(computeRoleScheduledRevoteDate({ termStartDate: null })).toBeNull();
    expect(computeRoleScheduledRevoteDate({ termStartDate: 0 })).toBeNull();
    expect(
      computeRoleScheduledRevoteDate({
        termStartDate: start,
        recurrencePattern: 'monthly',
        recurrenceInterval: 0,
      })
    ).toBeNull();
    expect(
      computeRoleScheduledRevoteDate({
        termStartDate: start,
        recurrencePattern: 'yearly',
        recurrenceInterval: -4,
      })
    ).toBe(new Date('2025-02-01T00:00:00.000Z').getTime());
  });

  it('reports stored revote dates as overdue or upcoming', () => {
    const overdue = getRoleRevoteStatus({ scheduled_revote_date: Date.now() - 1 }, Date.now());
    const upcoming = getRoleRevoteStatus({ scheduled_revote_date: Date.now() + 1 }, Date.now());
    expect(overdue).toMatchObject({ isOverdue: true, dueDate: Date.now() - 1 });
    expect(upcoming).toMatchObject({ isOverdue: false, dueDate: Date.now() + 1 });
    expect(overdue.label).toBeTruthy();
    expect(upcoming.label).toBeTruthy();
  });

  it('reports open, invalid recurring, overdue recurring, and upcoming recurring terms', () => {
    expect(getRoleRevoteStatus({ is_recurring: false })).toMatchObject({
      dueDate: null,
      isOverdue: false,
    });
    expect(
      getRoleRevoteStatus({ is_recurring: true, recurrence_pattern: 'monthly' })
    ).toMatchObject({ dueDate: null, isOverdue: false });

    const overdue = getRoleRevoteStatus({
      is_recurring: true,
      term_start_date: start.getTime(),
      recurrence_pattern: 'yearly',
      recurrence_interval: 1,
    });
    const upcoming = getRoleRevoteStatus(
      {
        is_recurring: true,
        term_start_date: start.getTime(),
        recurrence_pattern: 'four-yearly',
        recurrence_interval: 1,
      },
      Date.now()
    );
    expect(overdue.isOverdue).toBe(true);
    expect(upcoming.isOverdue).toBe(false);
  });

  it.each([
    ['yearly', new Date('2025-02-01T00:00:00.000Z').getTime()],
    ['biannual', new Date('2026-02-01T00:00:00.000Z').getTime()],
    ['monthly', null],
    ['quarterly', null],
  ] as const)('schedules %s role terms', async (termDuration, expected) => {
    await expect(
      scheduleRoleRevote({
        roleId: 'role',
        groupId: 'group',
        termDuration,
        termStartDate: start,
        userId: 'user',
      })
    ).resolves.toBe(expected);
  });
});

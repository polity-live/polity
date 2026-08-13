import { describe, expect, it, vi } from 'vitest';
import { toLocalDeadlineTimestamp } from '@/features/shared/logic/localDateTime';
import {
  formatTodoDate,
  formatTodoDateTime,
  formatTodoTime,
  isOverdue,
  resolveTodoDeadlineTimestamp,
  todoDeadlineToFormValues,
} from '../todoFormatters';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: { count?: number }) => {
    const labels: Record<string, string> = {
      'features.todos.dueDate.today': 'Today',
      'features.todos.dueDate.tomorrow': 'Tomorrow',
      'features.todos.dueDate.yesterday': 'Yesterday',
    };
    return labels[key] ?? `${key}:${values?.count ?? ''}`;
  },
}));

describe('todo deadline formatting', () => {
  it('shows an end-of-day deadline as today without a synthetic time', () => {
    const dueAt = toLocalDeadlineTimestamp('2026-07-19');
    const reference = new Date(2026, 6, 19, 9, 0).getTime();

    expect(formatTodoDate(dueAt ?? 0, reference)).toBe('Today');
    expect(isOverdue(dueAt ?? undefined, 'pending', reference)).toBe(false);
    expect(todoDeadlineToFormValues(dueAt)).toEqual({
      dueDate: '2026-07-19',
      dueTime: '',
    });
  });

  it('shows an explicit time and becomes overdue only after that instant', () => {
    const dueAt = toLocalDeadlineTimestamp('2026-07-19', '14:30');
    const before = new Date(2026, 6, 19, 14, 0).getTime();
    const after = new Date(2026, 6, 19, 15, 0).getTime();
    const expectedTime = new Date(dueAt ?? 0).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    expect(formatTodoDate(dueAt ?? 0, before)).toBe(`Today, ${expectedTime}`);
    expect(isOverdue(dueAt ?? undefined, 'pending', before)).toBe(false);
    expect(isOverdue(dueAt ?? undefined, 'pending', after)).toBe(true);
    expect(todoDeadlineToFormValues(dueAt)).toEqual({
      dueDate: '2026-07-19',
      dueTime: '14:30',
    });
  });

  it('uses calendar days instead of truncated 24-hour differences', () => {
    const dueAt = new Date(2026, 6, 18, 23, 30).getTime();
    const reference = new Date(2026, 6, 19, 0, 15).getTime();

    expect(formatTodoDate(dueAt, reference)).toContain('Yesterday');
  });

  it('accepts ISO timestamps as well as numeric database timestamps', () => {
    const dueAt = new Date(2026, 6, 19, 14, 30);
    const reference = new Date(2026, 6, 19, 9, 0).getTime();

    expect(formatTodoDate(dueAt.toISOString(), reference)).toContain('Today');
    expect(isOverdue(dueAt.toISOString(), 'pending', reference)).toBe(false);
    expect(formatTodoDate(String(dueAt.getTime()), reference)).toContain('Today');
    expect(formatTodoDateTime(dueAt.getTime())).toBe(dueAt.toLocaleString());
  });

  it('formats tomorrow, nearby future and past dates, and distant dates', () => {
    const reference = new Date(2026, 6, 19, 9, 0).getTime();
    expect(formatTodoDate(new Date(2026, 6, 20, 23, 59, 59, 999).getTime(), reference)).toBe(
      'Tomorrow'
    );
    expect(formatTodoDate(new Date(2026, 6, 22, 23, 59, 59, 999).getTime(), reference)).toContain(
      'features.todos.dueDate.inDays:3'
    );
    expect(formatTodoDate(new Date(2026, 6, 16, 23, 59, 59, 999).getTime(), reference)).toContain(
      'features.todos.dueDate.daysAgo:3'
    );
    expect(formatTodoDate(new Date(2026, 7, 19, 23, 59, 59, 999).getTime(), reference)).toContain(
      '2026'
    );
  });

  it('returns no time for end-of-day and formats explicit times', () => {
    expect(formatTodoTime(new Date(2026, 6, 19, 23, 59, 59, 999))).toBeNull();
    expect(formatTodoTime(new Date(2026, 6, 19, 12, 30))).toBe(
      new Date(2026, 6, 19, 12, 30).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  });

  it('never marks completed todos overdue', () => {
    expect(isOverdue(undefined, 'pending', Date.now())).toBe(false);
    expect(isOverdue(1, 'completed', Date.now())).toBe(false);
  });

  it('preserves the exact stored instant when edit fields are unchanged', () => {
    const original = new Date(2026, 6, 19, 17, 59, 59, 999).getTime();
    const form = todoDeadlineToFormValues(original);

    expect(resolveTodoDeadlineTimestamp(original, form.dueDate, form.dueTime)).toBe(original);
  });

  it('rebuilds changed and cleared form deadlines', () => {
    const original = new Date(2026, 6, 19, 17, 0).getTime();
    expect(resolveTodoDeadlineTimestamp(original, '2026-07-20', '18:00')).toBe(
      toLocalDeadlineTimestamp('2026-07-20', '18:00')
    );
    expect(resolveTodoDeadlineTimestamp(original, '', '')).toBeNull();
    expect(resolveTodoDeadlineTimestamp(null, '', '')).toBeNull();
  });
});

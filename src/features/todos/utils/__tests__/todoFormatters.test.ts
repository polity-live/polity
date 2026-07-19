import { describe, expect, it, vi } from 'vitest';
import { toLocalDeadlineTimestamp } from '@/features/shared/logic/localDateTime';
import {
  formatTodoDate,
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
  });

  it('never marks completed todos overdue', () => {
    expect(isOverdue(1, 'completed', Date.now())).toBe(false);
  });

  it('preserves the exact stored instant when edit fields are unchanged', () => {
    const original = new Date(2026, 6, 19, 17, 59, 59, 999).getTime();
    const form = todoDeadlineToFormValues(original);

    expect(resolveTodoDeadlineTimestamp(original, form.dueDate, form.dueTime)).toBe(original);
  });
});

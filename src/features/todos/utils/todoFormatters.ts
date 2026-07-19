import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { differenceInCalendarDays } from 'date-fns';
import {
  formatLocalDateInput,
  formatOptionalLocalTimeInput,
  isLocalEndOfDay,
  toLocalDeadlineTimestamp,
} from '@/features/shared/logic/localDateTime';

function parseTodoDate(value: Date | number | string): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);

  const trimmedValue = value.trim();
  return /^\d+$/.test(trimmedValue) ? new Date(Number(trimmedValue)) : new Date(trimmedValue);
}

export function formatTodoTime(value: Date | number | string): string | null {
  const date = parseTodoDate(value);
  if (isLocalEndOfDay(date)) return null;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function withOptionalTime(label: string, date: Date): string {
  const time = formatTodoTime(date);
  return time ? `${label}, ${time}` : label;
}

export function formatTodoDate(timestamp: number | string, referenceTime = Date.now()): string {
  const date = parseTodoDate(timestamp);
  const diffDays = differenceInCalendarDays(date, new Date(referenceTime));

  if (diffDays === 0) return withOptionalTime(translateText('features.todos.dueDate.today'), date);
  if (diffDays === 1)
    return withOptionalTime(translateText('features.todos.dueDate.tomorrow'), date);
  if (diffDays === -1)
    return withOptionalTime(translateText('features.todos.dueDate.yesterday'), date);
  if (diffDays > 0 && diffDays <= 7) {
    return withOptionalTime(
      translateText('features.todos.dueDate.inDays', { count: diffDays }),
      date
    );
  }
  if (diffDays < 0 && diffDays >= -7) {
    return withOptionalTime(
      translateText('features.todos.dueDate.daysAgo', { count: Math.abs(diffDays) }),
      date
    );
  }

  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return withOptionalTime(dateLabel, date);
}

export function formatTodoDateTime(timestamp: number | string): string {
  const date = parseTodoDate(timestamp);
  return date.toLocaleString();
}

export function isOverdue(
  dueDate: number | string | undefined,
  status: string,
  referenceTime = Date.now()
): boolean {
  if (!dueDate) return false;
  if (status === 'completed') return false;

  const dueDateMs = parseTodoDate(dueDate).getTime();
  return dueDateMs < referenceTime;
}

export function todoDeadlineToFormValues(value?: number | string | Date | null): {
  dueDate: string;
  dueTime: string;
} {
  return {
    dueDate: formatLocalDateInput(value),
    dueTime: formatOptionalLocalTimeInput(value),
  };
}

export function resolveTodoDeadlineTimestamp(
  originalTimestamp: number | null | undefined,
  dueDate: string,
  dueTime: string
): number | null {
  const originalForm = todoDeadlineToFormValues(originalTimestamp);
  if (dueDate === originalForm.dueDate && dueTime === originalForm.dueTime) {
    return originalTimestamp ?? null;
  }
  return toLocalDeadlineTimestamp(dueDate, dueTime);
}

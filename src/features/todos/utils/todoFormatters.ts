import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function formatTodoDate(timestamp: number | string): string {
  const date = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp));
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return translateText('features.todos.dueDate.today');
  if (diffDays === 1) return translateText('features.todos.dueDate.tomorrow');
  if (diffDays === -1) return translateText('features.todos.dueDate.yesterday');
  if (diffDays > 0 && diffDays <= 7) {
    return translateText('features.todos.dueDate.inDays', { count: diffDays });
  }
  if (diffDays < 0 && diffDays >= -7) {
    return translateText('features.todos.dueDate.daysAgo', { count: Math.abs(diffDays) });
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTodoDateTime(timestamp: number | string): string {
  const date = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp));
  return date.toLocaleString();
}

export function isOverdue(dueDate: number | string | undefined, status: string): boolean {
  if (!dueDate) return false;
  if (status === 'completed') return false;

  const dueDateMs = typeof dueDate === 'number' ? dueDate : new Date(dueDate).getTime();
  return dueDateMs < Date.now();
}

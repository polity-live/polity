import type { TodoWithRelationsRow } from '@/zero/todos/queries';

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoTab = 'all' | TodoStatus | 'archived';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TodoFormData {
  title: string;
  description: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string;
  dueTime: string;
}

export type Todo = TodoWithRelationsRow;

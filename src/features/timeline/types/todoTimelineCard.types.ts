import type { TodoStatus } from '@/features/todos/types/todo.types';

export interface TodoTimelineCardTodo {
  id: string;
  title: string;
  description?: string;
  isCompleted?: boolean;
  dueDate?: string | number | Date;
  progress?: number;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  assigneeCount?: number;
  groupName?: string;
  groupId?: string;
  status?: TodoStatus;
  visibility?: 'public' | 'authenticated' | 'private';
  creatorId?: string;
  creatorName?: string;
  archived?: boolean;
}

export interface TodoTimelineUrgency {
  color: string;
  bgColor: string;
  label: string;
}

export interface TodoTimelineCardLabels {
  contentType: string;
  completed: string;
  markComplete: string;
  progress: string;
  assigned: string;
  assignedToMe: string;
  assignToMe: string;
  archived: string;
}

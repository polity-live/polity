import { table, string, number, json } from '@rocicorp/zero';
import type { MutableJSONValue } from '../shared/helpers';

export interface TodoActivityChange {
  field: string;
  from: unknown;
  to: unknown;
}

export const todo = table('todo')
  .columns({
    id: string(),
    title: string().optional(),
    description: string().optional(),
    status: string().optional(),
    priority: string().optional(),
    due_date: number().optional(),
    completed_at: number().optional(),
    archived_at: number().optional(),
    tags: json<string[]>().optional(),
    visibility: string(),
    creator_id: string(),
    group_id: string().optional(),
    event_id: string().optional(),
    amendment_id: string().optional(),
    tutorial_run_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const todoAssignment = table('todo_assignment')
  .columns({
    id: string(),
    todo_id: string(),
    user_id: string(),
    role: string().optional(),
    assigned_at: number(),
  })
  .primaryKey('id');

export const todoActivity = table('todo_activity')
  .columns({
    id: string(),
    todo_id: string(),
    actor_id: string().optional(),
    subject_user_id: string().optional(),
    action: string(),
    severity: string(),
    changes: json<MutableJSONValue>(),
    created_at: number(),
  })
  .primaryKey('id');

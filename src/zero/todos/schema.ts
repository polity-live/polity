import { z } from 'zod';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { timestampSchema, nullableTimestampSchema, jsonStringArraySchema } from '../shared/helpers';
import { createTimelineEventSchema } from '../common/schema';

// ============================================
// Todo
// ============================================
const baseTodoSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  status: z.string().nullable(),
  priority: z.string().nullable(),
  due_date: nullableTimestampSchema,
  completed_at: nullableTimestampSchema,
  tags: jsonStringArraySchema.nullable(),
  visibility: z.string(),
  creator_id: z.string(),
  group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  amendment_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectTodoSchema = baseTodoSchema;
export const createTodoSchema = baseTodoSchema
  .omit({ id: true, created_at: true, updated_at: true, creator_id: true })
  .extend({ id: z.string() });
export const updateTodoSchema = baseTodoSchema
  .pick({
    title: true,
    description: true,
    status: true,
    priority: true,
    due_date: true,
    tags: true,
    visibility: true,
    completed_at: true,
  })
  .partial()
  .extend({ id: z.string() });
export const deleteTodoSchema = z.object({ id: z.string() });
export const toggleCompleteTodoSchema = z.object({ id: z.string() });

// ============================================
// Todo Assignment
// ============================================
const baseTodoAssignmentSchema = z.object({
  id: z.string(),
  todo_id: z.string(),
  user_id: z.string(),
  role: z.string().nullable(),
  assigned_at: z.number(),
});

export const selectTodoAssignmentSchema = baseTodoAssignmentSchema;
export const createTodoAssignmentSchema = baseTodoAssignmentSchema
  .omit({ id: true, assigned_at: true })
  .extend({ id: z.string() });
export const deleteTodoAssignmentSchema = z.object({ id: z.string() });

export const createTodoFullSchema = z.object({
  todo: createTodoSchema,
  assignment: createTodoAssignmentSchema.nullable().optional(),
  timeline_event: createTimelineEventSchema.nullable().optional(),
});

// ============================================
// Inferred Types
// ============================================
export type Todo = z.infer<typeof selectTodoSchema>;
export type TodoUpdateInput = Omit<z.input<typeof updateTodoSchema>, 'tags'> & {
  tags?: string[] | null;
};
export type TodoAssignment = z.infer<typeof selectTodoAssignmentSchema>;
export type TodoFullCreateInput = z.infer<typeof createTodoFullSchema>;
export const createTodoFullMutatorSchema = createTodoFullSchema as StandardSchemaV1<
  TodoFullCreateInput,
  TodoFullCreateInput
>;

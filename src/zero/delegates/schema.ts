import { z } from 'zod';
import { timestampSchema } from '../shared/helpers';

// ============================================
// Event Delegate Schemas
// ============================================

const eventDelegateBaseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  user_id: z.string(),
  group_id: z.string().nullable(),
  status: z.string().nullable(),
  seat_count: z.number(),
  created_at: timestampSchema,
});

export const eventDelegateSelectSchema = eventDelegateBaseSchema;

// ============================================
// Group Delegate Allocation Schemas
// ============================================

const groupDelegateAllocationBaseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  group_id: z.string().nullable(),
  allocated_seats: z.number(),
  created_at: timestampSchema,
});

export const groupDelegateAllocationSelectSchema = groupDelegateAllocationBaseSchema;

// ============================================
// Delegate Election Assignment Schemas
// ============================================

const delegateElectionAssignmentBaseSchema = z.object({
  id: z.string(),
  target_event_id: z.string(),
  source_group_id: z.string(),
  allocation_id: z.string().nullable(),
  required_seats: z.number(),
  confirmed_seats: z.number(),
  linked_event_id: z.string().nullable(),
  status: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const delegateElectionAssignmentSelectSchema = delegateElectionAssignmentBaseSchema;

// ============================================
// Inferred Types
// ============================================

export type EventDelegate = z.infer<typeof eventDelegateSelectSchema>;
export type GroupDelegateAllocation = z.infer<typeof groupDelegateAllocationSelectSchema>;
export type DelegateElectionAssignment = z.infer<typeof delegateElectionAssignmentSelectSchema>;

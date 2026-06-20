import { z } from 'zod';
import { jsonSchema, timestampSchema, nullableTimestampSchema } from '../shared/helpers';

// ============================================
// Change Request Schemas
// ============================================

const baseChangeRequestSchema = z.object({
  id: z.string(),
  amendment_id: z.string(),
  user_id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  status: z.string().nullable(),
  reason: z.string().nullable(),
  source_type: z.string().nullable(),
  source_id: z.string().nullable(),
  source_title: z.string().nullable(),
  change_type: z.string().nullable().optional(),
  original_text: z.string().nullable().optional(),
  new_text: z.string().nullable().optional(),
  original_properties: jsonSchema.nullable().optional(),
  new_properties: jsonSchema.nullable().optional(),
  changed_character_count: z.number(),
  votes_for: z.number(),
  votes_against: z.number(),
  votes_abstain: z.number(),
  voting_status: z.string(),
  voting_deadline: nullableTimestampSchema,
  voting_majority_type: z.string().nullable(),
  quorum_required: z.number().nullable(),
  created_in_mode: z.string().nullable().optional(),
  resolved_in_mode: z.string().nullable().optional(),
  resolution_method: z.string().nullable().optional(),
  visibility_scope: z.string().nullable().optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectChangeRequestSchema = baseChangeRequestSchema;

export const createChangeRequestSchema = baseChangeRequestSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    user_id: true,
    votes_for: true,
    votes_against: true,
    votes_abstain: true,
    changed_character_count: true,
  })
  .extend({ id: z.string(), changed_character_count: z.number().optional() });

export const updateChangeRequestSchema = baseChangeRequestSchema
  .pick({
    title: true,
    description: true,
    status: true,
    reason: true,
    change_type: true,
    original_text: true,
    new_text: true,
    original_properties: true,
    new_properties: true,
    voting_status: true,
    votes_for: true,
    votes_against: true,
    votes_abstain: true,
    changed_character_count: true,
  })
  .partial()
  .extend({ id: z.string() });

export const finalizeInternalChangeRequestVoteSchema = z.object({
  change_request_id: z.string(),
});

export const finalizeExpiredInternalChangeRequestVotesSchema = z.object({
  amendment_id: z.string(),
});

export const repairInternalChangeRequestResolutionSchema = z.object({
  amendment_id: z.string(),
});

// ============================================
// Inferred Types
// ============================================

export type ChangeRequest = z.infer<typeof selectChangeRequestSchema>;

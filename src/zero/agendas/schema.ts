import { z } from 'zod';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { timestampSchema, nullableTimestampSchema } from '../shared/helpers';
import { createElectionSchema } from '../elections/schema';
import { roleCreateSchema } from '../groups/schema';
import { createVoteChoiceSchema, createVoteSchema } from '../votes/schema';

// ============================================
// Agenda Item
// ============================================
const baseAgendaItemSchema = z.object({
  id: z.string(),
  event_id: z.string().nullable(),
  amendment_id: z.string().nullable(),
  creator_id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  type: z.string().nullable(),
  status: z.string().nullable(),
  forwarding_status: z.string().nullable(),
  order_index: z.number().nullable(),
  duration: z.number().nullable(),
  scheduled_time: z.string().nullable(),
  start_time: nullableTimestampSchema,
  end_time: nullableTimestampSchema,
  activated_at: nullableTimestampSchema,
  completed_at: nullableTimestampSchema,
  majority_type: z.string().nullable(),
  time_limit: z.number().nullable(),
  voting_phase: z.enum(['internal', 'indicative', 'final', 'closed']).nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAgendaItemSchema = baseAgendaItemSchema;
export const createAgendaItemSchema = baseAgendaItemSchema
  .omit({ id: true, created_at: true, updated_at: true, creator_id: true })
  .extend({ id: z.string() });
export const createAgendaItemFullSchema = z.object({
  roles: z.array(roleCreateSchema).optional(),
  agenda_items: z.array(createAgendaItemSchema).min(1),
  elections: z.array(createElectionSchema).optional(),
  votes: z
    .array(
      z.object({
        vote: createVoteSchema,
        choices: z.array(createVoteChoiceSchema).optional(),
      })
    )
    .optional(),
});
export const updateAgendaItemSchema = baseAgendaItemSchema
  .pick({
    title: true,
    description: true,
    type: true,
    status: true,
    forwarding_status: true,
    order_index: true,
    duration: true,
    scheduled_time: true,
    activated_at: true,
    completed_at: true,
    start_time: true,
    end_time: true,
    event_id: true,
    amendment_id: true,
    majority_type: true,
    time_limit: true,
    voting_phase: true,
  })
  .partial()
  .extend({ id: z.string() });
export const deleteAgendaItemSchema = z.object({ id: z.string() });
export const reorderAgendaItemsSchema = z.object({
  items: z.array(z.object({ id: z.string(), order_index: z.number() })),
});

// ============================================
// Speaker List
// ============================================
const baseSpeakerListSchema = z.object({
  id: z.string(),
  agenda_item_id: z.string(),
  user_id: z.string(),
  title: z.string().nullable(),
  order_index: z.number().nullable(),
  time: z.number().nullable(),
  completed: z.boolean(),
  start_time: nullableTimestampSchema,
  end_time: nullableTimestampSchema,
  created_at: timestampSchema,
});

export const selectSpeakerListSchema = baseSpeakerListSchema;
export const createSpeakerListSchema = baseSpeakerListSchema
  .omit({ id: true, created_at: true })
  .extend({ id: z.string() });
export const deleteSpeakerListSchema = z.object({ id: z.string() });

// ============================================
// Agenda Item Change Request (junction)
// ============================================
const baseAgendaItemChangeRequestSchema = z.object({
  id: z.string(),
  agenda_item_id: z.string(),
  change_request_id: z.string().nullable(),
  vote_id: z.string().nullable(),
  order_index: z.number(),
  step_kind: z.enum(['change_request', 'closing', 'merge_variant']),
  process_branch_id: z.string().nullable(),
  is_closing_vote: z.boolean(),
  status: z.string(),
  blocked_reason: z.string().nullable(),
  result_status: z.string().nullable(),
  obsolete_reason: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAgendaItemChangeRequestSchema = baseAgendaItemChangeRequestSchema;
export const createAgendaItemChangeRequestSchema = baseAgendaItemChangeRequestSchema
  .omit({
    created_at: true,
    updated_at: true,
    step_kind: true,
    process_branch_id: true,
    blocked_reason: true,
    result_status: true,
    obsolete_reason: true,
  })
  .extend({
    step_kind: z
      .enum(['change_request', 'closing', 'merge_variant'])
      .optional()
      .transform(value => value ?? 'change_request'),
    process_branch_id: z
      .string()
      .nullable()
      .optional()
      .transform(value => value ?? null),
    blocked_reason: z
      .string()
      .nullable()
      .optional()
      .transform(value => value ?? null),
    result_status: z
      .string()
      .nullable()
      .optional()
      .transform(value => value ?? null),
    obsolete_reason: z
      .string()
      .nullable()
      .optional()
      .transform(value => value ?? null),
  });
export const updateAgendaItemChangeRequestSchema = baseAgendaItemChangeRequestSchema
  .pick({
    vote_id: true,
    order_index: true,
    step_kind: true,
    process_branch_id: true,
    status: true,
    blocked_reason: true,
    result_status: true,
    obsolete_reason: true,
  })
  .partial()
  .extend({ id: z.string() });
export const deleteAgendaItemChangeRequestSchema = z.object({ id: z.string() });
export const reorderAgendaItemChangeRequestsSchema = z.object({
  items: z.array(z.object({ id: z.string(), order_index: z.number() })),
});

// Server-only: initialize all CR votes + final vote for an agenda item
export const initializeChangeRequestVotingSchema = z.object({
  amendment_id: z.string(),
  agenda_item_id: z.string(),
  voting_context: z.enum(['event', 'internal']).optional(),
  group_id: z.string().optional(),
  start_final_vote_if_no_change_requests: z.boolean().optional(),
});

// Server-only: materialize event-suggestion CR vote cards as confirmed CRs arrive
export const ensureEventSuggestionChangeRequestVotesSchema = z.object({
  amendment_id: z.string(),
  agenda_item_id: z.string(),
  process_branch_id: z.string().nullable().optional(),
});

// Server-only: process the result of a CR vote (accept/reject suggestion + save version)
export const processCRVoteResultSchema = z.object({
  agenda_item_change_request_id: z.string(),
  vote_result: z.enum(['passed', 'rejected', 'tie']),
});

// ============================================
// Inferred Types
// ============================================
export type AgendaItem = z.infer<typeof selectAgendaItemSchema>;
export type AgendaItemFullCreateInput = z.infer<typeof createAgendaItemFullSchema>;
export const createAgendaItemFullMutatorSchema = createAgendaItemFullSchema as StandardSchemaV1<
  AgendaItemFullCreateInput,
  AgendaItemFullCreateInput
>;
export type SpeakerList = z.infer<typeof selectSpeakerListSchema>;
export type AgendaItemChangeRequest = z.infer<typeof selectAgendaItemChangeRequestSchema>;

import { z } from 'zod';
import {
  timestampSchema,
  nullableTimestampSchema,
  jsonNumberArraySchema,
  jsonSchema,
  jsonStringStringRecordSchema,
} from '../shared/helpers';

const nullableEventScheduleTimestampSchema = z.number().nullable();
const attendanceModeSchema = z.enum(['online', 'hybrid', 'offline']);
const changeRequestVoteOrderSchema = z.enum([
  'text_position',
  'changed_character_count',
  'cr_number',
]);

// ── event ─────────────────────────────────────────────────────────────
const eventBaseSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: jsonSchema.nullable(),
  status: z.string().nullable(),
  event_type: z.string().nullable(),
  attendance_mode: attendanceModeSchema.nullable(),
  location_type: z.string().nullable(),
  location_name: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  post_code: z.string().nullable(),
  city: z.string().nullable(),
  street: z.string().nullable(),
  house_number: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  location_url: z.string().nullable(),
  location_coordinates: z.string().nullable(),
  visibility: z.string(),
  start_date: nullableEventScheduleTimestampSchema,
  end_date: nullableEventScheduleTimestampSchema,
  timezone: z.string().nullable(),
  default_final_vote_duration_seconds: z.number().nullable(),
  change_request_vote_order: changeRequestVoteOrderSchema,
  gender_quota_enabled: z.boolean(),
  capacity: z.number().nullable(),
  participant_count: z.number(),
  subscriber_count: z.number(),
  election_count: z.number(),
  amendment_count: z.number(),
  open_change_request_count: z.number(),
  agenda_management: z.string().nullable(),
  meeting_type: z.string().nullable(),
  is_bookable: z.boolean(),
  max_bookings: z.number().nullable(),
  is_recurring: z.boolean(),
  recurrence_pattern: z.string().nullable(),
  recurrence_rule: z.string().nullable(),
  recurrence_interval: z.number().nullable(),
  recurrence_days: jsonNumberArraySchema.nullable(),
  recurrence_end_date: nullableEventScheduleTimestampSchema,
  original_event_id: z.string().nullable(),
  cancel_reason: z.string().nullable(),
  cancelled_at: nullableTimestampSchema,
  cancelled_by_id: z.string().nullable(),
  x: z.string().nullable(),
  youtube: z.string().nullable(),
  linkedin: z.string().nullable(),
  website: z.string().nullable(),
  stream_url: z.string().nullable(),
  image_url: z.string().nullable(),
  has_delegates: z.boolean(),
  delegate_count: z.number(),
  delegate_distribution_method: z.string().nullable(),
  delegate_distribution_status: z.string().nullable(),
  delegate_seat_allocation_type: z.string().nullable(),
  total_delegate_seats: z.number().nullable(),
  delegate_quorum_percentage: z.number().nullable(),
  delegate_vote_weight_type: z.string().nullable(),
  delegate_vote_threshold_percentage: z.number().nullable(),
  delegate_accepted_states: jsonStringStringRecordSchema.nullable(),
  delegate_finalized_at: nullableTimestampSchema,
  delegate_approval_type: z.string().nullable(),
  delegate_check_mode: z.string().nullable(),
  main_group_delegate_allocation_mode: z.string().nullable(),
  delegate_election_mode: z.string().nullable(),
  current_agenda_item_id: z.string().nullable(),
  amendment_deadline: nullableEventScheduleTimestampSchema,
  registration_deadline: nullableEventScheduleTimestampSchema,
  candidacy_deadline: nullableEventScheduleTimestampSchema,
  delegates_nomination_deadline: nullableEventScheduleTimestampSchema,
  group_id: z.string().nullable(),
  creator_id: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const eventSelectSchema = eventBaseSchema;
export const eventCreateSchema = eventBaseSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    participant_count: true,
    subscriber_count: true,
    election_count: true,
    amendment_count: true,
    open_change_request_count: true,
    delegate_count: true,
    cancelled_at: true,
    cancelled_by_id: true,
    cancel_reason: true,
  })
  .partial()
  .extend({
    id: z.string(),
    title: z.string(),
    group_id: z.string().nullable(),
    invited_user_ids: z.array(z.string()).optional(),
    debug_correlation_id: z.string().optional(),
  });
export const eventUpdateSchema = eventBaseSchema
  .pick({
    title: true,
    description: true,
    status: true,
    event_type: true,
    attendance_mode: true,
    location_type: true,
    location_name: true,
    country: true,
    region: true,
    post_code: true,
    city: true,
    street: true,
    house_number: true,
    latitude: true,
    longitude: true,
    location_url: true,
    location_coordinates: true,
    visibility: true,
    start_date: true,
    end_date: true,
    timezone: true,
    default_final_vote_duration_seconds: true,
    change_request_vote_order: true,
    gender_quota_enabled: true,
    capacity: true,
    agenda_management: true,
    meeting_type: true,
    is_bookable: true,
    max_bookings: true,
    stream_url: true,
    image_url: true,
    is_recurring: true,
    recurrence_pattern: true,
    recurrence_rule: true,
    recurrence_interval: true,
    recurrence_days: true,
    recurrence_end_date: true,
    current_agenda_item_id: true,
    registration_deadline: true,
    amendment_deadline: true,
    candidacy_deadline: true,
    delegates_nomination_deadline: true,
    group_id: true,
    has_delegates: true,
    delegate_seat_allocation_type: true,
    total_delegate_seats: true,
    main_group_delegate_allocation_mode: true,
    delegate_election_mode: true,
  })
  .partial()
  .extend({ id: z.string(), debug_correlation_id: z.string().optional() });
export const eventDeleteSchema = z.object({ id: z.string() });
export const eventCancelSchema = z.object({
  id: z.string(),
  cancel_reason: z.string(),
});
export type Event = z.infer<typeof eventSelectSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

// ── event_assembly_scope ─────────────────────────────────────────────
const eventAssemblyScopeBaseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  host_group_id: z.string(),
  source_group_id: z.string(),
  scope_kind: z.string(),
  participant_mode: z.string(),
  required_role_id: z.string().nullable(),
  status: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const eventAssemblyScopeSelectSchema = eventAssemblyScopeBaseSchema;
export type EventAssemblyScope = z.infer<typeof eventAssemblyScopeSelectSchema>;

// ── event_participant ─────────────────────────────────────────────────
const eventParticipantBaseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  user_id: z.string(),
  group_id: z.string().nullable(),
  status: z.string().nullable(),
  visibility: z.string(),
  instance_date: nullableTimestampSchema,
  created_at: timestampSchema,
});

export const eventParticipantSelectSchema = eventParticipantBaseSchema;
export const eventParticipantCreateSchema = eventParticipantBaseSchema
  .omit({ id: true, created_at: true, user_id: true, visibility: true })
  .extend({
    id: z.string(),
    user_id: z.string().optional(),
    instance_date: nullableTimestampSchema.optional(),
    visibility: z.string().optional(),
    initial_role_id: z.string().nullable().optional(),
    initial_role_ids: z.array(z.string()).optional(),
  });
export const eventParticipantUpdateSchema = eventParticipantBaseSchema
  .pick({ status: true, visibility: true })
  .partial()
  .extend({ id: z.string() });
export const eventParticipantDeleteSchema = z.object({ id: z.string() });
export type EventParticipant = z.infer<typeof eventParticipantSelectSchema>;

// ── event_offline_participant ────────────────────────────────────────
const eventOfflineParticipantBaseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  group_offline_member_id: z.string().nullable(),
  source_type: z.enum(['group_member', 'event_extra']),
  first_name: z.string(),
  last_name: z.string(),
  reason_not_signed_up: z.string().nullable(),
  connected_user_id: z.string().nullable(),
  attendance_status: z.enum(['listed', 'confirmed']),
  participation_channel: z.enum(['online', 'offline']),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const eventOfflineParticipantSelectSchema = eventOfflineParticipantBaseSchema;
export const eventOfflineParticipantCreateSchema = eventOfflineParticipantBaseSchema
  .omit({ created_at: true, updated_at: true })
  .extend({ id: z.string(), debug_correlation_id: z.string().optional() });
export const eventOfflineParticipantUpdateSchema = eventOfflineParticipantBaseSchema
  .pick({
    first_name: true,
    last_name: true,
    reason_not_signed_up: true,
    connected_user_id: true,
    attendance_status: true,
    participation_channel: true,
  })
  .partial()
  .extend({ id: z.string(), debug_correlation_id: z.string().optional() });
export const eventOfflineParticipantDeleteSchema = z.object({
  id: z.string(),
  debug_correlation_id: z.string().optional(),
});
export const eventOfflineParticipantBulkImportSchema = z.object({
  event_id: z.string(),
  entries: z.array(
    z.object({
      first_name: z.string(),
      last_name: z.string(),
      reason_not_signed_up: z.string().nullable().optional(),
    })
  ),
  debug_correlation_id: z.string().optional(),
});
export type EventOfflineParticipant = z.infer<typeof eventOfflineParticipantSelectSchema>;

// ── event_participant_role ───────────────────────────────────────────
const eventParticipantRoleBaseSchema = z.object({
  id: z.string(),
  event_participant_id: z.string(),
  role_id: z.string(),
  assigned_at: timestampSchema,
  assigned_by_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const eventParticipantRoleSelectSchema = eventParticipantRoleBaseSchema;
export const eventParticipantRoleCreateSchema = eventParticipantRoleBaseSchema
  .omit({ id: true, assigned_at: true, created_at: true })
  .extend({
    id: z.string(),
    assigned_at: nullableTimestampSchema.optional(),
    assigned_by_id: z.string().nullable().optional(),
  });
export const eventParticipantRoleAssignSchema = z.object({
  event_participant_id: z.string(),
  role_id: z.string(),
  assigned_by_id: z.string().nullable().optional(),
});
export const eventParticipantRoleUnassignSchema = z.object({
  event_participant_id: z.string(),
  role_id: z.string(),
});
export const eventParticipantRolesSyncSchema = z.object({
  event_participant_id: z.string(),
  role_ids: z.array(z.string()),
  assigned_by_id: z.string().nullable().optional(),
});
export const eventParticipantRoleDeleteSchema = z.object({ id: z.string() });
export type EventParticipantRole = z.infer<typeof eventParticipantRoleSelectSchema>;

// ── event role ──────────────────────────────────────────────────────
const eventRoleBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  scope: z.string().nullable(),
  group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  amendment_id: z.string().nullable(),
  blog_id: z.string().nullable(),
  assignment_mode: z.enum(['assigned', 'elected']),
  visibility: z.string(),
  term_start_date: nullableTimestampSchema,
  is_recurring: z.boolean(),
  recurrence_pattern: z.string().nullable(),
  recurrence_rule: z.string().nullable(),
  recurrence_interval: z.number().nullable(),
  recurrence_days: jsonNumberArraySchema.nullable(),
  recurrence_end_date: nullableTimestampSchema,
  scheduled_revote_date: nullableTimestampSchema,
  default_request_role: z.boolean(),
  default_invite_role: z.boolean(),
  assignee_kind: z.enum(['member', 'guest']).nullable(),
  sort_order: z.number(),
  created_at: timestampSchema,
});

export const eventRoleSelectSchema = eventRoleBaseSchema;
export const createEventRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  scope: z.literal('event').optional(),
  group_id: z.string().nullable().optional(),
  event_id: z.string(),
  amendment_id: z.string().nullable().optional(),
  blog_id: z.string().nullable().optional(),
  assignment_mode: z.enum(['assigned', 'elected']).optional(),
  visibility: z.string().optional(),
  term_start_date: nullableTimestampSchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.string().nullable().optional(),
  recurrence_rule: z.string().nullable().optional(),
  recurrence_interval: z.number().nullable().optional(),
  recurrence_days: jsonNumberArraySchema.nullable().optional(),
  recurrence_end_date: nullableTimestampSchema.optional(),
  scheduled_revote_date: nullableTimestampSchema.optional(),
  default_request_role: z.boolean().optional(),
  default_invite_role: z.boolean().optional(),
  assignee_kind: z.enum(['member', 'guest']).optional(),
  sort_order: z.number().optional(),
});
export const updateEventRoleSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  assignee_kind: z.enum(['member', 'guest']).optional(),
  assignment_mode: z.enum(['assigned', 'elected']).optional(),
  visibility: z.string().optional(),
  term_start_date: nullableTimestampSchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.string().nullable().optional(),
  recurrence_rule: z.string().nullable().optional(),
  recurrence_interval: z.number().nullable().optional(),
  recurrence_days: jsonNumberArraySchema.nullable().optional(),
  recurrence_end_date: nullableTimestampSchema.optional(),
  scheduled_revote_date: nullableTimestampSchema.optional(),
  default_request_role: z.boolean().optional(),
  default_invite_role: z.boolean().optional(),
  sort_order: z.number().optional(),
});
export const deleteEventRoleSchema = z.object({ id: z.string() });

// ── participant ───────────────────────────────────────────────────────
const participantBaseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  user_id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string().nullable(),
  status: z.string().nullable(),
  created_at: timestampSchema,
});

export const participantSelectSchema = participantBaseSchema;
export type Participant = z.infer<typeof participantSelectSchema>;

// ── event_exception ───────────────────────────────────────────────────
const eventExceptionBaseSchema = z.object({
  id: z.string(),
  parent_event_id: z.string(),
  original_date: timestampSchema,
  action: z.string(),
  new_title: z.string().nullable(),
  new_description: z.string().nullable(),
  new_start_date: nullableTimestampSchema,
  new_end_date: nullableTimestampSchema,
  new_location_name: z.string().nullable(),
  new_country: z.string().nullable(),
  new_region: z.string().nullable(),
  new_post_code: z.string().nullable(),
  new_city: z.string().nullable(),
  new_street: z.string().nullable(),
  new_house_number: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const eventExceptionSelectSchema = eventExceptionBaseSchema;
export const eventExceptionCreateSchema = eventExceptionBaseSchema
  .omit({ created_at: true, updated_at: true })
  .extend({ id: z.string() });
export const eventExceptionUpdateSchema = eventExceptionBaseSchema
  .pick({
    action: true,
    new_title: true,
    new_description: true,
    new_start_date: true,
    new_end_date: true,
    new_location_name: true,
    new_country: true,
    new_region: true,
    new_post_code: true,
    new_city: true,
    new_street: true,
    new_house_number: true,
  })
  .partial()
  .extend({ id: z.string() });
export const eventExceptionDeleteSchema = z.object({ id: z.string() });
export type EventException = z.infer<typeof eventExceptionSelectSchema>;

// ── meeting booking ───────────────────────────────────────────────────
export const bookMeetingSchema = z.object({
  event_id: z.string(),
  instance_date: nullableTimestampSchema,
});
export const cancelMeetingBookingSchema = z.object({
  event_id: z.string(),
  instance_date: nullableTimestampSchema,
});

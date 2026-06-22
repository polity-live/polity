import { table, string, number, boolean, json, type ReadonlyJSONValue } from '@rocicorp/zero';

export const event = table('event')
  .columns({
    id: string(),
    title: string().optional(),
    description: json<ReadonlyJSONValue>().optional(),
    status: string().optional(),
    event_type: string().optional(),
    attendance_mode: string().optional(),
    location_type: string().optional(),
    location_name: string().optional(),
    country: string().optional(),
    region: string().optional(),
    post_code: string().optional(),
    city: string().optional(),
    street: string().optional(),
    house_number: string().optional(),
    latitude: number().optional(),
    longitude: number().optional(),
    location_url: string().optional(),
    location_coordinates: string().optional(),
    visibility: string(),
    start_date: number().optional(),
    end_date: number().optional(),
    timezone: string().optional(),
    default_final_vote_duration_seconds: number().optional(),
    change_request_vote_order: string(),
    gender_quota_enabled: boolean(),
    capacity: number().optional(),
    participant_count: number(),
    subscriber_count: number(),
    election_count: number(),
    amendment_count: number(),
    open_change_request_count: number(),
    agenda_management: string().optional(),
    meeting_type: string().optional(),
    is_bookable: boolean(),
    max_bookings: number().optional(),
    is_recurring: boolean(),
    recurrence_pattern: string().optional(),
    recurrence_rule: string().optional(),
    recurrence_interval: number().optional(),
    recurrence_days: json<number[]>().optional(),
    recurrence_end_date: number().optional(),
    original_event_id: string().optional(),
    cancel_reason: string().optional(),
    cancelled_at: number().optional(),
    cancelled_by_id: string().optional(),
    x: string().optional(),
    youtube: string().optional(),
    linkedin: string().optional(),
    website: string().optional(),
    stream_url: string().optional(),
    image_url: string().optional(),
    has_delegates: boolean(),
    delegate_count: number(),
    delegate_distribution_method: string().optional(),
    delegate_distribution_status: string().optional(),
    delegate_seat_allocation_type: string().optional(),
    total_delegate_seats: number().optional(),
    delegate_quorum_percentage: number().optional(),
    delegate_vote_weight_type: string().optional(),
    delegate_vote_threshold_percentage: number().optional(),
    delegate_accepted_states: json<Record<string, string>>().optional(),
    delegate_finalized_at: number().optional(),
    delegate_approval_type: string().optional(),
    delegate_check_mode: string().optional(),
    main_group_delegate_allocation_mode: string().optional(),
    delegate_election_mode: string().optional(),
    current_agenda_item_id: string().optional(),
    amendment_deadline: number().optional(),
    registration_deadline: number().optional(),
    candidacy_deadline: number().optional(),
    delegates_nomination_deadline: number().optional(),
    group_id: string().optional(),
    creator_id: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const eventException = table('event_exception')
  .columns({
    id: string(),
    parent_event_id: string(),
    original_date: number(),
    action: string(),
    new_title: string().optional(),
    new_description: string().optional(),
    new_start_date: number().optional(),
    new_end_date: number().optional(),
    new_location_name: string().optional(),
    new_country: string().optional(),
    new_region: string().optional(),
    new_post_code: string().optional(),
    new_city: string().optional(),
    new_street: string().optional(),
    new_house_number: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const eventAssemblyScope = table('event_assembly_scope')
  .columns({
    id: string(),
    event_id: string(),
    host_group_id: string(),
    source_group_id: string(),
    scope_kind: string(),
    participant_mode: string(),
    required_role_id: string().optional(),
    status: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const eventParticipant = table('event_participant')
  .columns({
    id: string(),
    event_id: string(),
    user_id: string(),
    group_id: string().optional(),
    status: string().optional(),
    visibility: string(),
    instance_date: number().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const eventOfflineParticipant = table('event_offline_participant')
  .columns({
    id: string(),
    event_id: string(),
    group_offline_member_id: string().optional(),
    source_type: string(),
    first_name: string(),
    last_name: string(),
    reason_not_signed_up: string().optional(),
    connected_user_id: string().optional(),
    attendance_status: string(),
    participation_channel: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const eventParticipantRole = table('event_participant_role')
  .columns({
    id: string(),
    event_participant_id: string(),
    role_id: string(),
    assigned_at: number(),
    assigned_by_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const participant = table('participant')
  .columns({
    id: string(),
    event_id: string(),
    user_id: string(),
    name: string().optional(),
    email: string().optional(),
    role: string().optional(),
    status: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

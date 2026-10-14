-- 03_event.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.calendar_subscription (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    target_type text NOT NULL,
    target_group_id uuid,
    target_user_id uuid,
    is_visible boolean DEFAULT true NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_calendar_sub_target CHECK ((((target_type = 'group'::text) AND (target_group_id IS NOT NULL) AND (target_user_id IS NULL)) OR ((target_type = 'user'::text) AND (target_user_id IS NOT NULL) AND (target_group_id IS NULL)))),
    CONSTRAINT calendar_subscription_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    description jsonb,
    status text,
    event_type text,
    attendance_mode text DEFAULT 'offline'::text NOT NULL,
    location_type text,
    location_name text,
    country text,
    region text,
    post_code text,
    city text,
    street text,
    house_number text,
    latitude double precision,
    longitude double precision,
    location_kind text,
    location_place_id text,
    location_boundary_source text,
    location_geometry jsonb,
    location_bounds jsonb,
    location_url text,
    location_coordinates text,
    visibility text DEFAULT 'public'::text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    timezone text,
    default_final_vote_duration_seconds integer,
    change_request_vote_order text DEFAULT 'text_position'::text NOT NULL,
    gender_quota_enabled boolean DEFAULT false NOT NULL,
    accreditation_required boolean DEFAULT false NOT NULL,
    capacity integer,
    participant_count integer DEFAULT 0 NOT NULL,
    subscriber_count integer DEFAULT 0 NOT NULL,
    election_count integer DEFAULT 0 NOT NULL,
    amendment_count integer DEFAULT 0 NOT NULL,
    open_change_request_count integer DEFAULT 0 NOT NULL,
    agenda_management text,
    meeting_type text,
    is_bookable boolean DEFAULT false NOT NULL,
    max_bookings integer DEFAULT 1,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_pattern text,
    recurrence_rule text,
    recurrence_interval integer DEFAULT 1,
    recurrence_days integer[],
    recurrence_end_date timestamp with time zone,
    original_event_id uuid,
    cancel_reason text,
    cancelled_at timestamp with time zone,
    cancelled_by_id uuid,
    x text,
    youtube text,
    linkedin text,
    website text,
    stream_url text,
    image_url text,
    video_url text,
    has_delegates boolean DEFAULT false NOT NULL,
    delegate_count integer DEFAULT 0 NOT NULL,
    delegate_distribution_method text,
    delegate_distribution_status text,
    delegate_seat_allocation_type text,
    total_delegate_seats integer,
    delegate_quorum_percentage numeric,
    delegate_vote_weight_type text,
    delegate_vote_threshold_percentage numeric,
    delegate_accepted_states jsonb,
    delegate_finalized_at timestamp with time zone,
    delegate_approval_type text,
    delegate_check_mode text,
    main_group_delegate_allocation_mode text,
    delegate_election_mode text DEFAULT 'list'::text NOT NULL,
    current_agenda_item_id uuid,
    amendment_deadline timestamp with time zone,
    registration_deadline timestamp with time zone,
    candidacy_deadline timestamp with time zone,
    delegates_nomination_deadline timestamp with time zone,
    group_id uuid,
    creator_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT event_attendance_mode_check CHECK ((attendance_mode = ANY (ARRAY['online'::text, 'hybrid'::text, 'offline'::text]))),
    CONSTRAINT event_single_primary_media_check CHECK (((image_url IS NULL) OR (video_url IS NULL))),
    CONSTRAINT event_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    actor_id uuid,
    actor_type text DEFAULT 'user'::text NOT NULL,
    subject_user_id uuid,
    action text NOT NULL,
    severity text NOT NULL,
    changes jsonb DEFAULT '[]'::jsonb NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_activity_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'cancelled'::text, 'participant_added'::text, 'participant_updated'::text, 'participant_removed'::text, 'offline_participant_added'::text, 'offline_participant_updated'::text, 'offline_participant_removed'::text, 'offline_participants_imported'::text, 'role_created'::text, 'role_updated'::text, 'role_deleted'::text, 'role_assigned'::text, 'role_unassigned'::text, 'delegates_finalized'::text, 'delegates_reconciled'::text, 'exception_created'::text, 'exception_updated'::text, 'exception_deleted'::text, 'agenda_created'::text, 'agenda_updated'::text, 'agenda_deleted'::text, 'agenda_reordered'::text, 'booking_created'::text, 'booking_cancelled'::text, 'result_recorded'::text]))),
    CONSTRAINT event_activity_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'system'::text]))),
    CONSTRAINT event_activity_changes_check CHECK ((jsonb_typeof(changes) = 'array'::text)),
    CONSTRAINT event_activity_context_check CHECK ((jsonb_typeof(context) = 'object'::text)),
    CONSTRAINT event_activity_severity_check CHECK ((severity = ANY (ARRAY['normal'::text, 'high'::text]))),
    CONSTRAINT event_activity_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_assembly_scope (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    host_group_id uuid NOT NULL,
    source_group_id uuid NOT NULL,
    scope_kind text NOT NULL,
    participant_mode text NOT NULL,
    required_role_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_assembly_scope_participant_mode_check CHECK ((participant_mode = ANY (ARRAY['all_members'::text, 'delegates'::text, 'role_members'::text, 'none'::text]))),
    CONSTRAINT event_assembly_scope_scope_kind_check CHECK ((scope_kind = ANY (ARRAY['general_member_source'::text, 'delegate_source'::text, 'delegate_assignment_source'::text]))),
    CONSTRAINT event_assembly_scope_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT event_assembly_scope_event_id_source_group_id_scope_kind_pa_key UNIQUE (event_id, source_group_id, scope_kind, participant_mode),
    CONSTRAINT event_assembly_scope_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_exception (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_event_id uuid NOT NULL,
    original_date timestamp with time zone NOT NULL,
    action text NOT NULL,
    new_title text,
    new_description text,
    new_start_date timestamp with time zone,
    new_end_date timestamp with time zone,
    new_location_name text,
    new_country text,
    new_region text,
    new_post_code text,
    new_city text,
    new_street text,
    new_house_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_exception_pkey PRIMARY KEY (id),
    CONSTRAINT uq_event_exception_parent_date UNIQUE (parent_event_id, original_date)
);

CREATE TABLE public.event_offline_participant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    group_offline_member_id uuid,
    source_type text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    reason_not_signed_up text,
    connected_user_id uuid,
    attendance_status text DEFAULT 'listed'::text NOT NULL,
    participation_channel text DEFAULT 'offline'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_offline_participant_attendance_status_check CHECK ((attendance_status = ANY (ARRAY['listed'::text, 'confirmed'::text]))),
    CONSTRAINT event_offline_participant_participation_channel_check CHECK ((participation_channel = ANY (ARRAY['online'::text, 'offline'::text]))),
    CONSTRAINT event_offline_participant_source_type_check CHECK ((source_type = ANY (ARRAY['group_member'::text, 'event_extra'::text]))),
    CONSTRAINT event_offline_participant_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_participant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    group_id uuid,
    status text,
    visibility text DEFAULT 'public'::text NOT NULL,
    instance_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_participant_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_participant_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_participant_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_participant_role_event_participant_id_role_id_key UNIQUE (event_participant_id, role_id),
    CONSTRAINT event_participant_role_pkey PRIMARY KEY (id)
);

CREATE TABLE public.participant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text,
    email text,
    role text,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT participant_pkey PRIMARY KEY (id)
);

ALTER TABLE public.calendar_subscription ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_activity ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_assembly_scope ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_exception ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_offline_participant ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_participant ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_participant_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.participant ENABLE ROW LEVEL SECURITY;

CREATE INDEX event_tutorial_run_id_idx ON public.event USING btree (tutorial_run_id);

CREATE INDEX idx_calendar_sub_user ON public.calendar_subscription USING btree (user_id);

CREATE UNIQUE INDEX idx_calendar_sub_user_group ON public.calendar_subscription USING btree (user_id, target_group_id) WHERE (target_group_id IS NOT NULL);

CREATE UNIQUE INDEX idx_calendar_sub_user_user ON public.calendar_subscription USING btree (user_id, target_user_id) WHERE (target_user_id IS NOT NULL);

CREATE INDEX idx_event_activity_created ON public.event_activity USING btree (event_id, created_at DESC, id DESC);

CREATE INDEX idx_event_activity_severity_created ON public.event_activity USING btree (event_id, severity, created_at DESC, id DESC);

CREATE INDEX idx_event_assembly_scope_event ON public.event_assembly_scope USING btree (event_id, status);

CREATE INDEX idx_event_assembly_scope_host_group ON public.event_assembly_scope USING btree (host_group_id, status);

CREATE INDEX idx_event_assembly_scope_source_group ON public.event_assembly_scope USING btree (source_group_id, status);

CREATE INDEX idx_event_creator ON public.event USING btree (creator_id);

CREATE INDEX idx_event_exception_parent ON public.event_exception USING btree (parent_event_id);

CREATE INDEX idx_event_group ON public.event USING btree (group_id);

CREATE INDEX idx_event_offline_participant_connected_user ON public.event_offline_participant USING btree (connected_user_id);

CREATE INDEX idx_event_offline_participant_event ON public.event_offline_participant USING btree (event_id);

CREATE INDEX idx_event_offline_participant_group_offline_member ON public.event_offline_participant USING btree (group_offline_member_id);

CREATE UNIQUE INDEX idx_event_offline_participant_unique_connected_user ON public.event_offline_participant USING btree (event_id, connected_user_id) WHERE (connected_user_id IS NOT NULL);

CREATE INDEX idx_event_participant_event ON public.event_participant USING btree (event_id);

CREATE INDEX idx_event_participant_instance ON public.event_participant USING btree (event_id, instance_date);

CREATE INDEX idx_event_participant_role_assigned_by ON public.event_participant_role USING btree (assigned_by_id);

CREATE INDEX idx_event_participant_role_participant ON public.event_participant_role USING btree (event_participant_id);

CREATE INDEX idx_event_participant_role_role ON public.event_participant_role USING btree (role_id);

CREATE UNIQUE INDEX idx_event_participant_unique_event_user ON public.event_participant USING btree (event_id, user_id) WHERE (instance_date IS NULL);

CREATE UNIQUE INDEX idx_event_participant_unique_event_user_instance ON public.event_participant USING btree (event_id, user_id, instance_date) WHERE (instance_date IS NOT NULL);

CREATE INDEX idx_event_participant_user ON public.event_participant USING btree (user_id);

CREATE INDEX idx_event_start_date ON public.event USING btree (start_date);

CREATE INDEX idx_event_status ON public.event USING btree (status);

CREATE INDEX idx_participant_event ON public.participant USING btree (event_id);

CREATE INDEX idx_participant_user ON public.participant USING btree (user_id);

CREATE INDEX idx_zero_event_participant_event_created_id ON public.event_participant USING btree (event_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_event_participant_event_user_id ON public.event_participant USING btree (event_id, user_id, id);

CREATE INDEX idx_zero_event_participant_user_created_id ON public.event_participant USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_event_participant_user_status_event ON public.event_participant USING btree (user_id, status, event_id);

CREATE POLICY service_role_all ON public.calendar_subscription TO service_role USING (true);

CREATE POLICY service_role_all ON public.event TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_activity TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_assembly_scope TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_exception TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_offline_participant TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_participant TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_participant_role TO service_role USING (true);

CREATE POLICY service_role_all ON public.participant TO service_role USING (true);

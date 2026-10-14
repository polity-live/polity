-- 05_2_amendment.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.amendment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text,
    title text,
    reason text,
    category text,
    preamble text,
    created_by_id uuid NOT NULL,
    group_id uuid,
    event_id uuid,
    clone_source_id uuid,
    origin_amendment_id uuid,
    document_id uuid,
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
    upvotes integer DEFAULT 0 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    tags jsonb,
    visibility text DEFAULT 'public'::text NOT NULL,
    subscriber_count integer DEFAULT 0 NOT NULL,
    clone_count integer DEFAULT 0 NOT NULL,
    change_request_count integer DEFAULT 0 NOT NULL,
    internal_cr_voting_close_trigger text DEFAULT 'all_collaborators_voted'::text NOT NULL,
    internal_cr_voting_duration_minutes integer,
    internal_cr_resolution_visibility text DEFAULT 'public'::text NOT NULL,
    discussions jsonb,
    comment_count integer DEFAULT 0 NOT NULL,
    collaborator_count integer DEFAULT 0 NOT NULL,
    image_url text,
    video_url text,
    x text,
    youtube text,
    linkedin text,
    website text,
    current_process_run_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT amendment_single_primary_media_check CHECK (((image_url IS NULL) OR (video_url IS NULL))),
    CONSTRAINT amendment_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    actor_id uuid,
    actor_type text DEFAULT 'user'::text NOT NULL,
    subject_user_id uuid,
    action text NOT NULL,
    severity text NOT NULL,
    changes jsonb DEFAULT '[]'::jsonb NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_activity_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'collaborator_added'::text, 'collaborator_updated'::text, 'collaborator_removed'::text, 'change_request_created'::text, 'change_request_updated'::text, 'change_request_resolved'::text, 'process_started'::text, 'process_updated'::text, 'process_task_updated'::text, 'process_replanned'::text, 'group_decision_updated'::text, 'support_confirmation_updated'::text, 'implementation_updated'::text]))),
    CONSTRAINT amendment_activity_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'system'::text]))),
    CONSTRAINT amendment_activity_changes_check CHECK ((jsonb_typeof(changes) = 'array'::text)),
    CONSTRAINT amendment_activity_context_check CHECK ((jsonb_typeof(context) = 'object'::text)),
    CONSTRAINT amendment_activity_severity_check CHECK ((severity = ANY (ARRAY['normal'::text, 'high'::text]))),
    CONSTRAINT amendment_activity_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_city_design (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    title text,
    bbox jsonb,
    center_lat numeric,
    center_lon numeric,
    osm_snapshot jsonb,
    design_state jsonb,
    content_revision integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    estimated_total_cost_minor integer DEFAULT 0 NOT NULL,
    cost_catalog_version text,
    cost_summary jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_city_design_content_revision_check CHECK ((content_revision >= 0)),
    CONSTRAINT amendment_city_design_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_collaborator (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid,
    status text,
    visibility text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_collaborator_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_group_decision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    group_id uuid NOT NULL,
    process_run_id uuid,
    process_branch_id uuid,
    process_step_run_id uuid,
    status text NOT NULL,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_group_decision_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_path (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    process_run_id uuid,
    title text,
    workflow_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_path_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_path_segment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path_id uuid NOT NULL,
    process_branch_id uuid,
    process_step_run_id uuid,
    group_id uuid,
    event_id uuid,
    order_index integer,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_path_segment_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_process_branch (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_run_id uuid NOT NULL,
    parent_branch_id uuid,
    merged_into_branch_id uuid,
    source_step_run_id uuid,
    document_version_id uuid,
    document_id uuid,
    discussions jsonb,
    title text,
    status text DEFAULT 'pending_event'::text NOT NULL,
    editing_mode text DEFAULT 'edit'::text NOT NULL,
    resolution text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_process_branch_editing_mode_check CHECK ((editing_mode = ANY (ARRAY['edit'::text, 'view'::text, 'suggest_internal'::text, 'suggest_event'::text, 'vote_internal'::text, 'event_final_closing_vote'::text, 'passed'::text, 'rejected'::text]))),
    CONSTRAINT amendment_process_branch_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_process_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    root_workflow_id uuid,
    selected_source_group_id uuid,
    selected_target_group_id uuid,
    selected_target_workflow_id uuid,
    active_branch_id uuid,
    terminal_step_run_id uuid,
    status text DEFAULT 'pending_event'::text NOT NULL,
    evaluation_mode text,
    evaluation_date timestamp with time zone,
    evaluation_offset_months integer,
    evaluation_offset_years integer,
    implementation_status text,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_process_run_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_process_step_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_run_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    workflow_id uuid,
    workflow_step_id uuid,
    step_kind text DEFAULT 'group_vote'::text NOT NULL,
    selection_mode text,
    merge_strategy text,
    status text DEFAULT 'pending_event'::text NOT NULL,
    source_group_id uuid,
    target_group_id uuid,
    event_id uuid,
    agenda_item_id uuid,
    vote_id uuid,
    support_confirmation_id uuid,
    decision_status text,
    order_index integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_process_step_run_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_support_vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_support_vote_pkey PRIMARY KEY (id)
);

CREATE TABLE public.amendment_vote_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote integer,
    is_indication boolean DEFAULT false NOT NULL,
    indicated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_vote_entry_pkey PRIMARY KEY (id)
);

CREATE TABLE public.process_task (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_run_id uuid NOT NULL,
    branch_id uuid,
    step_run_id uuid,
    task_type text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    title text,
    description text,
    group_id uuid,
    target_group_id uuid,
    event_id uuid,
    agenda_item_id uuid,
    support_confirmation_id uuid,
    due_at timestamp with time zone,
    resolved_at timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT process_task_pkey PRIMARY KEY (id)
);

CREATE TABLE public.support_confirmation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    process_run_id uuid,
    process_step_run_id uuid,
    process_task_id uuid,
    group_id uuid,
    event_id uuid,
    confirmed_by_id uuid NOT NULL,
    status text,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_confirmation_pkey PRIMARY KEY (id)
);

ALTER TABLE public.amendment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_activity ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_city_design ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_collaborator ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_group_decision ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_path ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_path_segment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_process_branch ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_process_run ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_process_step_run ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_support_vote ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amendment_vote_entry ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.process_task ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.support_confirmation ENABLE ROW LEVEL SECURITY;

CREATE INDEX amendment_tutorial_run_id_idx ON public.amendment USING btree (tutorial_run_id);

CREATE INDEX idx_amendment_activity_created ON public.amendment_activity USING btree (amendment_id, created_at DESC, id DESC);

CREATE INDEX idx_amendment_activity_severity_created ON public.amendment_activity USING btree (amendment_id, severity, created_at DESC, id DESC);

CREATE INDEX idx_amendment_city_design_amendment ON public.amendment_city_design USING btree (amendment_id);

CREATE INDEX idx_amendment_city_design_created_by ON public.amendment_city_design USING btree (created_by_id);

CREATE INDEX idx_amendment_city_design_updated_at ON public.amendment_city_design USING btree (updated_at DESC);

CREATE INDEX idx_amendment_collaborator_amendment ON public.amendment_collaborator USING btree (amendment_id);

CREATE INDEX idx_amendment_collaborator_user ON public.amendment_collaborator USING btree (user_id);

CREATE INDEX idx_amendment_created_by ON public.amendment USING btree (created_by_id);

CREATE INDEX idx_amendment_event ON public.amendment USING btree (event_id);

CREATE INDEX idx_amendment_group ON public.amendment USING btree (group_id);

CREATE INDEX idx_amendment_group_decision_group ON public.amendment_group_decision USING btree (group_id);

CREATE INDEX idx_amendment_group_decision_process_run ON public.amendment_group_decision USING btree (process_run_id);

CREATE INDEX idx_amendment_group_decision_status ON public.amendment_group_decision USING btree (status);

CREATE UNIQUE INDEX idx_amendment_group_decision_unique ON public.amendment_group_decision USING btree (amendment_id, group_id);

CREATE INDEX idx_amendment_origin ON public.amendment USING btree (origin_amendment_id);

CREATE INDEX idx_amendment_path_amendment ON public.amendment_path USING btree (amendment_id);

CREATE INDEX idx_amendment_path_segment_path ON public.amendment_path_segment USING btree (path_id);

CREATE INDEX idx_amendment_process_branch_document ON public.amendment_process_branch USING btree (document_id);

CREATE INDEX idx_amendment_process_branch_editing_mode ON public.amendment_process_branch USING btree (editing_mode);

CREATE INDEX idx_amendment_process_branch_parent ON public.amendment_process_branch USING btree (parent_branch_id);

CREATE INDEX idx_amendment_process_branch_run ON public.amendment_process_branch USING btree (process_run_id);

CREATE INDEX idx_amendment_process_branch_status ON public.amendment_process_branch USING btree (status);

CREATE INDEX idx_amendment_process_run_amendment ON public.amendment_process_run USING btree (amendment_id);

CREATE INDEX idx_amendment_process_run_status ON public.amendment_process_run USING btree (status);

CREATE INDEX idx_amendment_process_step_run_branch ON public.amendment_process_step_run USING btree (branch_id);

CREATE INDEX idx_amendment_process_step_run_event ON public.amendment_process_step_run USING btree (event_id);

CREATE INDEX idx_amendment_process_step_run_process ON public.amendment_process_step_run USING btree (process_run_id);

CREATE INDEX idx_amendment_process_step_run_status ON public.amendment_process_step_run USING btree (status);

CREATE INDEX idx_amendment_support_vote_amendment ON public.amendment_support_vote USING btree (amendment_id);

CREATE INDEX idx_amendment_support_vote_user ON public.amendment_support_vote USING btree (user_id);

CREATE INDEX idx_amendment_vote_entry_amendment ON public.amendment_vote_entry USING btree (amendment_id);

CREATE INDEX idx_amendment_vote_entry_user ON public.amendment_vote_entry USING btree (user_id);

CREATE INDEX idx_process_task_due_at ON public.process_task USING btree (due_at);

CREATE INDEX idx_process_task_group ON public.process_task USING btree (group_id);

CREATE INDEX idx_process_task_process_run ON public.process_task USING btree (process_run_id);

CREATE INDEX idx_process_task_status ON public.process_task USING btree (status);

CREATE INDEX idx_process_task_type ON public.process_task USING btree (task_type);

CREATE INDEX idx_support_confirmation_amendment ON public.support_confirmation USING btree (amendment_id);

CREATE INDEX idx_support_confirmation_user ON public.support_confirmation USING btree (confirmed_by_id);

CREATE INDEX idx_zero_amendment_clone_source_created_id ON public.amendment USING btree (clone_source_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_collaborator_amendment_created_id ON public.amendment_collaborator USING btree (amendment_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_collaborator_user_created_id ON public.amendment_collaborator USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_collaborator_user_status_amendment ON public.amendment_collaborator USING btree (user_id, status, amendment_id);

CREATE INDEX idx_zero_amendment_creator_created_id ON public.amendment USING btree (created_by_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_amendment_group_created_id ON public.amendment USING btree (group_id, created_at DESC, id DESC);

CREATE POLICY service_role_all ON public.amendment TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_activity TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_city_design TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_collaborator TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_group_decision TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_path TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_path_segment TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_process_branch TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_process_run TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_process_step_run TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_support_vote TO service_role USING (true);

CREATE POLICY service_role_all ON public.amendment_vote_entry TO service_role USING (true);

CREATE POLICY service_role_all ON public.process_task TO service_role USING (true);

CREATE POLICY service_role_all ON public.support_confirmation TO service_role USING (true);

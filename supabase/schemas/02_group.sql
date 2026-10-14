-- 02_group.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.action_right (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource text,
    action text,
    role_id uuid NOT NULL,
    group_id uuid,
    event_id uuid,
    amendment_id uuid,
    blog_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT action_right_pkey PRIMARY KEY (id)
);

CREATE TABLE public."group" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    description jsonb,
    email text,
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
    image_url text,
    video_url text,
    visibility text DEFAULT 'public'::text NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    signed_up_member_count integer DEFAULT 0 NOT NULL,
    subscriber_count integer DEFAULT 0 NOT NULL,
    event_count integer DEFAULT 0 NOT NULL,
    amendment_count integer DEFAULT 0 NOT NULL,
    document_count integer DEFAULT 0 NOT NULL,
    group_type text DEFAULT 'base'::text NOT NULL,
    has_hierarchy_children boolean DEFAULT false NOT NULL,
    has_sibling_connections boolean DEFAULT false NOT NULL,
    connected_group_id uuid,
    primary_sibling_membership_mode text,
    sibling_membership_mode text,
    sibling_role_id uuid,
    x text,
    youtube text,
    linkedin text,
    website text,
    whatsapp text,
    instagram text,
    twitter text,
    facebook text,
    snapchat text,
    tiktok text,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT group_group_type_check CHECK ((group_type = ANY (ARRAY['base'::text, 'hierarchical'::text, 'sibling'::text, 'parliament'::text, 'committee'::text, 'institution'::text]))),
    CONSTRAINT group_primary_sibling_membership_mode_check CHECK (((primary_sibling_membership_mode IS NULL) OR (primary_sibling_membership_mode = ANY (ARRAY['none'::text, 'all_members'::text, 'role_members'::text, 'selected_source_groups'::text])))),
    CONSTRAINT group_sibling_membership_mode_check CHECK (((sibling_membership_mode IS NULL) OR (sibling_membership_mode = ANY (ARRAY['open'::text, 'elected'::text, 'parliament'::text])))),
    CONSTRAINT group_single_primary_media_check CHECK (((image_url IS NULL) OR (video_url IS NULL))),
    CONSTRAINT group_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    actor_id uuid,
    actor_type text DEFAULT 'user'::text NOT NULL,
    subject_user_id uuid,
    action text NOT NULL,
    severity text NOT NULL,
    changes jsonb DEFAULT '[]'::jsonb NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_activity_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'membership_added'::text, 'membership_updated'::text, 'membership_removed'::text, 'guest_added'::text, 'guest_updated'::text, 'guest_removed'::text, 'offline_member_added'::text, 'offline_member_updated'::text, 'offline_member_removed'::text, 'offline_members_imported'::text, 'role_created'::text, 'role_updated'::text, 'role_deleted'::text, 'role_assigned'::text, 'role_unassigned'::text, 'right_assigned'::text, 'right_unassigned'::text, 'term_updated'::text, 'relationship_updated'::text, 'reconciliation'::text]))),
    CONSTRAINT group_activity_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'system'::text]))),
    CONSTRAINT group_activity_changes_check CHECK ((jsonb_typeof(changes) = 'array'::text)),
    CONSTRAINT group_activity_context_check CHECK ((jsonb_typeof(context) = 'object'::text)),
    CONSTRAINT group_activity_severity_check CHECK ((severity = ANY (ARRAY['normal'::text, 'high'::text]))),
    CONSTRAINT group_activity_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_guest_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'invited'::text NOT NULL,
    invited_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_guest_access_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'invited'::text, 'active'::text, 'revoked'::text]))),
    CONSTRAINT group_guest_access_group_id_user_id_key UNIQUE (group_id, user_id),
    CONSTRAINT group_guest_access_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_guest_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_guest_access_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_guest_role_group_guest_access_id_role_id_key UNIQUE (group_guest_access_id, role_id),
    CONSTRAINT group_guest_role_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_membership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text,
    visibility text DEFAULT 'public'::text NOT NULL,
    source text DEFAULT 'direct'::text NOT NULL,
    source_group_id uuid,
    origin_kind text DEFAULT 'direct'::text NOT NULL,
    connection_id uuid,
    membership_rule_id uuid,
    part_group_id uuid,
    base_group_id uuid,
    is_auto_managed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_membership_origin_kind_check CHECK ((origin_kind = ANY (ARRAY['direct'::text, 'hierarchy'::text, 'sibling_all_members'::text, 'sibling_role_members'::text, 'sibling_selected_source_groups'::text, 'manual_projection'::text]))),
    CONSTRAINT group_membership_pkey PRIMARY KEY (id),
    CONSTRAINT group_membership_user_id_group_id_key UNIQUE (user_id, group_id)
);

CREATE TABLE public.group_membership_origin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_membership_id uuid NOT NULL,
    origin_kind text NOT NULL,
    source_group_id uuid,
    source_membership_id uuid,
    connection_id uuid,
    membership_rule_id uuid,
    source_role_id uuid,
    part_group_id uuid,
    base_group_id uuid,
    depth integer DEFAULT 0 NOT NULL,
    path_group_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_membership_origin_origin_kind_check CHECK ((origin_kind = ANY (ARRAY['direct'::text, 'hierarchy'::text, 'sibling_all_members'::text, 'sibling_role_members'::text, 'sibling_selected_source_groups'::text, 'manual_projection'::text]))),
    CONSTRAINT group_membership_origin_group_membership_id_origin_kind_sou_key UNIQUE (group_membership_id, origin_kind, source_group_id, connection_id, membership_rule_id, source_role_id),
    CONSTRAINT group_membership_origin_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_membership_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_membership_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id uuid NOT NULL,
    CONSTRAINT group_membership_role_group_membership_id_role_id_key UNIQUE (group_membership_id, role_id),
    CONSTRAINT group_membership_role_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_offline_member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    reason_not_signed_up text,
    connected_user_id uuid,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_offline_member_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_offline_membership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_offline_member_id uuid NOT NULL,
    group_id uuid NOT NULL,
    status text,
    visibility text DEFAULT 'public'::text NOT NULL,
    source text DEFAULT 'direct'::text NOT NULL,
    source_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_offline_membership_group_offline_member_id_group_id_key UNIQUE (group_offline_member_id, group_id),
    CONSTRAINT group_offline_membership_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_offline_membership_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_offline_membership_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_offline_membership_role_group_offline_membership_id_r_key UNIQUE (group_offline_membership_id, role_id),
    CONSTRAINT group_offline_membership_role_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    description text,
    scope text,
    group_id uuid,
    event_id uuid,
    amendment_id uuid,
    blog_id uuid,
    assignment_mode text DEFAULT 'assigned'::text NOT NULL,
    visibility text DEFAULT 'public'::text NOT NULL,
    term_start_date timestamp with time zone,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_pattern text,
    recurrence_rule text,
    recurrence_interval integer,
    recurrence_days integer[],
    recurrence_end_date timestamp with time zone,
    scheduled_revote_date timestamp with time zone,
    default_request_role boolean DEFAULT false NOT NULL,
    default_invite_role boolean DEFAULT false NOT NULL,
    assignee_kind text DEFAULT 'member'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_assignee_kind_check CHECK ((assignee_kind = ANY (ARRAY['member'::text, 'guest'::text]))),
    CONSTRAINT role_assignment_mode_check CHECK ((assignment_mode = ANY (ARRAY['assigned'::text, 'elected'::text]))),
    CONSTRAINT role_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'private'::text]))),
    CONSTRAINT role_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role_holder_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    user_id uuid NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_holder_history_pkey PRIMARY KEY (id)
);

ALTER TABLE public.action_right ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."group" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_activity ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_guest_access ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_guest_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership_origin ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_offline_member ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_offline_membership ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_offline_membership_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_holder_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX group_membership_role_studio_rights ON public.group_membership_role USING btree (group_id, role_id);

CREATE INDEX group_tutorial_run_id_idx ON public."group" USING btree (tutorial_run_id);

CREATE INDEX idx_action_right_role ON public.action_right USING btree (role_id);

CREATE INDEX idx_group_activity_created ON public.group_activity USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_group_activity_severity_created ON public.group_activity USING btree (group_id, severity, created_at DESC, id DESC);

CREATE INDEX idx_group_connected_group ON public."group" USING btree (connected_group_id);

CREATE INDEX idx_group_guest_access_group ON public.group_guest_access USING btree (group_id);

CREATE INDEX idx_group_guest_access_status ON public.group_guest_access USING btree (status);

CREATE INDEX idx_group_guest_access_user ON public.group_guest_access USING btree (user_id);

CREATE INDEX idx_group_guest_role_access ON public.group_guest_role USING btree (group_guest_access_id);

CREATE INDEX idx_group_guest_role_assigned_by ON public.group_guest_role USING btree (assigned_by_id);

CREATE INDEX idx_group_guest_role_role ON public.group_guest_role USING btree (role_id);

CREATE INDEX idx_group_hierarchy_children ON public."group" USING btree (has_hierarchy_children);

CREATE INDEX idx_group_membership_base_group ON public.group_membership USING btree (base_group_id);

CREATE INDEX idx_group_membership_connection ON public.group_membership USING btree (connection_id);

CREATE INDEX idx_group_membership_group ON public.group_membership USING btree (group_id);

CREATE INDEX idx_group_membership_group_status ON public.group_membership USING btree (group_id, status);

CREATE INDEX idx_group_membership_membership_rule ON public.group_membership USING btree (membership_rule_id);

CREATE INDEX idx_group_membership_origin_base_group ON public.group_membership_origin USING btree (base_group_id);

CREATE INDEX idx_group_membership_origin_connection ON public.group_membership_origin USING btree (connection_id);

CREATE INDEX idx_group_membership_origin_kind ON public.group_membership USING btree (origin_kind);

CREATE INDEX idx_group_membership_origin_membership ON public.group_membership_origin USING btree (group_membership_id);

CREATE INDEX idx_group_membership_origin_part_group ON public.group_membership_origin USING btree (part_group_id);

CREATE INDEX idx_group_membership_origin_rule ON public.group_membership_origin USING btree (membership_rule_id);

CREATE INDEX idx_group_membership_origin_source_group ON public.group_membership_origin USING btree (source_group_id);

CREATE INDEX idx_group_membership_origin_source_membership ON public.group_membership_origin USING btree (source_membership_id);

CREATE INDEX idx_group_membership_part_group ON public.group_membership USING btree (part_group_id);

CREATE INDEX idx_group_membership_role_assigned_by ON public.group_membership_role USING btree (assigned_by_id);

CREATE INDEX idx_group_membership_role_membership ON public.group_membership_role USING btree (group_membership_id);

CREATE INDEX idx_group_membership_role_role ON public.group_membership_role USING btree (role_id);

CREATE INDEX idx_group_membership_source_group ON public.group_membership USING btree (source_group_id);

CREATE INDEX idx_group_membership_user ON public.group_membership USING btree (user_id);

CREATE INDEX idx_group_membership_user_status ON public.group_membership USING btree (user_id, status);

CREATE INDEX idx_group_offline_member_connected_user ON public.group_offline_member USING btree (connected_user_id);

CREATE INDEX idx_group_offline_member_group ON public.group_offline_member USING btree (group_id);

CREATE UNIQUE INDEX idx_group_offline_member_unique_connected_user ON public.group_offline_member USING btree (group_id, connected_user_id) WHERE (connected_user_id IS NOT NULL);

CREATE INDEX idx_group_offline_membership_group ON public.group_offline_membership USING btree (group_id);

CREATE INDEX idx_group_offline_membership_member ON public.group_offline_membership USING btree (group_offline_member_id);

CREATE INDEX idx_group_offline_membership_role_assigned_by ON public.group_offline_membership_role USING btree (assigned_by_id);

CREATE INDEX idx_group_offline_membership_role_membership ON public.group_offline_membership_role USING btree (group_offline_membership_id);

CREATE INDEX idx_group_offline_membership_role_role ON public.group_offline_membership_role USING btree (role_id);

CREATE INDEX idx_group_offline_membership_source_group ON public.group_offline_membership USING btree (source_group_id);

CREATE INDEX idx_group_owner ON public."group" USING btree (owner_id);

CREATE INDEX idx_group_sibling_connections ON public."group" USING btree (has_sibling_connections);

CREATE INDEX idx_group_type ON public."group" USING btree (group_type);

CREATE INDEX idx_role_assignee_kind ON public.role USING btree (assignee_kind);

CREATE INDEX idx_role_event ON public.role USING btree (event_id);

CREATE INDEX idx_role_group ON public.role USING btree (group_id);

CREATE INDEX idx_role_holder_history_role ON public.role_holder_history USING btree (role_id);

CREATE INDEX idx_role_holder_history_user ON public.role_holder_history USING btree (user_id);

CREATE INDEX idx_role_scope ON public.role USING btree (scope);

CREATE INDEX idx_zero_action_right_role_resource_action ON public.action_right USING btree (role_id, resource, action);

CREATE INDEX idx_zero_group_membership_group_created_id ON public.group_membership USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_group_membership_user_created_id ON public.group_membership USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_role_amendment_scope_id ON public.role USING btree (amendment_id, scope, id);

CREATE INDEX idx_zero_role_blog_scope_id ON public.role USING btree (blog_id, scope, id);

CREATE INDEX idx_zero_role_group_scope_order_id ON public.role USING btree (group_id, scope, sort_order, id);

CREATE INDEX idx_zero_role_holder_history_role_end_id ON public.role_holder_history USING btree (role_id, end_date, id);

CREATE POLICY service_role_all ON public.action_right TO service_role USING (true);

CREATE POLICY service_role_all ON public."group" TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_activity TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_guest_access TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_guest_role TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership_origin TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership_role TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_offline_member TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_offline_membership TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_offline_membership_role TO service_role USING (true);

CREATE POLICY service_role_all ON public.role TO service_role USING (true);

CREATE POLICY service_role_all ON public.role_holder_history TO service_role USING (true);

-- 05_1_network.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.follow (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid NOT NULL,
    followee_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follow_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_connection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_a_id uuid NOT NULL,
    group_b_id uuid NOT NULL,
    connection_type text NOT NULL,
    from_group_id uuid,
    to_group_id uuid,
    connection_kind text,
    parent_group_id uuid,
    child_group_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_connection_canonical_pair_check CHECK ((group_a_id < group_b_id)),
    CONSTRAINT group_connection_connection_kind_check CHECK (((connection_kind IS NULL) OR (connection_kind = ANY (ARRAY['hierarchy'::text, 'sibling'::text, 'parliament'::text, 'committee'::text, 'institution'::text])))),
    CONSTRAINT group_connection_connection_type_check CHECK ((connection_type = ANY (ARRAY['hierarchy'::text, 'peer'::text]))),
    CONSTRAINT group_connection_structure_check CHECK ((((connection_type = 'peer'::text) AND (parent_group_id IS NULL) AND (child_group_id IS NULL)) OR ((connection_type = 'hierarchy'::text) AND (parent_group_id IS NOT NULL) AND (child_group_id IS NOT NULL) AND (parent_group_id <> child_group_id) AND (((parent_group_id = group_a_id) AND (child_group_id = group_b_id)) OR ((parent_group_id = group_b_id) AND (child_group_id = group_a_id)))))),
    CONSTRAINT group_connection_group_a_id_group_b_id_key UNIQUE (group_a_id, group_b_id),
    CONSTRAINT group_connection_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_connection_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    active_connection_id uuid,
    proposed_connection_id uuid NOT NULL,
    group_a_id uuid NOT NULL,
    group_b_id uuid NOT NULL,
    desired_connection_type text NOT NULL,
    desired_parent_group_id uuid,
    desired_child_group_id uuid,
    structure_status text DEFAULT 'pending'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    initiator_group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_connection_request_canonical_pair_check CHECK ((group_a_id < group_b_id)),
    CONSTRAINT group_connection_request_desired_connection_type_check CHECK ((desired_connection_type = ANY (ARRAY['hierarchy'::text, 'peer'::text]))),
    CONSTRAINT group_connection_request_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partially_approved'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT group_connection_request_structure_check CHECK ((((desired_connection_type = 'peer'::text) AND (desired_parent_group_id IS NULL) AND (desired_child_group_id IS NULL)) OR ((desired_connection_type = 'hierarchy'::text) AND (desired_parent_group_id IS NOT NULL) AND (desired_child_group_id IS NOT NULL) AND (desired_parent_group_id <> desired_child_group_id) AND (((desired_parent_group_id = group_a_id) AND (desired_child_group_id = group_b_id)) OR ((desired_parent_group_id = group_b_id) AND (desired_child_group_id = group_a_id)))))),
    CONSTRAINT group_connection_request_structure_status_check CHECK ((structure_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT group_connection_request_group_a_id_group_b_id_key UNIQUE (group_a_id, group_b_id),
    CONSTRAINT group_connection_request_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_effective_right (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holder_group_id uuid NOT NULL,
    scope_group_id uuid NOT NULL,
    right_key text NOT NULL,
    source_connection_id uuid,
    source_grant_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_effective_right_endpoints_check CHECK ((holder_group_id <> scope_group_id)),
    CONSTRAINT group_effective_right_right_key_check CHECK ((right_key = ANY (ARRAY['informationRight'::text, 'amendmentRight'::text, 'rightToSpeak'::text, 'activeVotingRight'::text, 'passiveVotingRight'::text]))),
    CONSTRAINT group_effective_right_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT group_effective_right_holder_group_id_scope_group_id_right__key UNIQUE (holder_group_id, scope_group_id, right_key, source_connection_id, source_grant_id),
    CONSTRAINT group_effective_right_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_hierarchy_path (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ancestor_group_id uuid NOT NULL,
    descendant_group_id uuid NOT NULL,
    direct_child_group_id uuid,
    base_group_id uuid NOT NULL,
    depth integer NOT NULL,
    path_group_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    connection_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_hierarchy_path_distinct_check CHECK ((ancestor_group_id <> descendant_group_id)),
    CONSTRAINT group_hierarchy_path_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT group_hierarchy_path_ancestor_group_id_descendant_group_id__key UNIQUE (ancestor_group_id, descendant_group_id, base_group_id, path_group_ids),
    CONSTRAINT group_hierarchy_path_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_membership_exclusivity_lock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    hierarchy_group_id uuid NOT NULL,
    source_group_id uuid NOT NULL,
    group_membership_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_membership_exclusivity_lock_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT group_membership_exclusivity_lock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_membership_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    member_source_group_id uuid NOT NULL,
    member_target_group_id uuid NOT NULL,
    membership_mode text NOT NULL,
    required_source_role_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_membership_rule_endpoints_check CHECK ((member_source_group_id <> member_target_group_id)),
    CONSTRAINT group_membership_rule_mode_check CHECK ((membership_mode = ANY (ARRAY['all_members'::text, 'role_members'::text, 'selected_source_groups'::text]))),
    CONSTRAINT group_membership_rule_mode_fields_check CHECK ((((membership_mode = ANY (ARRAY['all_members'::text, 'selected_source_groups'::text])) AND (required_source_role_id IS NULL)) OR ((membership_mode = 'role_members'::text) AND (required_source_role_id IS NOT NULL)))),
    CONSTRAINT group_membership_rule_connection_id_key UNIQUE (connection_id),
    CONSTRAINT group_membership_rule_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_membership_rule_origin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membership_rule_id uuid NOT NULL,
    eligible_origin_group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_membership_rule_origin_membership_rule_id_eligible_or_key UNIQUE (membership_rule_id, eligible_origin_group_id),
    CONSTRAINT group_membership_rule_origin_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_membership_rule_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_request_id uuid NOT NULL,
    existing_membership_rule_id uuid,
    operation text NOT NULL,
    member_source_group_id uuid,
    member_target_group_id uuid,
    membership_mode text,
    required_source_role_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_membership_rule_request_operation_check CHECK ((operation = ANY (ARRAY['upsert'::text, 'remove'::text]))),
    CONSTRAINT group_membership_rule_request_shape_check CHECK ((((operation = 'remove'::text) AND (member_source_group_id IS NULL) AND (member_target_group_id IS NULL) AND (membership_mode IS NULL) AND (required_source_role_id IS NULL)) OR ((operation = 'upsert'::text) AND (member_source_group_id IS NOT NULL) AND (member_target_group_id IS NOT NULL) AND (member_source_group_id <> member_target_group_id) AND (membership_mode = ANY (ARRAY['all_members'::text, 'role_members'::text, 'selected_source_groups'::text])) AND (((membership_mode = ANY (ARRAY['all_members'::text, 'selected_source_groups'::text])) AND (required_source_role_id IS NULL)) OR ((membership_mode = 'role_members'::text) AND (required_source_role_id IS NOT NULL)))))),
    CONSTRAINT group_membership_rule_request_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT group_membership_rule_request_connection_request_id_key UNIQUE (connection_request_id),
    CONSTRAINT group_membership_rule_request_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_membership_rule_request_origin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membership_rule_request_id uuid NOT NULL,
    eligible_origin_group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_membership_rule_request_membership_rule_request_id_el_key UNIQUE (membership_rule_request_id, eligible_origin_group_id),
    CONSTRAINT group_membership_rule_request_origin_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_right_grant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    right_key text NOT NULL,
    holder_group_id uuid NOT NULL,
    scope_group_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    initiator_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_right_grant_endpoints_check CHECK ((holder_group_id <> scope_group_id)),
    CONSTRAINT group_right_grant_connection_id_right_key_holder_group_id_s_key UNIQUE (connection_id, right_key, holder_group_id, scope_group_id),
    CONSTRAINT group_right_grant_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_right_grant_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_request_id uuid NOT NULL,
    existing_grant_id uuid,
    operation text NOT NULL,
    right_key text NOT NULL,
    holder_group_id uuid NOT NULL,
    scope_group_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    initiator_group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_right_grant_request_endpoints_check CHECK ((holder_group_id <> scope_group_id)),
    CONSTRAINT group_right_grant_request_operation_check CHECK ((operation = ANY (ARRAY['upsert'::text, 'remove'::text]))),
    CONSTRAINT group_right_grant_request_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT group_right_grant_request_connection_request_id_right_key_h_key UNIQUE (connection_request_id, right_key, holder_group_id, scope_group_id),
    CONSTRAINT group_right_grant_request_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_sibling_source_lock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sibling_group_id uuid NOT NULL,
    source_group_id uuid NOT NULL,
    group_membership_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_sibling_source_lock_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT group_sibling_source_lock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_workflow (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    start_group_id uuid,
    name text,
    description text,
    is_default_entry boolean DEFAULT false NOT NULL,
    status text,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_workflow_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_workflow_approval (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    group_id uuid NOT NULL,
    requested_by_group_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_workflow_approval_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_workflow_step (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    group_id uuid NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    label text,
    step_kind text DEFAULT 'group_vote'::text NOT NULL,
    selection_mode text DEFAULT 'default_target_workflow'::text NOT NULL,
    merge_strategy text,
    event_rule text,
    auto_task_on_missing_event boolean DEFAULT false NOT NULL,
    target_workflow_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_workflow_step_pkey PRIMARY KEY (id)
);

CREATE TABLE public.subscriber (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscriber_id uuid NOT NULL,
    user_id uuid,
    group_id uuid,
    amendment_id uuid,
    event_id uuid,
    blog_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriber_pkey PRIMARY KEY (id)
);

ALTER TABLE public.follow ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_connection ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_connection_request ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_effective_right ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_hierarchy_path ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership_exclusivity_lock ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership_rule ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership_rule_origin ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership_rule_request ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_membership_rule_request_origin ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_right_grant ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_right_grant_request ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_sibling_source_lock ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_workflow ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_workflow_approval ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_workflow_step ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriber ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_follow_followee ON public.follow USING btree (followee_id);

CREATE INDEX idx_follow_follower ON public.follow USING btree (follower_id);

CREATE INDEX idx_group_connection_child ON public.group_connection USING btree (child_group_id);

CREATE INDEX idx_group_connection_from ON public.group_connection USING btree (from_group_id);

CREATE INDEX idx_group_connection_group_a ON public.group_connection USING btree (group_a_id);

CREATE INDEX idx_group_connection_group_b ON public.group_connection USING btree (group_b_id);

CREATE INDEX idx_group_connection_kind ON public.group_connection USING btree (connection_kind);

CREATE INDEX idx_group_connection_parent ON public.group_connection USING btree (parent_group_id);

CREATE INDEX idx_group_connection_request_active ON public.group_connection_request USING btree (active_connection_id);

CREATE INDEX idx_group_connection_request_group_a ON public.group_connection_request USING btree (group_a_id);

CREATE INDEX idx_group_connection_request_group_b ON public.group_connection_request USING btree (group_b_id);

CREATE INDEX idx_group_connection_request_status ON public.group_connection_request USING btree (status);

CREATE INDEX idx_group_connection_to ON public.group_connection USING btree (to_group_id);

CREATE INDEX idx_group_connection_type ON public.group_connection USING btree (connection_type);

CREATE INDEX idx_group_effective_right_holder ON public.group_effective_right USING btree (holder_group_id, right_key, status);

CREATE INDEX idx_group_effective_right_pair ON public.group_effective_right USING btree (holder_group_id, scope_group_id, right_key, status);

CREATE INDEX idx_group_effective_right_scope ON public.group_effective_right USING btree (scope_group_id, right_key, status);

CREATE INDEX idx_group_hierarchy_path_ancestor ON public.group_hierarchy_path USING btree (ancestor_group_id, status);

CREATE INDEX idx_group_hierarchy_path_base ON public.group_hierarchy_path USING btree (base_group_id, status);

CREATE INDEX idx_group_hierarchy_path_descendant ON public.group_hierarchy_path USING btree (descendant_group_id, status);

CREATE INDEX idx_group_hierarchy_path_direct_child ON public.group_hierarchy_path USING btree (direct_child_group_id);

CREATE INDEX idx_group_membership_exclusivity_hierarchy ON public.group_membership_exclusivity_lock USING btree (hierarchy_group_id, status);

CREATE INDEX idx_group_membership_exclusivity_source ON public.group_membership_exclusivity_lock USING btree (source_group_id, status);

CREATE UNIQUE INDEX idx_group_membership_exclusivity_unique_active ON public.group_membership_exclusivity_lock USING btree (user_id, hierarchy_group_id) WHERE (status = 'active'::text);

CREATE INDEX idx_group_membership_exclusivity_user ON public.group_membership_exclusivity_lock USING btree (user_id, status);

CREATE INDEX idx_group_membership_rule_connection ON public.group_membership_rule USING btree (connection_id);

CREATE INDEX idx_group_membership_rule_mode ON public.group_membership_rule USING btree (membership_mode);

CREATE INDEX idx_group_membership_rule_origin_group ON public.group_membership_rule_origin USING btree (eligible_origin_group_id);

CREATE INDEX idx_group_membership_rule_origin_rule ON public.group_membership_rule_origin USING btree (membership_rule_id);

CREATE INDEX idx_group_membership_rule_request_header ON public.group_membership_rule_request USING btree (connection_request_id);

CREATE INDEX idx_group_membership_rule_request_origin_group ON public.group_membership_rule_request_origin USING btree (eligible_origin_group_id);

CREATE INDEX idx_group_membership_rule_request_origin_request ON public.group_membership_rule_request_origin USING btree (membership_rule_request_id);

CREATE INDEX idx_group_membership_rule_request_status ON public.group_membership_rule_request USING btree (status);

CREATE INDEX idx_group_membership_rule_source ON public.group_membership_rule USING btree (member_source_group_id);

CREATE INDEX idx_group_membership_rule_target ON public.group_membership_rule USING btree (member_target_group_id);

CREATE INDEX idx_group_right_grant_connection ON public.group_right_grant USING btree (connection_id);

CREATE INDEX idx_group_right_grant_holder ON public.group_right_grant USING btree (holder_group_id);

CREATE INDEX idx_group_right_grant_initiator ON public.group_right_grant USING btree (initiator_group_id);

CREATE INDEX idx_group_right_grant_request_header ON public.group_right_grant_request USING btree (connection_request_id);

CREATE INDEX idx_group_right_grant_request_holder ON public.group_right_grant_request USING btree (holder_group_id);

CREATE INDEX idx_group_right_grant_request_status ON public.group_right_grant_request USING btree (status);

CREATE INDEX idx_group_right_grant_scope ON public.group_right_grant USING btree (scope_group_id);

CREATE INDEX idx_group_right_grant_traversal ON public.group_right_grant USING btree (holder_group_id, right_key, status);

CREATE INDEX idx_group_sibling_source_lock_sibling ON public.group_sibling_source_lock USING btree (sibling_group_id, status);

CREATE INDEX idx_group_sibling_source_lock_source ON public.group_sibling_source_lock USING btree (source_group_id, status);

CREATE UNIQUE INDEX idx_group_sibling_source_lock_unique_active ON public.group_sibling_source_lock USING btree (user_id, sibling_group_id) WHERE (status = 'active'::text);

CREATE INDEX idx_group_sibling_source_lock_user ON public.group_sibling_source_lock USING btree (user_id, status);

CREATE INDEX idx_group_workflow_approval_group ON public.group_workflow_approval USING btree (group_id);

CREATE INDEX idx_group_workflow_approval_requested_by ON public.group_workflow_approval USING btree (requested_by_group_id);

CREATE INDEX idx_group_workflow_approval_status ON public.group_workflow_approval USING btree (status);

CREATE UNIQUE INDEX idx_group_workflow_approval_unique ON public.group_workflow_approval USING btree (workflow_id, group_id);

CREATE INDEX idx_group_workflow_approval_workflow ON public.group_workflow_approval USING btree (workflow_id);

CREATE INDEX idx_group_workflow_created_by ON public.group_workflow USING btree (created_by_id);

CREATE UNIQUE INDEX idx_group_workflow_default_entry ON public.group_workflow USING btree (group_id) WHERE (is_default_entry = true);

CREATE INDEX idx_group_workflow_group ON public.group_workflow USING btree (group_id);

CREATE INDEX idx_group_workflow_start_group ON public.group_workflow USING btree (start_group_id);

CREATE INDEX idx_group_workflow_step_group ON public.group_workflow_step USING btree (group_id);

CREATE INDEX idx_group_workflow_step_target_workflow ON public.group_workflow_step USING btree (target_workflow_id);

CREATE INDEX idx_group_workflow_step_workflow ON public.group_workflow_step USING btree (workflow_id);

CREATE INDEX idx_subscriber_group ON public.subscriber USING btree (group_id);

CREATE INDEX idx_subscriber_subscriber ON public.subscriber USING btree (subscriber_id);

CREATE INDEX idx_subscriber_user ON public.subscriber USING btree (user_id);

CREATE INDEX idx_zero_subscriber_amendment_created_id ON public.subscriber USING btree (amendment_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_blog_created_id ON public.subscriber USING btree (blog_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_event_created_id ON public.subscriber USING btree (event_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_group_created_id ON public.subscriber USING btree (group_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_subscriber_created_id ON public.subscriber USING btree (subscriber_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_subscriber_user_created_id ON public.subscriber USING btree (user_id, created_at DESC, id DESC);

CREATE POLICY service_role_all ON public.follow TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_connection TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_connection_request TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_effective_right TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_hierarchy_path TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership_exclusivity_lock TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership_rule TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership_rule_origin TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership_rule_request TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_membership_rule_request_origin TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_right_grant TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_right_grant_request TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_sibling_source_lock TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_workflow TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_workflow_approval TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_workflow_step TO service_role USING (true);

CREATE POLICY service_role_all ON public.subscriber TO service_role USING (true);

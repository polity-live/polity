-- 28_ai.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.ai_change_set (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    run_id uuid NOT NULL,
    tool_call_id text NOT NULL,
    actor_id uuid NOT NULL,
    resource_kind text NOT NULL,
    resource_id uuid NOT NULL,
    branch_id uuid,
    summary text NOT NULL,
    status text NOT NULL,
    before_value jsonb NOT NULL,
    after_value jsonb NOT NULL,
    proposal_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at bigint NOT NULL,
    undone_at bigint,
    CONSTRAINT ai_change_set_resource_kind_check CHECK ((resource_kind = ANY (ARRAY['studio'::text, 'amendment_text'::text, 'city_design'::text]))),
    CONSTRAINT ai_change_set_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'applied'::text, 'undone'::text]))),
    CONSTRAINT ai_change_set_pkey PRIMARY KEY (id),
    CONSTRAINT ai_change_set_run_id_tool_call_id_key UNIQUE (run_id, tool_call_id)
);

CREATE TABLE public.ai_context_snapshot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    resource_kind text NOT NULL,
    resource_id uuid NOT NULL,
    branch_id uuid,
    revision text NOT NULL,
    value jsonb NOT NULL,
    references_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT ai_context_snapshot_resource_kind_check CHECK ((resource_kind = ANY (ARRAY['studio'::text, 'amendment_text'::text, 'city_design'::text]))),
    CONSTRAINT ai_context_snapshot_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_provider_credential (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    encrypted_key text NOT NULL,
    key_hint text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    CONSTRAINT ai_provider_credential_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    request_id uuid NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    model jsonb DEFAULT '{}'::jsonb NOT NULL,
    editor_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    configuration jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_hash text NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    step integer DEFAULT 0 NOT NULL,
    lease_token uuid NOT NULL,
    lease_expires_at bigint NOT NULL,
    partial_text text DEFAULT ''::text NOT NULL,
    streaming_text text DEFAULT ''::text NOT NULL,
    error_code text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT ai_run_status_check CHECK ((status = ANY (ARRAY['running'::text, 'interrupted'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT ai_run_step_check CHECK ((step >= 0)),
    CONSTRAINT ai_run_conversation_id_request_id_key UNIQUE (conversation_id, request_id),
    CONSTRAINT ai_run_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_skill (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    aliases text DEFAULT ''::text NOT NULL,
    system_prompt text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_skill_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_tool (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tool_name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_tool_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_tool_call (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    tool_call_id text NOT NULL,
    tool_name text NOT NULL,
    input_hash text NOT NULL,
    input jsonb NOT NULL,
    result jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT ai_tool_call_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'failed'::text, 'completed'::text]))),
    CONSTRAINT ai_tool_call_pkey PRIMARY KEY (id),
    CONSTRAINT ai_tool_call_run_id_tool_call_id_key UNIQUE (run_id, tool_call_id)
);

ALTER TABLE public.ai_change_set ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_context_snapshot ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_provider_credential ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_run ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_skill ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_tool ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_tool_call ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.project_content_revision() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.content_revision := OLD.content_revision + 1;
  RETURN NEW;
END;
$$;

CREATE INDEX idx_ai_change_set_actor ON public.ai_change_set USING btree (actor_id);

CREATE INDEX idx_ai_change_set_conversation_created ON public.ai_change_set USING btree (conversation_id, created_at DESC, id DESC);

CREATE INDEX idx_ai_change_set_resource ON public.ai_change_set USING btree (resource_kind, resource_id, branch_id);

CREATE INDEX idx_ai_context_snapshot_run_created ON public.ai_context_snapshot USING btree (run_id, created_at DESC, id DESC);

CREATE INDEX idx_ai_provider_credential_user ON public.ai_provider_credential USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_provider_credential_user_provider ON public.ai_provider_credential USING btree (user_id, provider);

CREATE INDEX idx_ai_run_active_lease ON public.ai_run USING btree (lease_expires_at) WHERE (status = 'running'::text);

CREATE INDEX idx_ai_run_actor ON public.ai_run USING btree (actor_id);

CREATE INDEX idx_ai_run_conversation_created ON public.ai_run USING btree (conversation_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX idx_ai_run_one_active_per_conversation ON public.ai_run USING btree (conversation_id) WHERE (status = 'running'::text);

CREATE INDEX idx_ai_skill_user ON public.ai_skill USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_skill_user_slug ON public.ai_skill USING btree (user_id, slug);

CREATE INDEX idx_ai_tool_call_run_status_created ON public.ai_tool_call USING btree (run_id, status, created_at, id);

CREATE INDEX idx_ai_tool_user ON public.ai_tool USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_tool_user_name ON public.ai_tool USING btree (user_id, tool_name);

CREATE POLICY service_role_all ON public.ai_change_set TO service_role USING (true);

CREATE POLICY service_role_all ON public.ai_context_snapshot TO service_role USING (true);

CREATE POLICY service_role_all ON public.ai_provider_credential TO service_role USING (true);

CREATE POLICY service_role_all ON public.ai_run TO service_role USING (true);

CREATE POLICY service_role_all ON public.ai_skill TO service_role USING (true);

CREATE POLICY service_role_all ON public.ai_tool TO service_role USING (true);

CREATE POLICY service_role_all ON public.ai_tool_call TO service_role USING (true);

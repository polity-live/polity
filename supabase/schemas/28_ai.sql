-- =============================================================================
-- 28_ai.sql — AI skills and secure provider credentials
-- =============================================================================

CREATE TABLE public.ai_skill (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ai_skill_user_slug
  ON public.ai_skill (user_id, slug);
CREATE INDEX idx_ai_skill_user
  ON public.ai_skill (user_id);

ALTER TABLE public.ai_skill ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_skill FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.ai_skill TO service_role;

CREATE TABLE public.ai_tool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ai_tool_user_name
  ON public.ai_tool (user_id, tool_name);
CREATE INDEX idx_ai_tool_user
  ON public.ai_tool (user_id);

ALTER TABLE public.ai_tool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_tool FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.ai_tool TO service_role;

CREATE TABLE public.ai_provider_credential (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_ai_provider_credential_user_provider
  ON public.ai_provider_credential (user_id, provider);
CREATE INDEX idx_ai_provider_credential_user
  ON public.ai_provider_credential (user_id);

ALTER TABLE public.ai_provider_credential ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_provider_credential FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.ai_provider_credential TO service_role;

-- Project-chat execution state. Runs and change-set summaries are replicated by
-- Zero, while provider messages, resolved configuration, tool inputs/results,
-- snapshots and inverse values remain server-only columns/tables.
CREATE TABLE public.ai_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversation (id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'interrupted', 'completed', 'cancelled')),
  model JSONB NOT NULL DEFAULT '{}'::jsonb,
  editor_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_hash TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  step INTEGER NOT NULL DEFAULT 0 CHECK (step >= 0),
  lease_token UUID NOT NULL,
  lease_expires_at BIGINT NOT NULL,
  partial_text TEXT NOT NULL DEFAULT '',
  streaming_text TEXT NOT NULL DEFAULT '',
  error_code TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (conversation_id, request_id)
);

CREATE INDEX idx_ai_run_conversation_created
  ON public.ai_run (conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_ai_run_actor
  ON public.ai_run (actor_id);
CREATE INDEX idx_ai_run_active_lease
  ON public.ai_run (lease_expires_at)
  WHERE status = 'running';
CREATE UNIQUE INDEX idx_ai_run_one_active_per_conversation
  ON public.ai_run (conversation_id)
  WHERE status = 'running';

ALTER TABLE public.ai_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_run FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.ai_run TO service_role;

CREATE TABLE public.ai_tool_call (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ai_run (id) ON DELETE CASCADE,
  tool_call_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  input JSONB NOT NULL,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'failed', 'completed')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (run_id, tool_call_id)
);

CREATE INDEX idx_ai_tool_call_run_status_created
  ON public.ai_tool_call (run_id, status, created_at, id);

ALTER TABLE public.ai_tool_call ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_tool_call FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.ai_tool_call TO service_role;

CREATE TABLE public.ai_context_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ai_run (id) ON DELETE CASCADE,
  resource_kind TEXT NOT NULL
    CHECK (resource_kind IN ('studio', 'amendment_text', 'city_design')),
  resource_id UUID NOT NULL,
  branch_id UUID,
  revision TEXT NOT NULL,
  value JSONB NOT NULL,
  references_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_ai_context_snapshot_run_created
  ON public.ai_context_snapshot (run_id, created_at DESC, id DESC);

ALTER TABLE public.ai_context_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_context_snapshot FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.ai_context_snapshot TO service_role;

CREATE TABLE public.ai_change_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversation (id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.ai_run (id) ON DELETE CASCADE,
  tool_call_id TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  resource_kind TEXT NOT NULL
    CHECK (resource_kind IN ('studio', 'amendment_text', 'city_design')),
  resource_id UUID NOT NULL,
  branch_id UUID,
  summary TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('proposed', 'applied', 'undone')),
  before_value JSONB NOT NULL,
  after_value JSONB NOT NULL,
  proposal_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  undone_at BIGINT,
  UNIQUE (run_id, tool_call_id)
);

CREATE INDEX idx_ai_change_set_conversation_created
  ON public.ai_change_set (conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_ai_change_set_actor
  ON public.ai_change_set (actor_id);
CREATE INDEX idx_ai_change_set_resource
  ON public.ai_change_set (resource_kind, resource_id, branch_id);

ALTER TABLE public.ai_change_set ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_change_set FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.ai_change_set TO service_role;

-- Revision fencing must also cover writes that do not pass through a Zero
-- mutator (imports, service jobs and administrative SQL).
CREATE FUNCTION public.project_content_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.content_revision := OLD.content_revision + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER document_content_revision
  BEFORE UPDATE OF content ON public.document
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION public.project_content_revision();

CREATE TRIGGER amendment_city_design_content_revision
  BEFORE UPDATE OF design_state ON public.amendment_city_design
  FOR EACH ROW
  WHEN (OLD.design_state IS DISTINCT FROM NEW.design_state)
  EXECUTE FUNCTION public.project_content_revision();

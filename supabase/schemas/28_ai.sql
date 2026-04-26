-- =============================================================================
-- 28_ai.sql — AI skills and secure provider credentials
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_skill (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_skill_user_slug
  ON public.ai_skill (user_id, slug);
CREATE INDEX IF NOT EXISTS idx_ai_skill_user
  ON public.ai_skill (user_id);

ALTER TABLE public.ai_skill ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_skill FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.ai_provider_credential (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_provider_credential_user_provider
  ON public.ai_provider_credential (user_id, provider);
CREATE INDEX IF NOT EXISTS idx_ai_provider_credential_user
  ON public.ai_provider_credential (user_id);

ALTER TABLE public.ai_provider_credential ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ai_provider_credential FOR ALL TO service_role USING (true);
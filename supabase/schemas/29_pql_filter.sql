-- =============================================================================
-- 29_pql_filter.sql — Persisted personal and group-scoped PQL filters
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pql_filter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  label TEXT NOT NULL,
  query TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pql_filter_user_scope
  ON public.pql_filter (user_id, storage_key, group_id);

CREATE INDEX idx_pql_filter_active_scope
  ON public.pql_filter (user_id, storage_key, group_id, is_active);

ALTER TABLE public.pql_filter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.pql_filter FOR ALL TO service_role USING (true);
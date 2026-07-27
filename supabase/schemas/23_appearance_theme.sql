-- =============================================================================
-- 23_appearance_theme.sql — dynamic builtin and group appearance themes
-- =============================================================================

CREATE TABLE public.appearance_theme (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('builtin', 'group')),
  group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  current_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appearance_theme_scope_check CHECK (
    (kind = 'builtin' AND group_id IS NULL)
    OR (kind = 'group' AND group_id IS NOT NULL)
  ),
  CONSTRAINT appearance_theme_group_slug_unique UNIQUE NULLS NOT DISTINCT (group_id, slug)
);

CREATE INDEX idx_appearance_theme_group
  ON public.appearance_theme (group_id, updated_at DESC);
CREATE INDEX idx_appearance_theme_kind
  ON public.appearance_theme (kind, slug);

CREATE TABLE public.appearance_theme_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID NOT NULL REFERENCES public.appearance_theme (id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  light_palette JSONB NOT NULL,
  dark_palette JSONB NOT NULL,
  fonts JSONB NOT NULL,
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE (theme_id, version)
);

CREATE UNIQUE INDEX idx_appearance_theme_one_draft
  ON public.appearance_theme_revision (theme_id)
  WHERE status = 'draft';
CREATE INDEX idx_appearance_theme_revision_theme_status
  ON public.appearance_theme_revision (theme_id, status, version DESC);

ALTER TABLE public.appearance_theme
  ADD CONSTRAINT appearance_theme_current_revision_fkey
  FOREIGN KEY (current_revision_id)
  REFERENCES public.appearance_theme_revision (id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.appearance_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appearance_theme_revision ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.appearance_theme
  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.appearance_theme_revision
  FOR ALL TO service_role USING (true);

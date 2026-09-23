-- Studio V4 themes and linked element libraries. V3 rows remain untouched and hidden.
ALTER TABLE public.studio_project
  ALTER COLUMN document_schema_version SET DEFAULT 4;
ALTER TABLE public.studio_project
  DROP CONSTRAINT IF EXISTS studio_project_document_schema_version_check;
ALTER TABLE public.studio_project
  ADD CONSTRAINT studio_project_document_schema_version_check
  CHECK (document_schema_version IN (2, 3, 4));

ALTER TABLE public.appearance_theme_revision
  ADD COLUMN IF NOT EXISTS text_styles JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.appearance_theme
  DROP CONSTRAINT IF EXISTS appearance_theme_kind_check;
ALTER TABLE public.appearance_theme
  ADD CONSTRAINT appearance_theme_kind_check
  CHECK (kind IN ('builtin', 'personal', 'group'));
ALTER TABLE public.appearance_theme
  DROP CONSTRAINT IF EXISTS appearance_theme_scope_check;
ALTER TABLE public.appearance_theme
  ADD CONSTRAINT appearance_theme_scope_check CHECK (
    (kind = 'builtin' AND group_id IS NULL)
    OR (kind = 'personal' AND group_id IS NULL AND created_by_id IS NOT NULL)
    OR (kind = 'group' AND group_id IS NOT NULL)
  );

CREATE TABLE public.studio_element_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public."user" (id) ON DELETE CASCADE,
  group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  current_revision_id UUID,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT studio_element_set_scope_check CHECK (
    (owner_id IS NOT NULL AND group_id IS NULL)
    OR (owner_id IS NULL AND group_id IS NOT NULL)
  )
);

CREATE TABLE public.studio_element_set_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES public.studio_element_set (id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL,
  width DOUBLE PRECISION NOT NULL CHECK (width > 0),
  height DOUBLE PRECISION NOT NULL CHECK (height > 0),
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (set_id, version)
);

ALTER TABLE public.studio_element_set
  ADD CONSTRAINT studio_element_set_current_revision_fkey
  FOREIGN KEY (current_revision_id)
  REFERENCES public.studio_element_set_revision (id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.studio_element_set_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES public.studio_element_set_revision (id) ON DELETE CASCADE,
  source_asset_id UUID NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','video/mp4')),
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  storage_path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (revision_id, source_asset_id)
);

CREATE INDEX studio_element_set_owner_active
  ON public.studio_element_set(owner_id, updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX studio_element_set_group_active
  ON public.studio_element_set(group_id, updated_at DESC) WHERE archived_at IS NULL;

ALTER TABLE public.studio_element_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_element_set_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_element_set_asset ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.studio_element_set FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.studio_element_set_revision FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.studio_element_set_asset FOR ALL TO service_role USING (true);

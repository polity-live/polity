-- =============================================================================
-- 30_datasets.sql - Dataset metadata and external snapshot storage references
-- =============================================================================

CREATE TABLE public.dataset (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL
    CHECK (provider IN ('EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD')),
  provider_dataset_id TEXT,
  provider_resource_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  license TEXT,
  publisher TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  source_url TEXT,
  structure_summary TEXT,
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  spatial_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'authenticated', 'private')),
  owner_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'error')),
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dataset_provider_code
  ON public.dataset (provider, provider_dataset_id);
CREATE INDEX idx_dataset_group
  ON public.dataset (group_id, updated_at DESC);
CREATE INDEX idx_dataset_owner
  ON public.dataset (owner_user_id, updated_at DESC);
CREATE INDEX idx_dataset_status
  ON public.dataset (status);
CREATE INDEX idx_dataset_title_trgm
  ON public.dataset USING GIN (title gin_trgm_ops);
CREATE INDEX idx_dataset_description_trgm
  ON public.dataset USING GIN (description gin_trgm_ops);
CREATE INDEX idx_dataset_metadata_gin
  ON public.dataset USING GIN (metadata jsonb_path_ops);

CREATE UNIQUE INDEX idx_dataset_provider_identity
  ON public.dataset (
    provider,
    coalesce(provider_dataset_id, ''),
    coalesce(provider_resource_id, ''),
    coalesce(group_id::text, '')
  );

CREATE TABLE public.dataset_snapshot (
  id UUID PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES public.dataset (id) ON DELETE CASCADE,
  snapshot_key TEXT NOT NULL UNIQUE,
  storage_bucket TEXT NOT NULL DEFAULT 'dataset-snapshots',
  storage_path TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv',
  content_hash TEXT NOT NULL,
  byte_size BIGINT NOT NULL DEFAULT 0,
  row_count BIGINT NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'blocked', 'error')),
  snapshot_taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dataset_snapshot_dataset_created
  ON public.dataset_snapshot (dataset_id, snapshot_taken_at DESC);
CREATE INDEX idx_dataset_snapshot_status
  ON public.dataset_snapshot (status);
CREATE INDEX idx_dataset_snapshot_hash
  ON public.dataset_snapshot (content_hash);

CREATE TABLE public.dataset_import_job (
  id UUID PRIMARY KEY,
  dataset_id UUID REFERENCES public.dataset (id) ON DELETE CASCADE,
  provider TEXT NOT NULL
    CHECK (provider IN ('EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'blocked', 'error')),
  requested_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot_id UUID REFERENCES public.dataset_snapshot (id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dataset_import_job_dataset
  ON public.dataset_import_job (dataset_id, created_at DESC);
CREATE INDEX idx_dataset_import_job_status
  ON public.dataset_import_job (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_dataset_from_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target_dataset_id UUID;
BEGIN
  target_dataset_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.dataset_id ELSE NEW.dataset_id END;

  UPDATE public.dataset
  SET
    columns = CASE
      WHEN TG_OP = 'DELETE' THEN columns
      ELSE NEW.columns
    END,
    column_profiles = CASE
      WHEN TG_OP = 'DELETE' THEN column_profiles
      ELSE NEW.column_profiles
    END,
    updated_at = now()
  WHERE id = target_dataset_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dataset_snapshot_touch_dataset
AFTER INSERT OR UPDATE OR DELETE ON public.dataset_snapshot
FOR EACH ROW EXECUTE FUNCTION public.touch_dataset_from_snapshot();

CREATE TRIGGER trg_search_document_dataset
AFTER INSERT OR UPDATE OR DELETE ON public.dataset
FOR EACH ROW EXECUTE FUNCTION public.upsert_dataset_search_document();

CREATE TRIGGER trg_zz_search_document_dataset_archive
AFTER INSERT OR UPDATE ON public.dataset
FOR EACH ROW EXECUTE FUNCTION public.delete_inactive_dataset_search_document();

CREATE TRIGGER trg_zz_search_document_acl_dataset
AFTER INSERT OR UPDATE ON public.dataset
FOR EACH ROW EXECUTE FUNCTION public.sync_search_document_acl_entity_trigger();

ALTER TABLE public.dataset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_import_job ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.dataset
  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.dataset_snapshot
  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.dataset_import_job
  FOR ALL TO service_role USING (true);

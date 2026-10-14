-- 30_datasets.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.dataset (
    id uuid NOT NULL,
    provider text NOT NULL,
    provider_dataset_id text,
    provider_resource_id text,
    title text NOT NULL,
    description text,
    license text,
    publisher text,
    language text DEFAULT 'en'::text NOT NULL,
    source_url text,
    structure_summary text,
    dimensions jsonb DEFAULT '[]'::jsonb NOT NULL,
    columns jsonb DEFAULT '[]'::jsonb NOT NULL,
    column_profiles jsonb DEFAULT '[]'::jsonb NOT NULL,
    time_coverage jsonb DEFAULT '{}'::jsonb NOT NULL,
    spatial_coverage jsonb DEFAULT '{}'::jsonb NOT NULL,
    topics jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    visibility text DEFAULT 'public'::text NOT NULL,
    owner_user_id uuid,
    group_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dataset_provider_check CHECK ((provider = ANY (ARRAY['EUROSTAT'::text, 'GENESIS_DESTATIS'::text, 'GOVDATA'::text, 'UPLOAD'::text]))),
    CONSTRAINT dataset_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'error'::text]))),
    CONSTRAINT dataset_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'private'::text]))),
    CONSTRAINT dataset_pkey PRIMARY KEY (id)
);

CREATE TABLE public.dataset_import_job (
    id uuid NOT NULL,
    dataset_id uuid,
    provider text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by_id uuid,
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result_snapshot_id uuid,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dataset_import_job_provider_check CHECK ((provider = ANY (ARRAY['EUROSTAT'::text, 'GENESIS_DESTATIS'::text, 'GOVDATA'::text, 'UPLOAD'::text]))),
    CONSTRAINT dataset_import_job_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'blocked'::text, 'error'::text]))),
    CONSTRAINT dataset_import_job_pkey PRIMARY KEY (id)
);

CREATE TABLE public.dataset_snapshot (
    id uuid NOT NULL,
    dataset_id uuid NOT NULL,
    snapshot_key text NOT NULL,
    storage_bucket text DEFAULT 'dataset-snapshots'::text NOT NULL,
    storage_path text NOT NULL,
    format text DEFAULT 'csv'::text NOT NULL,
    content_hash text NOT NULL,
    byte_size bigint DEFAULT 0 NOT NULL,
    row_count bigint DEFAULT 0 NOT NULL,
    column_count integer DEFAULT 0 NOT NULL,
    columns jsonb DEFAULT '[]'::jsonb NOT NULL,
    column_profiles jsonb DEFAULT '[]'::jsonb NOT NULL,
    dimensions jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    snapshot_taken_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_id uuid,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dataset_snapshot_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'blocked'::text, 'error'::text]))),
    CONSTRAINT dataset_snapshot_pkey PRIMARY KEY (id),
    CONSTRAINT dataset_snapshot_snapshot_key_key UNIQUE (snapshot_key)
);

ALTER TABLE public.dataset ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dataset_import_job ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dataset_snapshot ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.touch_dataset_from_snapshot() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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

CREATE INDEX idx_dataset_description_trgm ON public.dataset USING gin (description public.gin_trgm_ops);

CREATE INDEX idx_dataset_group ON public.dataset USING btree (group_id, updated_at DESC);

CREATE INDEX idx_dataset_import_job_dataset ON public.dataset_import_job USING btree (dataset_id, created_at DESC);

CREATE INDEX idx_dataset_import_job_status ON public.dataset_import_job USING btree (status, created_at DESC);

CREATE INDEX idx_dataset_metadata_gin ON public.dataset USING gin (metadata jsonb_path_ops);

CREATE INDEX idx_dataset_owner ON public.dataset USING btree (owner_user_id, updated_at DESC);

CREATE INDEX idx_dataset_provider_code ON public.dataset USING btree (provider, provider_dataset_id);

CREATE UNIQUE INDEX idx_dataset_provider_identity ON public.dataset USING btree (provider, COALESCE(provider_dataset_id, ''::text), COALESCE(provider_resource_id, ''::text), COALESCE((group_id)::text, ''::text));

CREATE INDEX idx_dataset_snapshot_dataset_created ON public.dataset_snapshot USING btree (dataset_id, snapshot_taken_at DESC);

CREATE INDEX idx_dataset_snapshot_hash ON public.dataset_snapshot USING btree (content_hash);

CREATE INDEX idx_dataset_snapshot_status ON public.dataset_snapshot USING btree (status);

CREATE INDEX idx_dataset_status ON public.dataset USING btree (status);

CREATE INDEX idx_dataset_title_trgm ON public.dataset USING gin (title public.gin_trgm_ops);

CREATE POLICY service_role_all ON public.dataset TO service_role USING (true);

CREATE POLICY service_role_all ON public.dataset_import_job TO service_role USING (true);

CREATE POLICY service_role_all ON public.dataset_snapshot TO service_role USING (true);

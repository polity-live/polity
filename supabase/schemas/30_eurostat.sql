-- =============================================================================
-- 30_eurostat.sql - Public Eurostat snapshots and chart projections
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.eurostat_dataset (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  snapshot_key TEXT NOT NULL UNIQUE,
  source_last_update TEXT,
  structure_last_change TEXT,
  data_start TEXT,
  data_end TEXT,
  source_value_count BIGINT NOT NULL DEFAULT 0,
  observation_count BIGINT NOT NULL DEFAULT 0,
  estimated_bytes BIGINT NOT NULL DEFAULT 0,
  actual_bytes BIGINT NOT NULL DEFAULT 0,
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'importing', 'ready', 'blocked', 'error')),
  partition_count INTEGER NOT NULL DEFAULT 0,
  completed_partitions INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eurostat_dataset_code_update
  ON public.eurostat_dataset (code, source_last_update DESC);
CREATE INDEX IF NOT EXISTS idx_eurostat_dataset_status
  ON public.eurostat_dataset (status);

CREATE TABLE IF NOT EXISTS public.eurostat_observation (
  id TEXT PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES public.eurostat_dataset (id) ON DELETE CASCADE,
  observation_key TEXT NOT NULL,
  time_period TEXT,
  value DOUBLE PRECISION NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, observation_key)
);

CREATE INDEX IF NOT EXISTS idx_eurostat_observation_dataset_sort
  ON public.eurostat_observation (dataset_id, sort_key);
CREATE INDEX IF NOT EXISTS idx_eurostat_observation_dataset_time
  ON public.eurostat_observation (dataset_id, time_period);
CREATE INDEX IF NOT EXISTS idx_eurostat_observation_dimensions_gin
  ON public.eurostat_observation USING GIN (dimensions jsonb_path_ops);

CREATE TABLE IF NOT EXISTS public.chart_projection (
  id TEXT PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES public.eurostat_dataset (id) ON DELETE CASCADE,
  config_hash TEXT NOT NULL UNIQUE,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  x_dimension TEXT NOT NULL,
  series_dimension TEXT,
  value_field TEXT NOT NULL DEFAULT 'OBS_VALUE',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'error')),
  point_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chart_projection_dataset
  ON public.chart_projection (dataset_id);

CREATE TABLE IF NOT EXISTS public.chart_projection_point (
  id TEXT PRIMARY KEY,
  projection_id TEXT NOT NULL REFERENCES public.chart_projection (id) ON DELETE CASCADE,
  x_value TEXT NOT NULL,
  series_value TEXT,
  value DOUBLE PRECISION NOT NULL,
  sort_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (projection_id, x_value, series_value)
);

CREATE INDEX IF NOT EXISTS idx_chart_projection_point_projection_sort
  ON public.chart_projection_point (projection_id, sort_index);

-- Server-only import checkpoints. This table is deliberately not in the Zero schema.
CREATE TABLE IF NOT EXISTS public.eurostat_import_partition (
  id TEXT PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES public.eurostat_dataset (id) ON DELETE CASCADE,
  partition_index INTEGER NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cells INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'available', 'complete', 'error')),
  async_request_id TEXT,
  observation_count INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, partition_index)
);

CREATE INDEX IF NOT EXISTS idx_eurostat_import_partition_next
  ON public.eurostat_import_partition (dataset_id, status, partition_index);

ALTER TABLE public.eurostat_dataset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eurostat_observation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_projection_point ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eurostat_import_partition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.eurostat_dataset
  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.eurostat_observation
  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.chart_projection
  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.chart_projection_point
  FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.eurostat_import_partition
  FOR ALL TO service_role USING (true);


-- 49_studio_zero.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_operation (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    input_hash text NOT NULL,
    changes jsonb NOT NULL,
    result jsonb NOT NULL,
    created_at bigint NOT NULL,
    CONSTRAINT studio_operation_pkey PRIMARY KEY (id)
);

CREATE TABLE public.studio_reset_storage_manifest (
    bucket_id text NOT NULL,
    storage_path text NOT NULL,
    removed_at bigint,
    CONSTRAINT studio_reset_storage_manifest_pkey PRIMARY KEY (bucket_id, storage_path)
);

ALTER TABLE public.studio_operation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_reset_storage_manifest ENABLE ROW LEVEL SECURITY;

CREATE INDEX studio_operation_project ON public.studio_operation USING btree (project_id, created_at);

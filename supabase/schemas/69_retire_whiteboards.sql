-- 69_retire_whiteboards.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_whiteboard_storage_manifest (
    bucket_id text DEFAULT 'studio'::text NOT NULL,
    storage_path text NOT NULL,
    removed_at bigint,
    CONSTRAINT studio_whiteboard_storage_manifest_pkey PRIMARY KEY (bucket_id, storage_path)
);

ALTER TABLE public.studio_whiteboard_storage_manifest ENABLE ROW LEVEL SECURITY;

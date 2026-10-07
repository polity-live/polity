CREATE TABLE public.studio_whiteboard_storage_manifest (
  bucket_id text NOT NULL DEFAULT 'studio',
  storage_path text NOT NULL,
  removed_at bigint,
  PRIMARY KEY (bucket_id, storage_path)
);
ALTER TABLE public.studio_whiteboard_storage_manifest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_whiteboard_storage_manifest FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_whiteboard_storage_manifest TO service_role;
ALTER TABLE public.studio_project DROP CONSTRAINT studio_project_kind_check;
ALTER TABLE public.studio_project ADD CONSTRAINT studio_project_kind_check
  CHECK (kind IN ('single','event','carousel','story','video','campaign'));

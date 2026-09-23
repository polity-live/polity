-- Studio V4 is intentionally not backwards compatible. Existing V2/V3 rows stay
-- stored, but every user-facing/query path filters them out.
ALTER TABLE public.studio_project
  ADD COLUMN document_schema_version integer NOT NULL DEFAULT 2;

ALTER TABLE public.studio_project
  ALTER COLUMN document_schema_version SET DEFAULT 4;

ALTER TABLE public.studio_project
  ADD CONSTRAINT studio_project_document_schema_version_check
  CHECK (document_schema_version IN (2, 3, 4));

CREATE INDEX studio_project_v4_group
  ON public.studio_project(document_schema_version, group_id, updated_at DESC);

COMMENT ON COLUMN public.studio_project.document_schema_version IS
  'Persisted Studio document schema. Only schema 4 is exposed by the current Studio.';

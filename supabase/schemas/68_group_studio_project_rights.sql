-- 68_group_studio_project_rights.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_published_media_archive (
    id uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    CONSTRAINT studio_published_media_archive_pkey PRIMARY KEY (id)
);

ALTER TABLE public.studio_published_media_archive ENABLE ROW LEVEL SECURITY;

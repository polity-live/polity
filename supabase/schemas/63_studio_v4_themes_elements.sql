-- 63_studio_v4_themes_elements.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_element_set (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    group_id uuid,
    name text NOT NULL,
    current_revision_id uuid,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_element_set_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120))),
    CONSTRAINT studio_element_set_scope_check CHECK ((((owner_id IS NOT NULL) AND (group_id IS NULL)) OR ((owner_id IS NULL) AND (group_id IS NOT NULL)))),
    CONSTRAINT studio_element_set_pkey PRIMARY KEY (id)
);

CREATE TABLE public.studio_element_set_asset (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    revision_id uuid NOT NULL,
    source_asset_id uuid NOT NULL,
    name text NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_element_set_asset_byte_size_check CHECK ((byte_size > 0)),
    CONSTRAINT studio_element_set_asset_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/webp'::text, 'video/mp4'::text]))),
    CONSTRAINT studio_element_set_asset_pkey PRIMARY KEY (id),
    CONSTRAINT studio_element_set_asset_revision_id_source_asset_id_key UNIQUE (revision_id, source_asset_id),
    CONSTRAINT studio_element_set_asset_storage_path_key UNIQUE (storage_path)
);

CREATE TABLE public.studio_element_set_revision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    set_id uuid NOT NULL,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    width double precision NOT NULL,
    height double precision NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_element_set_revision_height_check CHECK ((height > (0)::double precision)),
    CONSTRAINT studio_element_set_revision_version_check CHECK ((version > 0)),
    CONSTRAINT studio_element_set_revision_width_check CHECK ((width > (0)::double precision)),
    CONSTRAINT studio_element_set_revision_pkey PRIMARY KEY (id),
    CONSTRAINT studio_element_set_revision_set_id_version_key UNIQUE (set_id, version)
);

ALTER TABLE public.studio_element_set ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_element_set_asset ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_element_set_revision ENABLE ROW LEVEL SECURITY;

CREATE INDEX studio_element_set_group_active ON public.studio_element_set USING btree (group_id, updated_at DESC) WHERE (archived_at IS NULL);

CREATE INDEX studio_element_set_owner_active ON public.studio_element_set USING btree (owner_id, updated_at DESC) WHERE (archived_at IS NULL);

CREATE POLICY service_role_all ON public.studio_element_set TO service_role USING (true);

CREATE POLICY service_role_all ON public.studio_element_set_asset TO service_role USING (true);

CREATE POLICY service_role_all ON public.studio_element_set_revision TO service_role USING (true);

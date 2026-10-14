-- 23_appearance_theme.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.appearance_theme (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    kind text NOT NULL,
    group_id uuid,
    created_by_id uuid,
    current_revision_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT appearance_theme_kind_check CHECK ((kind = ANY (ARRAY['builtin'::text, 'personal'::text, 'group'::text]))),
    CONSTRAINT appearance_theme_scope_check CHECK ((((kind = 'builtin'::text) AND (group_id IS NULL)) OR ((kind = 'personal'::text) AND (group_id IS NULL) AND (created_by_id IS NOT NULL)) OR ((kind = 'group'::text) AND (group_id IS NOT NULL)))),
    CONSTRAINT appearance_theme_group_slug_unique UNIQUE NULLS NOT DISTINCT (group_id, slug),
    CONSTRAINT appearance_theme_pkey PRIMARY KEY (id)
);

CREATE TABLE public.appearance_theme_revision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    theme_id uuid NOT NULL,
    version integer NOT NULL,
    status text NOT NULL,
    light_palette jsonb NOT NULL,
    dark_palette jsonb NOT NULL,
    fonts jsonb NOT NULL,
    text_styles jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT appearance_theme_revision_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))),
    CONSTRAINT appearance_theme_revision_version_check CHECK ((version > 0)),
    CONSTRAINT appearance_theme_revision_pkey PRIMARY KEY (id),
    CONSTRAINT appearance_theme_revision_theme_id_version_key UNIQUE (theme_id, version)
);

ALTER TABLE public.appearance_theme ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.appearance_theme_revision ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_appearance_theme_group ON public.appearance_theme USING btree (group_id, updated_at DESC);

CREATE INDEX idx_appearance_theme_kind ON public.appearance_theme USING btree (kind, slug);

CREATE UNIQUE INDEX idx_appearance_theme_one_draft ON public.appearance_theme_revision USING btree (theme_id) WHERE (status = 'draft'::text);

CREATE INDEX idx_appearance_theme_revision_theme_status ON public.appearance_theme_revision USING btree (theme_id, status, version DESC);

CREATE POLICY service_role_all ON public.appearance_theme TO service_role USING (true);

CREATE POLICY service_role_all ON public.appearance_theme_revision TO service_role USING (true);

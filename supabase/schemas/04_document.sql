-- 04_document.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid,
    content jsonb,
    content_revision integer DEFAULT 0 NOT NULL,
    editing_mode text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_content_revision_check CHECK ((content_revision >= 0)),
    CONSTRAINT document_pkey PRIMARY KEY (id)
);

CREATE TABLE public.document_collaborator (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid,
    status text,
    visibility text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_collaborator_pkey PRIMARY KEY (id)
);

CREATE TABLE public.document_cursor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    "position" jsonb,
    selection jsonb,
    color text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_cursor_pkey PRIMARY KEY (id)
);

CREATE TABLE public.document_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    amendment_id uuid,
    blog_id uuid,
    content jsonb,
    version_number integer,
    change_summary text,
    author_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    collaboration_revision_id uuid,
    CONSTRAINT document_version_pkey PRIMARY KEY (id)
);

ALTER TABLE public.document ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.document_collaborator ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.document_cursor ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.document_version ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_document_amendment ON public.document USING btree (amendment_id);

CREATE INDEX idx_document_collaborator_document ON public.document_collaborator USING btree (document_id);

CREATE INDEX idx_document_collaborator_user ON public.document_collaborator USING btree (user_id);

CREATE INDEX idx_document_cursor_document ON public.document_cursor USING btree (document_id);

CREATE INDEX idx_document_version_author ON public.document_version USING btree (author_id);

CREATE INDEX idx_document_version_document ON public.document_version USING btree (document_id);

CREATE INDEX idx_zero_document_amendment_updated_id ON public.document USING btree (amendment_id, updated_at DESC, id DESC);

CREATE INDEX idx_zero_document_collaborator_document_created_id ON public.document_collaborator USING btree (document_id, created_at DESC, id DESC);

CREATE INDEX idx_zero_document_collaborator_user_document ON public.document_collaborator USING btree (user_id, document_id);

CREATE INDEX idx_zero_document_version_document_number_id ON public.document_version USING btree (document_id, version_number DESC, id DESC);

CREATE POLICY service_role_all ON public.document TO service_role USING (true);

CREATE POLICY service_role_all ON public.document_collaborator TO service_role USING (true);

CREATE POLICY service_role_all ON public.document_cursor TO service_role USING (true);

CREATE POLICY service_role_all ON public.document_version TO service_role USING (true);

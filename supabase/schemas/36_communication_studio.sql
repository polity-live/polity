-- 36_communication_studio.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.studio_asset (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    storage_path text NOT NULL,
    ready boolean DEFAULT true NOT NULL,
    created_at bigint NOT NULL,
    workspace_id uuid,
    CONSTRAINT studio_asset_byte_size_check CHECK (((byte_size >= 1) AND (byte_size <= 104857600))),
    CONSTRAINT studio_asset_pkey PRIMARY KEY (id),
    CONSTRAINT studio_asset_storage_path_key UNIQUE (storage_path)
);

CREATE TABLE public.studio_export (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    requested_by_id uuid NOT NULL,
    format text NOT NULL,
    page_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    lease_at bigint,
    error text,
    storage_path text,
    file_name text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT studio_export_format_check CHECK ((format = ANY (ARRAY['png'::text, 'pdf'::text, 'pptx'::text, 'canva'::text, 'mp4'::text, 'xlsx'::text, 'zip'::text]))),
    CONSTRAINT studio_export_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT studio_export_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT studio_export_pkey PRIMARY KEY (id)
);

CREATE TABLE public.studio_project (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    group_id uuid,
    title text NOT NULL,
    kind text NOT NULL,
    is_template boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    document_schema_version integer DEFAULT 6 NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    source_references jsonb DEFAULT '[]'::jsonb NOT NULL,
    event_id uuid,
    CONSTRAINT studio_project_document_schema_version_check CHECK ((document_schema_version = ANY (ARRAY[2, 3, 4, 5, 6]))),
    CONSTRAINT studio_project_kind_check CHECK ((kind = ANY (ARRAY['single'::text, 'event'::text, 'carousel'::text, 'story'::text, 'video'::text, 'campaign'::text, 'presentation'::text]))),
    CONSTRAINT studio_project_source_references_check CHECK ((jsonb_typeof(source_references) = 'array'::text)),
    CONSTRAINT studio_project_title_check CHECK (((length(title) >= 1) AND (length(title) <= 200))),
    CONSTRAINT studio_project_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'private'::text]))),
    CONSTRAINT studio_project_event_id_key UNIQUE (event_id),
    CONSTRAINT studio_project_pkey PRIMARY KEY (id)
);

CREATE TABLE public.studio_revision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    document jsonb NOT NULL,
    created_by_id uuid NOT NULL,
    created_at bigint NOT NULL,
    content_revision integer DEFAULT 0 NOT NULL,
    CONSTRAINT studio_revision_pkey PRIMARY KEY (id)
);

CREATE TABLE public.studio_state (
    project_id uuid NOT NULL,
    document jsonb NOT NULL,
    updated_at bigint NOT NULL,
    content_revision integer DEFAULT 0 NOT NULL,
    CONSTRAINT studio_state_pkey PRIMARY KEY (project_id)
);

ALTER TABLE public.studio_asset ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_export ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_project ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_revision ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.studio_state ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.studio_access(actor uuid, pid uuid, edit boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT coalesce((SELECT CASE WHEN p.event_id IS NOT NULL THEN CASE WHEN edit THEN event_studio_can_manage(actor,p.event_id) ELSE event_studio_can_read(actor,p.event_id) END
 ELSE studio_access_without_events(actor,pid,edit) END FROM studio_project p WHERE p.id=pid),false);
$$;

CREATE FUNCTION public.studio_access_without_events(actor uuid, pid uuid, edit boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.studio_project p WHERE p.id=pid AND
   CASE WHEN edit THEN
     actor IS NOT NULL AND (
       p.owner_id=actor OR
       (p.group_id IS NULL AND EXISTS (
         SELECT 1 FROM public.studio_project_collaborator c
         WHERE c.project_id=p.id AND c.user_id=actor AND c.status='active')) OR
       (p.group_id IS NOT NULL AND public.studio_group_access(actor,p.group_id,true)))
   ELSE
     p.visibility='public' OR
     (actor IS NOT NULL AND (
       p.visibility='authenticated' OR p.owner_id=actor OR
       (p.group_id IS NULL AND EXISTS (
         SELECT 1 FROM public.studio_project_collaborator c
         WHERE c.project_id=p.id AND c.user_id=actor AND c.status='active')) OR
       (p.group_id IS NOT NULL AND public.studio_group_access(actor,p.group_id,false))))
   END
 );
$$;

CREATE FUNCTION public.studio_group_access(actor uuid, gid uuid, edit boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
 SELECT EXISTS(SELECT 1 FROM public."group" g WHERE g.id=gid AND g.owner_id=actor)
 OR EXISTS(SELECT 1 FROM public.group_membership m
   WHERE m.group_id=gid AND m.user_id=actor AND m.status IN ('active','member','admin')
   AND EXISTS(SELECT 1 FROM public.group_membership_role mr
     JOIN public.action_right ar ON ar.role_id=mr.role_id
     WHERE mr.group_membership_id=m.id AND ar.group_id=gid
       AND ar.resource='projects'
       AND ar.action IN ('manage', CASE WHEN edit THEN 'manage' ELSE 'view' END)));
$$;

CREATE INDEX studio_asset_workspace ON public.studio_asset USING btree (workspace_id) WHERE (workspace_id IS NOT NULL);

CREATE INDEX studio_export_project ON public.studio_export USING btree (project_id, created_at);

CREATE INDEX studio_export_queue ON public.studio_export USING btree (status, created_at);

CREATE INDEX studio_project_group ON public.studio_project USING btree (group_id, updated_at);

CREATE INDEX studio_project_owner ON public.studio_project USING btree (owner_id, updated_at);

CREATE INDEX studio_project_v4_group ON public.studio_project USING btree (document_schema_version, group_id, updated_at DESC);

COMMENT ON COLUMN public.studio_project.document_schema_version IS 'Persisted Studio document schema. The current Studio persists schema 6 documents.';

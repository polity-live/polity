-- Studio metadata is synced through authorized Zero queries. Binary CRDT state,
-- revisions and assets are served only through authenticated Studio endpoints.
CREATE TABLE public.studio_project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public."user"(id),
  group_id uuid REFERENCES public."group"(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('single','event','carousel','story','video','campaign')),
  is_template boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX studio_project_group ON public.studio_project(group_id,updated_at);
CREATE INDEX studio_project_owner ON public.studio_project(owner_id,updated_at);
CREATE TABLE public.studio_state (
  project_id uuid PRIMARY KEY REFERENCES public.studio_project(id) ON DELETE CASCADE,
  state bytea NOT NULL,
  document jsonb NOT NULL,
  updated_at bigint NOT NULL
);
CREATE TABLE public.studio_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.studio_project(id) ON DELETE CASCADE,
  document jsonb NOT NULL,
  created_by_id uuid NOT NULL REFERENCES public."user"(id),
  created_at bigint NOT NULL
);
CREATE TABLE public.studio_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.studio_project(id) ON DELETE CASCADE,
  name text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 104857600),
  storage_path text NOT NULL UNIQUE,
  ready boolean NOT NULL DEFAULT true,
  created_at bigint NOT NULL
);
CREATE TABLE public.studio_export (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.studio_project(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES public.studio_revision(id) ON DELETE CASCADE,
  requested_by_id uuid NOT NULL REFERENCES public."user"(id),
  format text NOT NULL CHECK(format IN ('png','pdf','pptx','canva','mp4','xlsx','zip')),
  page_ids jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  attempts integer NOT NULL DEFAULT 0,
  lease_at bigint,
  error text,
  storage_path text,
  file_name text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX studio_export_queue ON public.studio_export(status,created_at);
CREATE INDEX studio_export_project ON public.studio_export(project_id,created_at);
CREATE FUNCTION public.studio_group_access(actor uuid,gid uuid,edit boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public."group" g WHERE g.id=gid AND g.owner_id=actor)
 OR EXISTS(SELECT 1 FROM public.group_membership m WHERE m.group_id=gid AND m.user_id=actor
 AND m.status IN ('active','member','admin') AND (NOT edit OR m.status='admin'
 OR EXISTS(SELECT 1 FROM public.group_membership_role mr JOIN public.action_right ar ON ar.role_id=mr.role_id
 WHERE mr.group_membership_id=m.id AND ar.group_id=gid AND
 ((ar.resource='groups' AND ar.action='manage') OR (ar.resource='communicationStudio' AND ar.action IN ('manage','update'))))));
$$;
CREATE FUNCTION public.studio_access(actor uuid,pid uuid,edit boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.studio_project p WHERE p.id=pid AND
 ((p.group_id IS NULL AND p.owner_id=actor) OR
 (p.group_id IS NOT NULL AND public.studio_group_access(actor,p.group_id,false)
 AND (NOT edit OR p.owner_id=actor OR public.studio_group_access(actor,p.group_id,true)))));
$$;
REVOKE ALL ON FUNCTION public.studio_access(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.studio_group_access(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_access(uuid,uuid,boolean),public.studio_group_access(uuid,uuid,boolean) TO service_role;
ALTER TABLE public.studio_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_export ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_project,public.studio_state,public.studio_revision,public.studio_asset,public.studio_export FROM anon,authenticated;
GRANT ALL ON public.studio_project,public.studio_state,public.studio_revision,public.studio_asset,public.studio_export TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES ('studio','studio',false,104857600) ON CONFLICT(id) DO UPDATE SET public=false;

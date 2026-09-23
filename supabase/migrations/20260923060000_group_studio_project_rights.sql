-- Install the independent published-media lookup before retiring whiteboards.
CREATE TABLE IF NOT EXISTS public.studio_published_media_archive (
  id uuid PRIMARY KEY,
  storage_path text NOT NULL,
  file_name text NOT NULL
);
ALTER TABLE public.studio_published_media_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_published_media_archive FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_published_media_archive TO service_role;

CREATE OR REPLACE FUNCTION public.studio_group_access(actor uuid, gid uuid, edit boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public."group" g WHERE g.id=gid AND g.owner_id=actor)
 OR EXISTS(SELECT 1 FROM public.group_membership m
   WHERE m.group_id=gid AND m.user_id=actor AND m.status IN ('active','member','admin')
   AND EXISTS(SELECT 1 FROM public.group_membership_role mr
     JOIN public.action_right ar ON ar.role_id=mr.role_id
     WHERE mr.group_membership_id=m.id AND ar.group_id=gid
       AND ar.resource='projects'
       AND ar.action IN ('manage', CASE WHEN edit THEN 'manage' ELSE 'view' END)));
$$;

CREATE OR REPLACE FUNCTION public.studio_access(actor uuid, pid uuid, edit boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.studio_project p WHERE p.id=pid AND
   ((p.group_id IS NULL AND (p.owner_id=actor OR EXISTS (
     SELECT 1 FROM public.studio_project_collaborator c
     WHERE c.project_id=p.id AND c.user_id=actor AND c.status='active')))
    OR (p.group_id IS NOT NULL AND
      (p.owner_id=actor OR public.studio_group_access(actor,p.group_id,edit)))));
$$;

CREATE OR REPLACE FUNCTION public.canvas_manage(actor uuid, pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.studio_project p WHERE p.id=pid AND
   ((p.group_id IS NULL AND p.owner_id=actor) OR
    (p.group_id IS NOT NULL AND (p.owner_id=actor OR public.studio_group_access(actor,p.group_id,true)))));
$$;

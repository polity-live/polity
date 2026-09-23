CREATE TABLE public.studio_project_collaborator (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.studio_project(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."user"(id),
  invited_by_id uuid NOT NULL REFERENCES public."user"(id),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'declined')),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (project_id, user_id)
);

CREATE INDEX studio_project_collaborator_user_status
  ON public.studio_project_collaborator (user_id, status);

ALTER TABLE public.studio_project_collaborator ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_project_collaborator TO service_role;

CREATE OR REPLACE FUNCTION public.studio_access(actor uuid, pid uuid, edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
 SELECT EXISTS(
   SELECT 1 FROM public.studio_project p
   WHERE p.id = pid AND (
     (p.group_id IS NULL AND (
       p.owner_id = actor OR
       (p.kind <> 'whiteboard' AND EXISTS (
         SELECT 1 FROM public.studio_project_collaborator c
         WHERE c.project_id = p.id AND c.user_id = actor AND c.status = 'active'
       ))
     )) OR
     (p.group_id IS NOT NULL AND public.studio_group_access(actor, p.group_id, false)
       AND (NOT edit OR p.owner_id = actor OR public.studio_group_access(actor, p.group_id, true)))
   )
 );
$function$;

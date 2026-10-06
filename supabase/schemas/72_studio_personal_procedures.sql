-- Personal procedures use the owner and accepted collaborators as their electorate.
CREATE OR REPLACE FUNCTION public.canvas_capability(actor uuid,pid uuid,cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.studio_project p WHERE p.id=pid
 AND public.studio_collaboration_access(actor,pid) AND
 CASE WHEN cap='read' THEN true
 WHEN cap='edit' THEN public.studio_access(actor,pid,true)
 WHEN cap='manage' THEN public.canvas_manage(actor,pid)
 WHEN cap IN ('suggest','comment','vote') AND p.group_id IS NULL THEN true
 WHEN cap IN ('suggest','comment','vote') THEN NOT EXISTS(
   SELECT 1 FROM public.group_membership m
   JOIN public.group_membership_role mr ON mr.group_membership_id=m.id
   JOIN public.role r ON r.id=mr.role_id AND r.group_id=p.group_id
   JOIN public.canvas_role_capability c ON c.role_id=r.id
   WHERE m.group_id=p.group_id AND m.user_id=actor AND m.status IN ('active','member','admin')
   AND c.capability=cap AND NOT c.allowed
 ) ELSE false END);
$$;

SELECT pg_advisory_xact_lock(1886351981);
CREATE TABLE public.canvas_role_capability (
 role_id uuid NOT NULL REFERENCES public.role(id) ON DELETE CASCADE,
 capability text NOT NULL CHECK(capability IN ('suggest','comment','vote')),
 allowed boolean NOT NULL,
 PRIMARY KEY(role_id,capability)
);
ALTER TABLE public.canvas_role_capability ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canvas_role_capability FROM anon,authenticated;
GRANT ALL ON public.canvas_role_capability TO service_role;
CREATE FUNCTION public.canvas_capability(actor uuid,pid uuid,cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM studio_project p WHERE p.id=pid AND studio_access(actor,pid,false) AND
 CASE WHEN cap='read' THEN true
 WHEN cap='edit' THEN studio_access(actor,pid,true)
 WHEN cap='manage' THEN canvas_manage(actor,pid)
 WHEN cap IN ('suggest','comment','vote') THEN
  (p.group_id IS NOT NULL OR cap='comment') AND NOT EXISTS(
   SELECT 1 FROM group_membership m
   JOIN group_membership_role mr ON mr.group_membership_id=m.id
   JOIN role r ON r.id=mr.role_id AND r.group_id=p.group_id
   JOIN canvas_role_capability c ON c.role_id=r.id
   WHERE m.group_id=p.group_id AND m.user_id=actor AND m.status IN ('active','member','admin')
   AND c.capability=cap AND NOT c.allowed
  )
 ELSE false END);
$$;
REVOKE ALL ON FUNCTION public.canvas_capability(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_capability(uuid,uuid,text) TO service_role;

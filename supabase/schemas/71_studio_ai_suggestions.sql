SELECT pg_advisory_xact_lock(1886351981);
ALTER TABLE public.studio_project
  ADD COLUMN source_references jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(source_references) = 'array');
ALTER TABLE public.studio_project DROP CONSTRAINT studio_project_kind_check;
ALTER TABLE public.studio_project ADD CONSTRAINT studio_project_kind_check
  CHECK (kind IN ('single','event','carousel','story','video','campaign','presentation'));

ALTER TABLE public.canvas_proposal
  ADD COLUMN origin text NOT NULL DEFAULT 'human' CHECK (origin IN ('human','ai')),
  ADD COLUMN ai_mode text CHECK (ai_mode IN ('template','free')),
  ADD COLUMN ai_status text NOT NULL DEFAULT 'ready' CHECK (ai_status IN ('generating','ready')),
  ADD COLUMN ai_request_key text,
  ADD COLUMN ai_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN ai_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX canvas_proposal_ai_request_key ON public.canvas_proposal(ai_request_key)
  WHERE ai_request_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.canvas_capability(actor uuid,pid uuid,cap text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.studio_project p WHERE p.id=pid
 AND public.studio_collaboration_access(actor,pid) AND
 CASE WHEN cap='read' THEN true
 WHEN cap='edit' THEN public.studio_access(actor,pid,true)
 WHEN cap='manage' THEN public.canvas_manage(actor,pid)
 WHEN cap='suggest' AND p.group_id IS NULL THEN public.studio_access(actor,pid,true)
 WHEN cap IN ('suggest','comment','vote') THEN
  (p.group_id IS NOT NULL OR cap='comment') AND NOT EXISTS(
   SELECT 1 FROM public.group_membership m
   JOIN public.group_membership_role mr ON mr.group_membership_id=m.id
   JOIN public.role r ON r.id=mr.role_id AND r.group_id=p.group_id
   JOIN public.canvas_role_capability c ON c.role_id=r.id
   WHERE m.group_id=p.group_id AND m.user_id=actor AND m.status IN ('active','member','admin')
   AND c.capability=cap AND NOT c.allowed
  ) ELSE false END);
$$;

CREATE OR REPLACE FUNCTION public.canvas_proposal_access(actor uuid,wid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.canvas_proposal w
 JOIN public.studio_project p ON p.id=w.project_id
 WHERE w.id=wid AND public.studio_collaboration_access(actor,w.project_id)
 AND (w.checksum IS NOT NULL OR w.owner_id=actor OR actor=ANY(w.shared_ids)
   OR (w.origin='ai' AND p.group_id IS NULL AND public.canvas_manage(actor,w.project_id))));
$$;

SELECT pg_advisory_xact_lock(1886351981);
CREATE OR REPLACE FUNCTION public.canvas_proposal_access(actor uuid,wid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.canvas_proposal w
 JOIN public.studio_project p ON p.id=w.project_id
 WHERE w.id=wid AND public.studio_collaboration_access(actor,w.project_id)
 AND (w.checksum IS NOT NULL OR w.owner_id=actor OR actor=ANY(w.shared_ids)
   OR (w.origin='ai' AND p.group_id IS NULL AND public.canvas_manage(actor,w.project_id))));
$$;

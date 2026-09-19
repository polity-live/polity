-- A completed sandbox disappears from owner-scoped queries while its immutable
-- decision history survives. Legacy sandboxes retain their original cleanup.
ALTER TABLE public.app_tutorial_run DROP CONSTRAINT app_tutorial_run_status_check;
ALTER TABLE public.app_tutorial_run ADD CONSTRAINT app_tutorial_run_status_check
  CHECK (status IN ('active','paused','archived'));
CREATE TRIGGER collaboration_acl AFTER UPDATE OR DELETE ON public.app_tutorial_run
  FOR EACH ROW EXECUTE FUNCTION public.collaboration_acl_changed();
CREATE TRIGGER collaboration_authority BEFORE INSERT OR UPDATE OR DELETE ON public.app_tutorial_run
  FOR EACH STATEMENT EXECUTE FUNCTION public.collaboration_authority_lock();

CREATE OR REPLACE FUNCTION public.cleanup_expired_app_tutorial_runs()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cleaned_count integer; current_phase text;
BEGIN
  PERFORM pg_advisory_xact_lock(1886351981);
  SELECT phase INTO current_phase FROM collaboration_control WHERE singleton;
  IF current_phase='maintenance' THEN RAISE EXCEPTION 'collaboration_maintenance' USING ERRCODE='55000'; END IF;
  IF current_phase='active' THEN
    UPDATE app_tutorial_run SET status='archived', revision=revision+1
      WHERE expires_at<=now() AND status IN ('active','paused');
    GET DIAGNOSTICS cleaned_count=ROW_COUNT;
    DELETE FROM search_document WHERE tutorial_run_id IN
      (SELECT id FROM app_tutorial_run WHERE status='archived');
  ELSE
    DELETE FROM amendment_process_run process_run USING amendment, app_tutorial_run tutorial_run
      WHERE process_run.amendment_id=amendment.id AND amendment.tutorial_run_id=tutorial_run.id AND tutorial_run.expires_at<=now();
    DELETE FROM app_tutorial_run WHERE expires_at<=now();
    GET DIAGNOSTICS cleaned_count=ROW_COUNT;
  END IF;
  RETURN cleaned_count;
END $$;

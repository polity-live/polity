-- Supabase's schema diff omits extension state, default ACLs, function ACLs,
-- and pg_cron rows. Apply their declarative contracts after the schema diff.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

DO $$
DECLARE
  app_function RECORD;
BEGIN
  FOR app_function IN
    SELECT procedure.proname,
      pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend dependency
        WHERE dependency.classid = 'pg_proc'::regclass
          AND dependency.objid = procedure.oid
          AND dependency.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
      app_function.proname, app_function.identity_arguments
    );
  END LOOP;
END
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_password() TO authenticated;
GRANT EXECUTE ON FUNCTION public.studio_realtime_access(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canvas_presence_access(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.claim_newsletter_sync_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery_jobs(integer,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_notification_jobs(integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_app_tutorial_runs() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_direct_push_delivery(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.expand_push_notification_job(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_access(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.studio_group_access(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_content_revision() TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_record_revision() TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_manage(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_proposal_access(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.canvas_capability(uuid,uuid,text) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-app-tutorial-runs'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-expired-app-tutorial-runs',
      '17 3 * * *',
      'SELECT public.cleanup_expired_app_tutorial_runs();'
    );
  END IF;
END
$$;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'push_delivery_secret'
  ) THEN
    RETURN;
  END IF;

  SELECT jobid INTO existing_job_id
  FROM cron.job WHERE jobname = 'push-delivery-sync';
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
  PERFORM cron.schedule(
    'push-delivery-sync',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://www.polity.live/api/push/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'push_delivery_secret'
          )
        ),
        body := '{"source":"scheduler"}'::jsonb
      );
    $cron$
  );
END
$$;

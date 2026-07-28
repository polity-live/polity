-- =============================================================================
-- 35_security.sql — least-privilege contract for application-owned objects
-- =============================================================================
-- Supabase's migration diff does not include grants. Keep this final schema file
-- and the permissions pgTAP suite as the executable source of truth.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

-- Extension functions remain governed by their extensions. Every function not
-- owned by an extension is application code and must be explicitly allowlisted.
DO $$
DECLARE
  app_function RECORD;
BEGIN
  FOR app_function IN
    SELECT
      procedure.proname,
      pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_proc procedure
    JOIN pg_namespace namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_proc'::regclass
          AND dependency.objid = procedure.oid
          AND dependency.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      app_function.proname,
      app_function.identity_arguments
    );
  END LOOP;
END
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_password()
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_notification_jobs(INTEGER, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.expand_push_notification_job(BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_direct_push_delivery(UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery_jobs(INTEGER, UUID, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_notifications()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_newsletter_sync_jobs(INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_app_tutorial_runs()
  TO service_role;

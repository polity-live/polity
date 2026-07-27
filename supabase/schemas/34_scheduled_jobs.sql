-- =============================================================================
-- 34_scheduled_jobs.sql — Durable pg_cron scheduling
-- =============================================================================
-- These rows are operational state rather than schema objects. Keep this file
-- as the source of truth and copy both idempotent blocks into fresh baselines,
-- because `supabase db diff` does not emit DML-managed cron jobs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-expired-app-tutorial-runs'
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
  existing_job_id BIGINT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'push_delivery_secret'
  ) THEN
    RETURN;
  END IF;

  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'push-delivery-sync';

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
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'push_delivery_secret'
          )
        ),
        body := '{"source":"scheduler"}'::jsonb
      );
    $cron$
  );
END
$$;

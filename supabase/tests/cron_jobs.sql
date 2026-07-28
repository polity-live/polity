-- @covers schema 34_scheduled_jobs.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(7);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM cron.job
    WHERE jobname = 'cleanup-expired-app-tutorial-runs'
  ),
  1,
  'tutorial cleanup is scheduled exactly once'
);

SELECT results_eq(
  $sql$
    SELECT schedule, command, active
    FROM cron.job
    WHERE jobname = 'cleanup-expired-app-tutorial-runs'
  $sql$,
  $sql$
    VALUES (
      '17 3 * * *'::TEXT,
      'SELECT public.cleanup_expired_app_tutorial_runs();'::TEXT,
      true
    )
  $sql$,
  'tutorial cleanup uses the durable schedule and command'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM cron.job
    WHERE jobname = 'push-delivery-sync'
  ),
  0,
  'push scheduling remains disabled without its Vault secret'
);

SELECT vault.create_secret(
  'test-push-delivery-secret',
  'push_delivery_secret',
  'transactional pgTAP fixture'
);

CREATE TEMP TABLE scheduled_jobs_ddl (ddl TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO scheduled_jobs_ddl (ddl)
VALUES ($scheduled_jobs$
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
$scheduled_jobs$);

SELECT ddl FROM scheduled_jobs_ddl \gexec

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM cron.job
    WHERE jobname = 'push-delivery-sync'
  ),
  1,
  'push scheduling is enabled when its Vault secret exists'
);

SELECT results_eq(
  $sql$
    SELECT schedule, active
    FROM cron.job
    WHERE jobname = 'push-delivery-sync'
  $sql$,
  $sql$
    VALUES ('* * * * *'::TEXT, true)
  $sql$,
  'push delivery runs once per minute'
);

SELECT ok(
  (
    SELECT command LIKE '%https://www.polity.live/api/push/process%'
      AND command LIKE '%Authorization%'
      AND command LIKE '%push_delivery_secret%'
    FROM cron.job
    WHERE jobname = 'push-delivery-sync'
  ),
  'push command targets production and resolves authorization from Vault'
);

SELECT ddl FROM scheduled_jobs_ddl \gexec

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM cron.job
    WHERE jobname IN (
      'cleanup-expired-app-tutorial-runs',
      'push-delivery-sync'
    )
  ),
  2,
  'reapplying scheduled-job DDL remains idempotent'
);

SELECT * FROM finish();

ROLLBACK;

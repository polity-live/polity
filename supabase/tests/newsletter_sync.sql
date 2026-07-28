-- @covers schema 32_newsletter.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

CREATE OR REPLACE FUNCTION pg_temp.capture_sqlstate(command TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE command;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
VALUES (
  'c1000000-0000-4000-a000-000000000001',
  'newsletter-confirmed@polity.local',
  now(),
  '{"language":"de"}'::JSONB
);

SELECT results_eq(
  $sql$
    SELECT email, language, subscribed, sync_status
    FROM public.newsletter_subscription
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
  $sql$,
  $sql$
    VALUES (
      'newsletter-confirmed@polity.local'::TEXT,
      'de'::TEXT,
      true,
      'pending'::TEXT
    )
  $sql$,
  'confirmed signup creates a localized newsletter subscription'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.newsletter_sync_outbox
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
      AND operation = 'upsert'
  ),
  1,
  'confirmed signup enqueues one upsert'
);

INSERT INTO auth.users (
  id,
  email,
  raw_user_meta_data
)
VALUES (
  'c1000000-0000-4000-a000-000000000002',
  'newsletter-unconfirmed@polity.local',
  '{"language":"en"}'::JSONB
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.newsletter_subscription
    WHERE user_id = 'c1000000-0000-4000-a000-000000000002'
  ),
  0,
  'unconfirmed signup does not create a subscription'
);

UPDATE auth.users
SET email_confirmed_at = now()
WHERE id = 'c1000000-0000-4000-a000-000000000002';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.newsletter_subscription
    WHERE user_id = 'c1000000-0000-4000-a000-000000000002'
      AND email = 'newsletter-unconfirmed@polity.local'
  ),
  1,
  'confirming an existing user creates the subscription'
);

UPDATE public.newsletter_subscription
SET
  resend_contact_id = 'resend-contact-test',
  sync_status = 'synced'
WHERE user_id = 'c1000000-0000-4000-a000-000000000001';

UPDATE auth.users
SET email = 'newsletter-renamed@polity.local'
WHERE id = 'c1000000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT email
    FROM public.newsletter_subscription
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
  ),
  'newsletter-renamed@polity.local',
  'a confirmed email change updates the subscription'
);

SELECT results_eq(
  $sql$
    SELECT email, previous_email, resend_contact_id
    FROM public.newsletter_sync_outbox
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
      AND operation = 'replace_email'
  $sql$,
  $sql$
    VALUES (
      'newsletter-renamed@polity.local'::TEXT,
      'newsletter-confirmed@polity.local'::TEXT,
      'resend-contact-test'::TEXT
    )
  $sql$,
  'an email change preserves the previous Resend identity in its job'
);

SELECT is(
  (
    SELECT resend_contact_id
    FROM public.newsletter_subscription
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
  ),
  NULL,
  'an email change clears the stale Resend contact id'
);

UPDATE public.user_preference
SET language = 'en'
WHERE user_id = 'c1000000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT language
    FROM public.newsletter_subscription
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
  ),
  'en',
  'preference changes update the newsletter language'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.newsletter_sync_outbox
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
      AND operation = 'upsert'
      AND language = 'en'
  ),
  1,
  'language changes enqueue a localized upsert'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.newsletter_subscription SET language = 'fr' WHERE user_id = 'c1000000-0000-4000-a000-000000000001'$sql$), '23514', 'newsletter subscription language is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.newsletter_subscription SET sync_status = 'invalid' WHERE user_id = 'c1000000-0000-4000-a000-000000000001'$sql$), '23514', 'newsletter subscription sync status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.newsletter_sync_outbox SET language = 'fr' WHERE user_id = 'c1000000-0000-4000-a000-000000000001'$sql$), '23514', 'newsletter job language is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.newsletter_sync_outbox SET operation = 'invalid' WHERE user_id = 'c1000000-0000-4000-a000-000000000001'$sql$), '23514', 'newsletter job operation is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.newsletter_sync_outbox SET status = 'invalid' WHERE user_id = 'c1000000-0000-4000-a000-000000000001'$sql$), '23514', 'newsletter job status is constrained');

UPDATE public.newsletter_subscription
SET resend_contact_id = 'newsletter-contact-unique'
WHERE user_id = 'c1000000-0000-4000-a000-000000000001';

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.newsletter_subscription SET resend_contact_id = 'newsletter-contact-unique' WHERE user_id = 'c1000000-0000-4000-a000-000000000002'$sql$), '23505', 'Resend contact identities are unique');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.newsletter_subscription SET email = 'NEWSLETTER-RENAMED@POLITY.LOCAL' WHERE user_id = 'c1000000-0000-4000-a000-000000000002'$sql$), '23505', 'newsletter email uniqueness is case-insensitive');

DELETE FROM auth.users
WHERE id = 'c1000000-0000-4000-a000-000000000001';

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.newsletter_sync_outbox
    WHERE user_id = 'c1000000-0000-4000-a000-000000000001'
      AND operation = 'delete'
      AND email = 'newsletter-renamed@polity.local'
  ),
  1,
  'deleting an auth user enqueues deletion of the external contact'
);

UPDATE public.newsletter_sync_outbox
SET status = 'completed'
WHERE id < 91001;

INSERT INTO public.newsletter_sync_outbox (
  id,
  operation,
  email,
  status,
  attempt_count,
  available_at,
  locked_at
)
VALUES
  (
    91001,
    'upsert',
    'claim-pending@polity.local',
    'pending',
    0,
    now() - INTERVAL '1 minute',
    NULL
  ),
  (
    91002,
    'upsert',
    'claim-failed@polity.local',
    'failed',
    2,
    now() - INTERVAL '1 minute',
    NULL
  ),
  (
    91003,
    'upsert',
    'claim-future@polity.local',
    'pending',
    0,
    now() + INTERVAL '1 hour',
    NULL
  ),
  (
    91004,
    'upsert',
    'claim-stale@polity.local',
    'processing',
    4,
    now() - INTERVAL '1 hour',
    now() - INTERVAL '11 minutes'
  ),
  (
    91005,
    'upsert',
    'claim-recent@polity.local',
    'processing',
    1,
    now() - INTERVAL '1 hour',
    now()
  );

SELECT set_eq(
  $sql$
    SELECT id
    FROM public.claim_newsletter_sync_jobs(3)
  $sql$,
  $sql$
    VALUES (91001::BIGINT), (91002::BIGINT), (91004::BIGINT)
  $sql$,
  'claiming selects pending, failed, and stale jobs that are available'
);

SELECT set_eq(
  $sql$
    SELECT id
    FROM public.newsletter_sync_outbox
    WHERE id IN (91003, 91005)
      AND status IN ('pending', 'processing')
  $sql$,
  $sql$
    VALUES (91003::BIGINT), (91005::BIGINT)
  $sql$,
  'future and recently locked jobs remain unclaimed'
);

SELECT results_eq(
  $sql$
    SELECT id, attempt_count
    FROM public.newsletter_sync_outbox
    WHERE id IN (91001, 91002, 91004)
    ORDER BY id
  $sql$,
  $sql$
    VALUES
      (91001::BIGINT, 1),
      (91002::BIGINT, 3),
      (91004::BIGINT, 5)
  $sql$,
  'claiming increments attempt counts exactly once'
);

SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.newsletter_subscription',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'public.newsletter_sync_outbox',
    'SELECT'
  )
  AND has_table_privilege(
    'service_role',
    'public.newsletter_subscription',
    'SELECT'
  ),
  'newsletter state is accessible only to the service role'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.claim_newsletter_sync_jobs(integer)',
    'EXECUTE'
  ),
  'the service role can claim newsletter jobs'
);

SELECT * FROM finish();

ROLLBACK;

-- @covers schema 10_notification.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

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

INSERT INTO public."user" (id, handle)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 'notification-user-1'),
  ('e1000000-0000-0000-0000-000000000002', 'notification-user-2');

INSERT INTO public.notification (
  id, recipient_id, title, deleted_at
)
VALUES
  ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Expired soft deletion', now() - INTERVAL '31 days'),
  ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'Active notification', NULL),
  ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'Expired personal purge', NULL),
  ('e2000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'Recent personal purge', NULL);

INSERT INTO public.notification (
  id, recipient_entity_type, recipient_entity_id, recipient_group_id, title
)
VALUES (
  'e2000000-0000-0000-0000-000000000005',
  'group',
  'e3000000-0000-0000-0000-000000000001',
  'e3000000-0000-0000-0000-000000000001',
  'Entity notification'
);

INSERT INTO public.notification_setting (
  id, user_id, delivery_settings
)
VALUES ('e4000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', '{"push":true}');

INSERT INTO public.notification_read (
  id, notification_id, entity_type, entity_id, read_by_user_id
)
VALUES ('e4100000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'group', 'e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001');

INSERT INTO public.notification_user_state (
  id, notification_id, user_id, dismissed_at, purged_at
)
VALUES
  ('e4200000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', now() - INTERVAL '32 days', now() - INTERVAL '31 days'),
  ('e4200000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', now() - INTERVAL '2 days', now() - INTERVAL '1 day');

INSERT INTO public.push_delivery_outbox (
  notification_id, user_id, kind, dedupe_key, payload
)
VALUES (
  'e2000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000001',
  'notification',
  'notification-lifecycle',
  '{"title":"Lifecycle"}'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notification_read WHERE id = 'e4100000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.notification_user_state WHERE id = 'e4200000-0000-0000-0000-000000000001')
  AND (SELECT count(*) = 5 FROM public.push_notification_outbox WHERE notification_id::TEXT LIKE 'e2000000-%'),
  'notification settings, shared reads, personal state, and durable jobs are accepted'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.notification SET recipient_entity_type = 'group' WHERE id = 'e2000000-0000-0000-0000-000000000002'$sql$), '23514', 'notification recipients must use exactly one target shape');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.notification SET recipient_group_id = 'e3000000-0000-0000-0000-000000000002' WHERE id = 'e2000000-0000-0000-0000-000000000005'$sql$), '23514', 'notification target columns must match the entity identifier');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.notification_user_state SET dismissed_at = NULL WHERE id = 'e4200000-0000-0000-0000-000000000002'$sql$), '23514', 'purging requires prior dismissal');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.notification_setting (user_id) VALUES ('e1000000-0000-0000-0000-000000000001')$sql$), '23505', 'notification settings are unique per user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.notification_read (notification_id, entity_type, entity_id, read_by_user_id) VALUES ('e2000000-0000-0000-0000-000000000002', 'group', 'e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001')$sql$), '23505', 'shared reads are unique per user and entity');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.notification_user_state (notification_id, user_id) VALUES ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001')$sql$), '23505', 'personal state is unique per notification and user');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.push_notification_outbox SET status = 'invalid' WHERE notification_id = 'e2000000-0000-0000-0000-000000000002'$sql$), '23514', 'parent push status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.push_delivery_outbox SET kind = 'invalid' WHERE dedupe_key = 'notification-lifecycle'$sql$), '23514', 'push delivery kind is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.push_delivery_outbox SET status = 'invalid' WHERE dedupe_key = 'notification-lifecycle'$sql$), '23514', 'push delivery status is constrained');

SELECT is(
  public.purge_expired_notifications(),
  2,
  'notification purge removes old soft deletions and old personal purges'
);

SELECT set_eq(
  $sql$
    SELECT id
    FROM public.notification
    WHERE id::TEXT LIKE 'e2000000-%'
  $sql$,
  $sql$
    VALUES
      ('e2000000-0000-0000-0000-000000000002'::UUID),
      ('e2000000-0000-0000-0000-000000000004'::UUID),
      ('e2000000-0000-0000-0000-000000000005'::UUID)
  $sql$,
  'recent and active notifications survive purge'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notification_user_state WHERE id = 'e4200000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.push_notification_outbox WHERE notification_id IN ('e2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000003')),
  'purged notifications cascade to personal state and durable parent jobs'
);

DELETE FROM public.notification
WHERE id = 'e2000000-0000-0000-0000-000000000002';

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notification_read WHERE id = 'e4100000-0000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.push_delivery_outbox WHERE dedupe_key = 'notification-lifecycle')
  AND NOT EXISTS (SELECT 1 FROM public.push_notification_outbox WHERE notification_id = 'e2000000-0000-0000-0000-000000000002'),
  'notification deletion cascades shared reads and push jobs'
);

SELECT * FROM finish();

ROLLBACK;

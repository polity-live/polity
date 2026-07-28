-- @covers schema 10_notification.sql
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

SELECT hasnt_table(
  'public',
  'push_client_presence',
  'push presence is no longer persisted'
);

INSERT INTO public."user" (id, handle)
VALUES
  ('f1000000-0000-0000-0000-000000000001', 'push-test-sender'),
  ('f1000000-0000-0000-0000-000000000002', 'push-test-direct'),
  ('f1000000-0000-0000-0000-000000000003', 'push-test-group-owner'),
  ('f1000000-0000-0000-0000-000000000004', 'push-test-group-member'),
  ('f1000000-0000-0000-0000-000000000005', 'push-test-denied'),
  ('f1000000-0000-0000-0000-000000000006', 'push-test-inactive'),
  ('f1000000-0000-0000-0000-000000000007', 'push-test-guest'),
  ('f1000000-0000-0000-0000-000000000008', 'push-test-event-member'),
  ('f1000000-0000-0000-0000-000000000009', 'push-test-event-inactive'),
  ('f1000000-0000-0000-0000-000000000010', 'push-test-amendment-owner'),
  ('f1000000-0000-0000-0000-000000000011', 'push-test-amendment-member'),
  ('f1000000-0000-0000-0000-000000000012', 'push-test-amendment-inactive'),
  ('f1000000-0000-0000-0000-000000000013', 'push-test-blogger');

INSERT INTO public."group" (id, name, owner_id)
VALUES (
  'f2000000-0000-0000-0000-000000000001',
  'Push test group',
  'f1000000-0000-0000-0000-000000000003'
);

INSERT INTO public.event (id, title, creator_id)
VALUES (
  'f2000000-0000-0000-0000-000000000002',
  'Push test event',
  'f1000000-0000-0000-0000-000000000001'
);

INSERT INTO public.amendment (id, title, created_by_id)
VALUES (
  'f2000000-0000-0000-0000-000000000003',
  'Push test amendment',
  'f1000000-0000-0000-0000-000000000010'
);

INSERT INTO public.blog (id, title)
VALUES ('f2000000-0000-0000-0000-000000000004', 'Push test blog');

INSERT INTO public.role (id, name, group_id, event_id, amendment_id, blog_id)
VALUES
  (
    'f3000000-0000-0000-0000-000000000001',
    'Group notification viewer',
    'f2000000-0000-0000-0000-000000000001',
    NULL,
    NULL,
    NULL
  ),
  (
    'f3000000-0000-0000-0000-000000000002',
    'Group denied',
    'f2000000-0000-0000-0000-000000000001',
    NULL,
    NULL,
    NULL
  ),
  (
    'f3000000-0000-0000-0000-000000000003',
    'Event notification viewer',
    NULL,
    'f2000000-0000-0000-0000-000000000002',
    NULL,
    NULL
  ),
  (
    'f3000000-0000-0000-0000-000000000004',
    'Event denied',
    NULL,
    'f2000000-0000-0000-0000-000000000002',
    NULL,
    NULL
  ),
  (
    'f3000000-0000-0000-0000-000000000005',
    'Amendment notification viewer',
    NULL,
    NULL,
    'f2000000-0000-0000-0000-000000000003',
    NULL
  ),
  (
    'f3000000-0000-0000-0000-000000000006',
    'Amendment denied',
    NULL,
    NULL,
    'f2000000-0000-0000-0000-000000000003',
    NULL
  ),
  (
    'f3000000-0000-0000-0000-000000000007',
    'Blog notification viewer',
    NULL,
    NULL,
    NULL,
    'f2000000-0000-0000-0000-000000000004'
  ),
  (
    'f3000000-0000-0000-0000-000000000008',
    'Blog denied',
    NULL,
    NULL,
    NULL,
    'f2000000-0000-0000-0000-000000000004'
  );

INSERT INTO public.action_right (role_id, resource, action)
VALUES
  ('f3000000-0000-0000-0000-000000000001', 'groupNotifications', 'viewNotifications'),
  ('f3000000-0000-0000-0000-000000000003', 'notifications', 'manageNotifications'),
  ('f3000000-0000-0000-0000-000000000005', 'notifications', 'viewNotifications'),
  ('f3000000-0000-0000-0000-000000000007', 'notifications', 'viewNotifications');

INSERT INTO public.group_membership (id, group_id, user_id, status)
VALUES
  (
    'f4000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000004',
    'active'
  ),
  (
    'f4000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000005',
    'active'
  ),
  (
    'f4000000-0000-0000-0000-000000000004',
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000006',
    'inactive'
  );

INSERT INTO public.group_membership_role (group_membership_id, role_id)
VALUES
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-000000000001'
  ),
  (
    'f4000000-0000-0000-0000-000000000003',
    'f3000000-0000-0000-0000-000000000002'
  ),
  (
    'f4000000-0000-0000-0000-000000000004',
    'f3000000-0000-0000-0000-000000000001'
  );

INSERT INTO public.group_guest_access (id, group_id, user_id, status)
VALUES (
  'f4000000-0000-0000-0000-000000000005',
  'f2000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000007',
  'active'
);

INSERT INTO public.group_guest_role (group_guest_access_id, role_id)
VALUES (
  'f4000000-0000-0000-0000-000000000005',
  'f3000000-0000-0000-0000-000000000001'
);

INSERT INTO public.event_participant (id, event_id, user_id, status)
VALUES
  (
    'f4000000-0000-0000-0000-000000000006',
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'f4000000-0000-0000-0000-000000000007',
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000008',
    'confirmed'
  ),
  (
    'f4000000-0000-0000-0000-000000000008',
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000005',
    'active'
  ),
  (
    'f4000000-0000-0000-0000-000000000009',
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000009',
    'inactive'
  );

INSERT INTO public.event_participant_role (event_participant_id, role_id)
VALUES
  (
    'f4000000-0000-0000-0000-000000000006',
    'f3000000-0000-0000-0000-000000000003'
  ),
  (
    'f4000000-0000-0000-0000-000000000007',
    'f3000000-0000-0000-0000-000000000003'
  ),
  (
    'f4000000-0000-0000-0000-000000000008',
    'f3000000-0000-0000-0000-000000000004'
  ),
  (
    'f4000000-0000-0000-0000-000000000009',
    'f3000000-0000-0000-0000-000000000003'
  );

INSERT INTO public.amendment_collaborator (amendment_id, user_id, role_id, status)
VALUES
  (
    'f2000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000005',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000011',
    'f3000000-0000-0000-0000-000000000005',
    'collaborator'
  ),
  (
    'f2000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000005',
    'f3000000-0000-0000-0000-000000000006',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000012',
    'f3000000-0000-0000-0000-000000000005',
    'inactive'
  );

INSERT INTO public.blog_blogger (blog_id, user_id, role_id, status)
VALUES
  (
    'f2000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000007',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000013',
    'f3000000-0000-0000-0000-000000000007',
    'active'
  ),
  (
    'f2000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000005',
    'f3000000-0000-0000-0000-000000000008',
    'active'
  );

INSERT INTO public.notification (
  id,
  recipient_id,
  sender_id,
  title,
  message,
  type,
  action_url,
  category,
  created_at
)
VALUES (
  'f5000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000001',
  'Direct push',
  'Direct push message',
  'test',
  '/notifications',
  'social',
  date_trunc('minute', now())
);

INSERT INTO public.notification (
  id,
  sender_id,
  title,
  message,
  type,
  action_url,
  recipient_entity_type,
  recipient_entity_id,
  recipient_group_id,
  recipient_event_id,
  recipient_amendment_id,
  recipient_blog_id,
  category,
  created_at
)
VALUES
  (
    'f5000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'Group push',
    'Group push message',
    'test',
    '/notifications',
    'group',
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    NULL,
    NULL,
    NULL,
    'group',
    date_trunc('minute', now())
  ),
  (
    'f5000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000001',
    'Event push',
    'Event push message',
    'test',
    '/notifications',
    'event',
    'f2000000-0000-0000-0000-000000000002',
    NULL,
    'f2000000-0000-0000-0000-000000000002',
    NULL,
    NULL,
    'event',
    date_trunc('minute', now())
  ),
  (
    'f5000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000001',
    'Amendment push',
    'Amendment push message',
    'test',
    '/notifications',
    'amendment',
    'f2000000-0000-0000-0000-000000000003',
    NULL,
    NULL,
    'f2000000-0000-0000-0000-000000000003',
    NULL,
    'amendment',
    date_trunc('minute', now())
  ),
  (
    'f5000000-0000-0000-0000-000000000005',
    'f1000000-0000-0000-0000-000000000001',
    'Blog push',
    'Blog push message',
    'test',
    '/notifications',
    'blog',
    'f2000000-0000-0000-0000-000000000004',
    NULL,
    NULL,
    NULL,
    'f2000000-0000-0000-0000-000000000004',
    'blog',
    date_trunc('minute', now())
  ),
  (
    'f5000000-0000-0000-0000-000000000006',
    'f1000000-0000-0000-0000-000000000001',
    'Group push',
    'Group push message',
    'test',
    '/notifications',
    'group',
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    NULL,
    NULL,
    NULL,
    'group',
    date_trunc('minute', now())
  );

SELECT is(
  (
    SELECT array_agg(user_id ORDER BY user_id)
    FROM public.resolve_notification_recipients(
      'f5000000-0000-0000-0000-000000000001'
    )
  ),
  ARRAY['f1000000-0000-0000-0000-000000000002'::UUID],
  'direct notifications resolve the direct recipient'
);

SELECT is(
  (
    SELECT array_agg(user_id ORDER BY user_id)
    FROM public.resolve_notification_recipients(
      'f5000000-0000-0000-0000-000000000002'
    )
  ),
  ARRAY[
    'f1000000-0000-0000-0000-000000000003'::UUID,
    'f1000000-0000-0000-0000-000000000004'::UUID,
    'f1000000-0000-0000-0000-000000000007'::UUID
  ],
  'group recipients honor ownership, active membership, guest roles, rights, and sender exclusion'
);

SELECT is(
  (
    SELECT array_agg(user_id ORDER BY user_id)
    FROM public.resolve_notification_recipients(
      'f5000000-0000-0000-0000-000000000003'
    )
  ),
  ARRAY['f1000000-0000-0000-0000-000000000008'::UUID],
  'event recipients honor participant status, rights, and sender exclusion'
);

SELECT is(
  (
    SELECT array_agg(user_id ORDER BY user_id)
    FROM public.resolve_notification_recipients(
      'f5000000-0000-0000-0000-000000000004'
    )
  ),
  ARRAY[
    'f1000000-0000-0000-0000-000000000010'::UUID,
    'f1000000-0000-0000-0000-000000000011'::UUID
  ],
  'amendment recipients honor creator, collaborator status, rights, and sender exclusion'
);

SELECT is(
  (
    SELECT array_agg(user_id ORDER BY user_id)
    FROM public.resolve_notification_recipients(
      'f5000000-0000-0000-0000-000000000005'
    )
  ),
  ARRAY['f1000000-0000-0000-0000-000000000013'::UUID],
  'blog recipients honor role rights and sender exclusion'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.push_notification_outbox
    WHERE notification_id IN (
      'f5000000-0000-0000-0000-000000000001',
      'f5000000-0000-0000-0000-000000000002',
      'f5000000-0000-0000-0000-000000000003',
      'f5000000-0000-0000-0000-000000000004',
      'f5000000-0000-0000-0000-000000000005',
      'f5000000-0000-0000-0000-000000000006'
    )
  ),
  6,
  'every inbox notification enqueues one durable parent job'
);

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.push_notification_outbox (notification_id) VALUES ('f5000000-0000-0000-0000-000000000001')$sql$), '23505', 'a notification has only one durable parent push job');

INSERT INTO public.push_subscription (
  id,
  user_id,
  device_id,
  endpoint,
  auth,
  p256dh
)
VALUES (
  'f6000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000004',
  'f7000000-0000-0000-0000-000000000001',
  'https://push.test/group-member',
  'auth-test',
  'key-test'
), (
  'f6000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000002',
  'f7000000-0000-0000-0000-000000000002',
  'https://push.test/direct-recipient',
  'auth-test',
  'key-test'
);

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.push_subscription (user_id, endpoint, auth, p256dh) VALUES ('f1000000-0000-0000-0000-000000000005', 'https://push.test/no-device-1', 'auth-test', 'key-test'), ('f1000000-0000-0000-0000-000000000005', 'https://push.test/no-device-2', 'auth-test', 'key-test')$sql$), NULL, 'subscriptions without device ids are outside the partial device uniqueness rule');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.push_subscription (user_id, device_id, endpoint, auth, p256dh) VALUES ('f1000000-0000-0000-0000-000000000004', 'f7000000-0000-0000-0000-000000000001', 'https://push.test/duplicate-device', 'auth-test', 'key-test')$sql$), '23505', 'push devices are unique per user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.push_subscription (user_id, device_id, endpoint, auth, p256dh) VALUES ('f1000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000003', 'https://push.test/group-member', 'auth-test', 'key-test')$sql$), '23505', 'push endpoints are globally unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.push_delivery_outbox (user_id, kind, dedupe_key, payload) VALUES ('f1000000-0000-0000-0000-000000000005', 'test', 'no-subscription-duplicate', '{}'), ('f1000000-0000-0000-0000-000000000005', 'test', 'no-subscription-duplicate', '{}')$sql$), NULL, 'deliveries without subscriptions are outside both partial delivery uniqueness rules');

SELECT is(
  public.expand_push_notification_job(
    (
      SELECT id
      FROM public.push_notification_outbox
      WHERE notification_id = 'f5000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'the first entity notification creates one per-subscription delivery'
);

SELECT is(
  public.expand_push_notification_job(
    (
      SELECT id
      FROM public.push_notification_outbox
      WHERE notification_id = 'f5000000-0000-0000-0000-000000000006'
    )
  ),
  0,
  'an equivalent personal or entity copy does not create a duplicate delivery'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.push_delivery_outbox
    WHERE push_subscription_id = 'f6000000-0000-0000-0000-000000000001'
  ),
  1,
  'delivery outbox remains deduplicated per subscription'
);

SELECT is(
  (
    SELECT payload ->> 'foregroundBehavior'
    FROM public.push_delivery_outbox
    WHERE push_subscription_id = 'f6000000-0000-0000-0000-000000000001'
  ),
  'toast',
  'inbox-backed pushes use a foreground toast'
);

SELECT is(
  public.enqueue_direct_push_delivery(
    'f1000000-0000-0000-0000-000000000002',
    'direct:push-only-test',
    '{"title":"Direct push only","message":"Push remains independent of the in-app channel","tag":"push-only-test","foregroundBehavior":"system"}'::JSONB
  ),
  1,
  'direct push-only delivery creates one durable job per subscription'
);

SELECT is(
  public.enqueue_direct_push_delivery(
    'f1000000-0000-0000-0000-000000000002',
    'direct:push-only-test',
    '{"title":"Direct push only","message":"Push remains independent of the in-app channel","tag":"push-only-test","foregroundBehavior":"system"}'::JSONB
  ),
  0,
  'direct push-only delivery is deduplicated'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.push_delivery_outbox
    WHERE push_subscription_id = 'f6000000-0000-0000-0000-000000000002'
  ),
  1,
  'the push-only channel does not require a visible inbox row'
);

SELECT is(
  (
    SELECT payload ->> 'foregroundBehavior'
    FROM public.push_delivery_outbox
    WHERE push_subscription_id = 'f6000000-0000-0000-0000-000000000002'
  ),
  'system',
  'push-only delivery remains a system notification in the foreground'
);

UPDATE public.push_notification_outbox
SET
  status = 'processing',
  attempt_count = 0,
  locked_at = now() - INTERVAL '11 minutes'
WHERE notification_id = 'f5000000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT attempt_count
    FROM public.claim_push_notification_jobs(
      1,
      'f5000000-0000-0000-0000-000000000001'
    )
  ),
  1,
  'stale parent locks are reclaimed'
);

UPDATE public.push_delivery_outbox
SET
  status = 'processing',
  attempt_count = 0,
  locked_at = now() - INTERVAL '11 minutes'
WHERE push_subscription_id = 'f6000000-0000-0000-0000-000000000002';

SELECT is(
  (
    SELECT attempt_count
    FROM public.claim_push_delivery_jobs(
      1,
      NULL::UUID,
      (
        SELECT id
        FROM public.push_delivery_outbox
        WHERE push_subscription_id = 'f6000000-0000-0000-0000-000000000002'
      )
    )
  ),
  1,
  'stale per-subscription delivery locks are reclaimed'
);

SELECT * FROM finish();

ROLLBACK;

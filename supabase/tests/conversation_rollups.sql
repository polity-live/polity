-- @covers schema 09_message.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(15);

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
  ('e9100000-0000-4000-a000-000000000001', 'rollup-sender'),
  ('e9100000-0000-4000-a000-000000000002', 'rollup-recipient'),
  ('e9100000-0000-4000-a000-000000000003', 'rollup-late-participant');

INSERT INTO public.conversation (id, name)
VALUES
  ('e9200000-0000-4000-a000-000000000001', 'First rollup test'),
  ('e9200000-0000-4000-a000-000000000002', 'Second rollup test');

INSERT INTO public.conversation_participant (
  id,
  conversation_id,
  user_id
)
VALUES
  (
    'e9300000-0000-4000-a000-000000000001',
    'e9200000-0000-4000-a000-000000000001',
    'e9100000-0000-4000-a000-000000000001'
  ),
  (
    'e9300000-0000-4000-a000-000000000002',
    'e9200000-0000-4000-a000-000000000001',
    'e9100000-0000-4000-a000-000000000002'
  ),
  (
    'e9300000-0000-4000-a000-000000000003',
    'e9200000-0000-4000-a000-000000000002',
    'e9100000-0000-4000-a000-000000000001'
  );

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      INSERT INTO public.conversation_participant (conversation_id, user_id)
      VALUES (
        'e9200000-0000-4000-a000-000000000001',
        'e9100000-0000-4000-a000-000000000001'
      )
    $sql$
  ),
  '23505',
  'conversation membership is unique'
);

INSERT INTO public.message (
  id,
  conversation_id,
  sender_id,
  content,
  created_at,
  updated_at
)
VALUES
  (
    'e9400000-0000-4000-a000-000000000001',
    'e9200000-0000-4000-a000-000000000001',
    'e9100000-0000-4000-a000-000000000001',
    repeat('x', 300),
    TIMESTAMPTZ '2026-01-01 10:00:00+00',
    TIMESTAMPTZ '2026-01-01 10:00:00+00'
  ),
  (
    'e9400000-0000-4000-a000-000000000002',
    'e9200000-0000-4000-a000-000000000001',
    'e9100000-0000-4000-a000-000000000002',
    'Latest message',
    TIMESTAMPTZ '2026-01-01 11:00:00+00',
    TIMESTAMPTZ '2026-01-01 11:00:00+00'
  );

SELECT is(
  (
    SELECT last_message_id
    FROM public.conversation
    WHERE id = 'e9200000-0000-4000-a000-000000000001'
  ),
  'e9400000-0000-4000-a000-000000000002'::UUID,
  'the latest visible message becomes the conversation rollup'
);

SELECT is(
  (
    SELECT last_message_preview
    FROM public.conversation
    WHERE id = 'e9200000-0000-4000-a000-000000000001'
  ),
  'Latest message',
  'the rollup contains the latest message preview'
);

SELECT results_eq(
  $sql$
    SELECT user_id, unread_count
    FROM public.conversation_participant
    WHERE conversation_id = 'e9200000-0000-4000-a000-000000000001'
    ORDER BY user_id
  $sql$,
  $sql$
    VALUES
      ('e9100000-0000-4000-a000-000000000001'::UUID, 1),
      ('e9100000-0000-4000-a000-000000000002'::UUID, 1)
  $sql$,
  'unread counts exclude messages sent by the participant'
);

UPDATE public.conversation_participant
SET left_at = TIMESTAMPTZ '2026-01-01 11:30:00+00'
WHERE id = 'e9300000-0000-4000-a000-000000000002';

SELECT is(
  (
    SELECT unread_count
    FROM public.conversation_participant
    WHERE id = 'e9300000-0000-4000-a000-000000000002'
  ),
  1,
  'leaving preserves the durable unread rollup while clients hide the conversation'
);

UPDATE public.conversation_participant
SET left_at = NULL
WHERE id = 'e9300000-0000-4000-a000-000000000002';

SELECT is(
  (
    SELECT unread_count
    FROM public.conversation_participant
    WHERE id = 'e9300000-0000-4000-a000-000000000002'
  ),
  1,
  'rejoining restores the same membership and unread state'
);

UPDATE public.conversation_participant
SET last_read_at = TIMESTAMPTZ '2026-01-01 12:00:00+00'
WHERE id = 'e9300000-0000-4000-a000-000000000001';

SELECT results_eq(
  $sql$
    SELECT user_id, unread_count
    FROM public.conversation_participant
    WHERE conversation_id = 'e9200000-0000-4000-a000-000000000001'
    ORDER BY user_id
  $sql$,
  $sql$
    VALUES
      ('e9100000-0000-4000-a000-000000000001'::UUID, 0),
      ('e9100000-0000-4000-a000-000000000002'::UUID, 1)
  $sql$,
  'updating last_read_at refreshes unread counts'
);

UPDATE public.message
SET deleted_at = TIMESTAMPTZ '2026-01-01 11:30:00+00'
WHERE id = 'e9400000-0000-4000-a000-000000000002';

SELECT is(
  (
    SELECT last_message_id
    FROM public.conversation
    WHERE id = 'e9200000-0000-4000-a000-000000000001'
  ),
  'e9400000-0000-4000-a000-000000000001'::UUID,
  'soft-deleting the latest message falls back to its predecessor'
);

SELECT is(
  (
    SELECT length(last_message_preview)
    FROM public.conversation
    WHERE id = 'e9200000-0000-4000-a000-000000000001'
  ),
  240,
  'message previews are truncated to 240 characters'
);

SELECT is(
  (
    SELECT unread_count
    FROM public.conversation_participant
    WHERE id = 'e9300000-0000-4000-a000-000000000001'
  ),
  0,
  'soft-deleted messages do not count as unread'
);

INSERT INTO public.message (
  id,
  conversation_id,
  sender_id,
  content,
  created_at,
  updated_at
)
VALUES (
    'e9400000-0000-4000-a000-000000000003',
    'e9200000-0000-4000-a000-000000000001',
    'e9100000-0000-4000-a000-000000000001',
  'Message to move',
  TIMESTAMPTZ '2026-01-01 13:00:00+00',
  TIMESTAMPTZ '2026-01-01 13:00:00+00'
);

UPDATE public.message
SET conversation_id = 'e9200000-0000-4000-a000-000000000002'
WHERE id = 'e9400000-0000-4000-a000-000000000003';

SELECT is(
  (
    SELECT last_message_id
    FROM public.conversation
    WHERE id = 'e9200000-0000-4000-a000-000000000001'
  ),
  'e9400000-0000-4000-a000-000000000001'::UUID,
  'moving a message refreshes its previous conversation'
);

SELECT is(
  (
    SELECT last_message_id
    FROM public.conversation
    WHERE id = 'e9200000-0000-4000-a000-000000000002'
  ),
  'e9400000-0000-4000-a000-000000000003'::UUID,
  'moving a message refreshes its new conversation'
);

INSERT INTO public.conversation_participant (
  id,
  conversation_id,
  user_id
)
VALUES (
  'e9300000-0000-4000-a000-000000000004',
  'e9200000-0000-4000-a000-000000000002',
  'e9100000-0000-4000-a000-000000000003'
);

SELECT is(
  (
    SELECT unread_count
    FROM public.conversation_participant
    WHERE id = 'e9300000-0000-4000-a000-000000000004'
  ),
  1,
  'new participants receive the current unread count'
);

UPDATE public.conversation_participant
SET last_read_at = TIMESTAMPTZ '2026-01-01 14:00:00+00'
WHERE id = 'e9300000-0000-4000-a000-000000000004';

SELECT is(
  (
    SELECT unread_count
    FROM public.conversation_participant
    WHERE id = 'e9300000-0000-4000-a000-000000000004'
  ),
  0,
  'reading a conversation clears the participant unread count'
);

DELETE FROM public.message
WHERE id = 'e9400000-0000-4000-a000-000000000003';

SELECT is(
  (
    SELECT last_message_id
    FROM public.conversation
    WHERE id = 'e9200000-0000-4000-a000-000000000002'
  ),
  NULL,
  'hard-deleting the only message clears the conversation rollup'
);

SELECT * FROM finish();

ROLLBACK;

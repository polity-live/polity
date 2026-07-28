-- @covers schema 22_functions.sql
-- @covers schema 24_user_preference.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  raw_user_meta_data
)
VALUES (
  'b1000000-0000-4000-a000-000000000001',
  'auth-assistant-test@polity.local',
  'hashed-password',
  '{"language":"de"}'::JSONB
);

SELECT is(
  (
    SELECT email
    FROM public."user"
    WHERE id = 'b1000000-0000-4000-a000-000000000001'
  ),
  'auth-assistant-test@polity.local',
  'an auth user creates a public user profile'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.notification_setting
    WHERE user_id = 'b1000000-0000-4000-a000-000000000001'
  ),
  1,
  'an auth user receives notification settings'
);

SELECT is(
  (
    SELECT language
    FROM public.user_preference
    WHERE user_id = 'b1000000-0000-4000-a000-000000000001'
  ),
  'de',
  'supported signup languages are preserved'
);

SELECT results_eq(
  $sql$
    SELECT first_name, last_name, visibility
    FROM public."user"
    WHERE id = 'a12a0000-0000-4000-a000-000000000001'
  $sql$,
  $sql$
    VALUES ('Assistent Aria'::TEXT, '& Kai'::TEXT, 'public'::TEXT)
  $sql$,
  'the assistant profile has its canonical identity'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.conversation
    WHERE assistant_for_user_id = 'b1000000-0000-4000-a000-000000000001'
      AND requested_by_id = 'a12a0000-0000-4000-a000-000000000001'
      AND status = 'accepted'
  ),
  1,
  'signup creates one accepted assistant conversation'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.conversation_participant
    WHERE conversation_id = (
      SELECT id
      FROM public.conversation
      WHERE assistant_for_user_id = 'b1000000-0000-4000-a000-000000000001'
    )
      AND user_id IN (
        'b1000000-0000-4000-a000-000000000001',
        'a12a0000-0000-4000-a000-000000000001'
      )
  ),
  2,
  'the user and assistant participate in the conversation'
);

SELECT is(
  (
    SELECT content
    FROM public.message
    WHERE conversation_id = (
      SELECT id
      FROM public.conversation
      WHERE assistant_for_user_id = 'b1000000-0000-4000-a000-000000000001'
    )
      AND sender_id = 'a12a0000-0000-4000-a000-000000000001'
  ),
  'Hey! Assistent Aria & Kai is here to help you navigate Polity. How can I help?',
  'the assistant conversation contains the welcome message'
);

SELECT is(
  public.ensure_assistant_conversation(
    'b1000000-0000-4000-a000-000000000001'
  ),
  (
    SELECT id
    FROM public.conversation
    WHERE assistant_for_user_id = 'b1000000-0000-4000-a000-000000000001'
  ),
  'ensuring an existing assistant conversation returns the same id'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.conversation
    WHERE assistant_for_user_id = 'b1000000-0000-4000-a000-000000000001'
  ),
  1,
  'ensuring a conversation does not create duplicate conversations'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.message
    WHERE conversation_id = (
      SELECT id
      FROM public.conversation
      WHERE assistant_for_user_id = 'b1000000-0000-4000-a000-000000000001'
    )
      AND sender_id = 'a12a0000-0000-4000-a000-000000000001'
  ),
  1,
  'ensuring a conversation does not duplicate the welcome message'
);

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  raw_user_meta_data
)
VALUES (
  'b1000000-0000-4000-a000-000000000002',
  'auth-language-fallback@polity.local',
  '',
  '{"language":"fr"}'::JSONB
);

SELECT is(
  (
    SELECT language
    FROM public.user_preference
    WHERE user_id = 'b1000000-0000-4000-a000-000000000002'
  ),
  'en',
  'unsupported signup languages fall back to English'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-a000-000000000001',
  true
);

SELECT ok(
  public.current_user_has_password(),
  'authenticated users with a password are detected'
);

SELECT set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-a000-000000000002',
  true
);

SELECT ok(
  NOT public.current_user_has_password(),
  'authenticated users without a password are detected'
);

RESET ROLE;

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_has_password()',
    'EXECUTE'
  ),
  'authenticated users can execute password inspection'
);

SELECT * FROM finish();

ROLLBACK;

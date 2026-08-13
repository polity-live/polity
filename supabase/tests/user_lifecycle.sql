-- @covers schema 22_functions.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(3);

SELECT has_function(
  'public',
  'handle_deleted_user',
  ARRAY[]::TEXT[],
  'auth-user cleanup function exists'
);

SELECT has_trigger(
  'auth',
  'users',
  'on_auth_user_deleted',
  'auth.users deletion invokes profile cleanup'
);

INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
VALUES (
  'a1200000-0000-4000-a000-000000000001',
  'pgtap-user-lifecycle@polity.local',
  'test-password-hash',
  '{"language":"en"}'::jsonb
);

DELETE FROM auth.users
WHERE id = 'a1200000-0000-4000-a000-000000000001';

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public."user"
    WHERE id = 'a1200000-0000-4000-a000-000000000001'
  ),
  'deleting an auth user removes its public profile'
);

SELECT * FROM finish();

ROLLBACK;

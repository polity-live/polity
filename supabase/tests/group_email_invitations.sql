-- @covers schema 76_group_email_invitations.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);
CREATE TEMP TABLE invitation_fixture AS SELECT gen_random_uuid() AS actor, gen_random_uuid() AS group_id;
INSERT INTO public."user"(id) SELECT actor FROM invitation_fixture;
INSERT INTO public."group"(id,group_type) SELECT group_id,'base' FROM invitation_fixture;
INSERT INTO group_invitations.group_email_invitation(group_id,email,invited_by_id,token_hash,language,role_count,expires_at)
SELECT group_id,'recipient@example.com',actor,repeat('a',64),'de',1,now()+interval '30 days' FROM invitation_fixture;
SELECT throws_ok($sql$
  INSERT INTO group_invitations.group_email_invitation(group_id,email,invited_by_id,token_hash,language,role_count,expires_at)
  SELECT group_id,'recipient@example.com',actor,repeat('b',64),'de',1,now()+interval '30 days' FROM invitation_fixture
$sql$, '23505', NULL, 'one pending invitation per group and normalized address');
SELECT throws_ok($sql$
  INSERT INTO group_invitations.group_email_invitation(group_id,email,invited_by_id,token_hash,language,role_count,expires_at)
  SELECT group_id,'UPPER@example.com',actor,repeat('c',64),'de',1,now()+interval '30 days' FROM invitation_fixture
$sql$, '23514', NULL, 'addresses must be normalized');
SELECT throws_ok($sql$
  UPDATE group_invitations.group_email_invitation SET token_hash='raw-token'
$sql$, '23514', NULL, 'only SHA-256 hashes can be persisted');
SELECT ok(NOT has_schema_privilege('anon','group_invitations','USAGE'), 'anonymous cannot access invitation schema');
SELECT throws_ok($sql$
  UPDATE group_invitations.group_email_invitation SET first_name=repeat('x',101)
$sql$, '23514', NULL, 'invitation first names are limited to 100 characters');
SELECT throws_ok($sql$
  UPDATE group_invitations.group_email_invitation SET last_name='  '
$sql$, '23514', NULL, 'blank invitation last names must be stored as null');
SELECT ok(NOT has_schema_privilege('authenticated','group_invitations','USAGE'), 'authenticated cannot access invitation schema');
SELECT is((SELECT count(*)::integer FROM pg_publication_tables WHERE schemaname='group_invitations'), 0, 'invitation data stays outside Zero publications');
SELECT is((SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='group_invitations' AND c.relkind='r' AND c.relrowsecurity), 4, 'all invitation tables have RLS');
UPDATE group_invitations.group_email_invitation SET state='revoked',revoked_at=now();
SELECT lives_ok($sql$
  INSERT INTO group_invitations.group_email_invitation(group_id,email,invited_by_id,token_hash,language,role_count,expires_at)
  SELECT group_id,'recipient@example.com',actor,repeat('b',64),'de',1,now()+interval '30 days' FROM invitation_fixture
$sql$, 'a revoked invitation permits a new personal link');
SELECT * FROM finish();
ROLLBACK;

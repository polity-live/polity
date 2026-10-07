-- @covers schema 37_collaboration.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);
SELECT has_table('public','studio_state','Canonical Studio JSON');
SELECT has_column('public','studio_state','content_revision','Confirmed revision');
SELECT hasnt_column('public','studio_state','state','Binary state removed');
SELECT hasnt_table('public','collaboration_document','Legacy documents removed');
SELECT hasnt_table('public','collaboration_outbox','Legacy delivery removed');
SELECT ok(NOT has_table_privilege('authenticated','public.studio_operation','INSERT'),'Operations require server authority');
SELECT * FROM finish();
ROLLBACK;

-- @covers schema 38_collaboration_workspaces.sql
-- @covers schema 39_collaboration_ballots.sql
-- @covers schema 40_collaboration_migration_attempts.sql
-- @covers schema 41_collaboration_compatibility.sql
-- @covers schema 42_collaboration_transaction_initialization.sql
-- @covers schema 43_collaboration_authority.sql
-- @covers schema 44_collaboration_integrity.sql
-- @covers schema 45_collaboration_legacy_fences.sql
-- @covers schema 46_collaboration_ballot_guards.sql
-- @covers schema 47_collaboration_tutorial.sql
-- @covers schema 48_studio_only_collaboration.sql
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

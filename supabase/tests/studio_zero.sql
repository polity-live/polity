-- @covers schema 49_studio_zero.sql
-- @covers schema 50_studio_editor_actions.sql
-- @covers schema 51_retire_collaboration_functions.sql
-- @covers schema 52_studio_function_permissions.sql
-- @covers schema 53_studio_editor_claim.sql
-- @covers schema 62_studio_document_v3.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(13);
SELECT has_column('public', 'studio_editor_action', 'claimed_by', 'Editor actions have a browser claim');
SELECT ok(NOT has_table_privilege('authenticated', 'public.studio_editor_action', 'INSERT'), 'Clients cannot bypass editor action authorization');
SELECT ok(NOT has_table_privilege('anon', 'public.studio_operation', 'INSERT'), 'Anonymous clients cannot bypass document operations');
SELECT ok(NOT has_function_privilege('authenticated', 'public.project_content_revision()', 'EXECUTE'), 'Revision trigger is not callable by clients');
SELECT ok(has_function_privilege('service_role', 'public.project_content_revision()', 'EXECUTE'), 'Server can maintain revisions');
SELECT ok(has_function_privilege('authenticated', 'public.studio_presence_channel_access(text)', 'EXECUTE'), 'Authenticated Presence uses the access helper');
SELECT is(public.studio_presence_channel_access('presence:studio:00000000-0000-4000-8000-000000000000:main'), false, 'Presence denies a missing project without an authenticated member');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.studio_reset_storage_manifest'::regclass), 'Reset manifest is protected by RLS');
SELECT is((SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'collaboration_%'), 0, 'Retired SQL entry points are removed');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname IN ('studio_direct_presence_read', 'studio_direct_presence_write')), 2, 'Private channel reads and writes require project authorization');
SELECT has_column('public', 'studio_project', 'document_schema_version', 'Studio projects identify their document schema');
SELECT is((SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_project' AND column_name='document_schema_version'), '5', 'New Studio projects default to schema V5');
SELECT ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.studio_project'::regclass AND conname='studio_project_document_schema_version_check'), 'Only supported Studio schema versions can be stored');
SELECT * FROM finish();
ROLLBACK;

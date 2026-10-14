-- @covers schema 35_security.sql
-- @covers schema 98_publications.sql
-- @covers schema 99_event_templates.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);
SELECT set_eq(
  $$SELECT kind FROM public.studio_event_template$$,
  $$VALUES ('cover'),('vote'),('election'),('speech'),('discussion'),('accreditation'),('amendment'),('implementation_review'),('support_confirmation')$$,
  'all nine required Event Studio templates survive a fresh baseline'
);
SELECT is((SELECT count(*)::integer FROM public.studio_event_template WHERE document->>'schemaVersion'='6'),9,'every built-in Event Studio template uses schema 6');
CREATE FUNCTION public.baseline_unlisted_rpc() RETURNS integer LANGUAGE sql AS 'SELECT 1';
CREATE FUNCTION group_invitations.baseline_unlisted_rpc() RETURNS integer LANGUAGE sql AS 'SELECT 1';
SELECT ok(NOT has_function_privilege('anon','public.baseline_unlisted_rpc()','EXECUTE') AND NOT has_function_privilege('authenticated','public.baseline_unlisted_rpc()','EXECUTE'),'future public functions have no implicit client execute');
SELECT ok(NOT has_function_privilege('service_role','public.baseline_unlisted_rpc()','EXECUTE'),'future server RPCs must be explicitly allowlisted');
SELECT ok(NOT has_function_privilege('anon','group_invitations.baseline_unlisted_rpc()','EXECUTE') AND NOT has_function_privilege('service_role','group_invitations.baseline_unlisted_rpc()','EXECUTE'),'private future functions also require explicit grants');
CREATE TABLE group_invitations.baseline_private_table(id integer);
SELECT ok(has_table_privilege('service_role','group_invitations.baseline_private_table','SELECT') AND NOT has_table_privilege('authenticated','group_invitations.baseline_private_table','SELECT'),'future private tables retain the server-only access contract');
DROP PUBLICATION IF EXISTS zero;
CREATE PUBLICATION zero;
-- MANUAL_SQL: migra does not track publication membership.
-- Zero normally owns its publications. Extend only an existing legacy `zero`
-- publication with an explicit table list; do not create or alter runtime ones.
DO $$
DECLARE table_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'zero' AND NOT puballtables) THEN
    FOREACH table_name IN ARRAY ARRAY[
      'studio_state', 'canvas_proposal', 'canvas_workspace_reader',
      'studio_command_receipt', 'studio_asset', 'studio_revision',
      'canvas_control', 'canvas_vote', 'canvas_comment', 'canvas_history',
      'canvas_library', 'canvas_role_capability', 'canvas_receipt',
      'studio_editor_action', 'studio_element_set', 'studio_element_set_revision',
      'studio_live_source', 'event_presentation', 'event_presentation_device'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'zero' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION zero ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END
$$;

-- MANUAL_SQL: migra does not track publication membership.
-- Zero normally owns its publications. Extend only an existing legacy `zero`
-- publication with an explicit table list; do not create or alter runtime ones.
DO $$
DECLARE table_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'zero' AND NOT puballtables) THEN
    FOREACH table_name IN ARRAY ARRAY[
      'studio_state', 'canvas_proposal', 'canvas_workspace_reader',
      'studio_command_receipt', 'studio_asset', 'studio_revision',
      'canvas_control', 'canvas_vote', 'canvas_comment', 'canvas_history',
      'canvas_library', 'canvas_role_capability', 'canvas_receipt',
      'studio_editor_action', 'studio_element_set', 'studio_element_set_revision',
      'studio_live_source', 'event_presentation', 'event_presentation_device'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'zero' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION zero ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END
$$;

SELECT is((SELECT count(*)::integer FROM pg_publication_tables WHERE pubname='zero'),19,'legacy publication additions can be applied twice without duplicates');
DROP PUBLICATION zero;
CREATE PUBLICATION zero FOR ALL TABLES;
-- MANUAL_SQL: migra does not track publication membership.
-- Zero normally owns its publications. Extend only an existing legacy `zero`
-- publication with an explicit table list; do not create or alter runtime ones.
DO $$
DECLARE table_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'zero' AND NOT puballtables) THEN
    FOREACH table_name IN ARRAY ARRAY[
      'studio_state', 'canvas_proposal', 'canvas_workspace_reader',
      'studio_command_receipt', 'studio_asset', 'studio_revision',
      'canvas_control', 'canvas_vote', 'canvas_comment', 'canvas_history',
      'canvas_library', 'canvas_role_capability', 'canvas_receipt',
      'studio_editor_action', 'studio_element_set', 'studio_element_set_revision',
      'studio_live_source', 'event_presentation', 'event_presentation_device'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'zero' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION zero ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END
$$;

SELECT ok((SELECT puballtables FROM pg_publication WHERE pubname='zero'),'all-table publications are left intact');
SELECT is(col_description('public.studio_project'::regclass,(SELECT attnum FROM pg_attribute WHERE attrelid='public.studio_project'::regclass AND attname='document_schema_version')),'Persisted Studio document schema. The current Studio persists schema 6 documents.','the manually maintained Studio comment describes the current schema');
SELECT * FROM finish();
ROLLBACK;

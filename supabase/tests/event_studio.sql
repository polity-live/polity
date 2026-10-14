-- @covers schema 75_event_studio.sql
-- @covers schema 90_foreign_keys.sql
-- @covers schema 91_triggers.sql
-- @covers schema 98_publications.sql
-- @covers schema 99_event_templates.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);
CREATE TEMP TABLE studio_event_fixture AS SELECT gen_random_uuid() AS owner,gen_random_uuid() AS outsider,gen_random_uuid() AS event_id;
INSERT INTO public."user"(id) SELECT owner FROM studio_event_fixture UNION ALL SELECT outsider FROM studio_event_fixture;
INSERT INTO public.event(id,title,creator_id,visibility) SELECT event_id,'Assembly',owner,'private' FROM studio_event_fixture;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT is((SELECT count(*)::integer FROM public.studio_project p JOIN studio_event_fixture f ON p.event_id=f.event_id),1,'events create exactly one Studio project');
SELECT is((SELECT p.document_schema_version FROM public.studio_project p JOIN studio_event_fixture f ON p.event_id=f.event_id),6,'event projects use schema V6');
SELECT ok((SELECT event_studio_can_manage(owner,event_id) FROM studio_event_fixture),'event creators can manage presentation');
SELECT ok(NOT (SELECT event_studio_can_read(outsider,event_id) FROM studio_event_fixture),'private events deny outsiders');
SELECT ok(NOT (SELECT event_studio_can_manage(NULL,event_id) FROM studio_event_fixture),'anonymous viewers cannot manage');
UPDATE public.event SET visibility='public' WHERE id=(SELECT event_id FROM studio_event_fixture);
SELECT ok((SELECT event_studio_can_read(NULL,event_id) FROM studio_event_fixture),'public presentations permit anonymous viewing');
SELECT ok(NOT studio_access(NULL,gen_random_uuid(),false),'missing projects deny reading');
SELECT ok(NOT studio_collaboration_access(NULL,gen_random_uuid()),'missing projects deny collaboration and Presence');
SELECT ok(NOT canvas_manage(NULL,gen_random_uuid()),'missing projects deny canvas management');
SELECT ok(NOT has_table_privilege('authenticated','public.event_presentation','UPDATE'),'clients cannot bypass presentation authorization');
SELECT ok(NOT has_function_privilege('anon','public.studio_source_changed()','EXECUTE'),'anonymous clients cannot call source triggers');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.studio_event_template'::regclass),'templates have RLS');
SELECT is((SELECT payload->>'title' FROM public.studio_live_source s JOIN studio_event_fixture f ON s.source_id=f.event_id WHERE source_type='event'),'Assembly','event sources include the live title');
UPDATE public.event SET title='Renamed Assembly' WHERE id=(SELECT event_id FROM studio_event_fixture);
SELECT is((SELECT payload->>'title' FROM public.studio_live_source s JOIN studio_event_fixture f ON s.source_id=f.event_id WHERE source_type='event'),'Renamed Assembly','source triggers refresh event payloads');
SELECT throws_ok($sql$ UPDATE public.event_presentation SET mode='invalid' $sql$,'23514',NULL,'presentation modes are validated');
SELECT throws_ok($sql$ INSERT INTO public.event_presentation_device(id,event_id,name,last_seen) SELECT gen_random_uuid(),event_id,'',0 FROM studio_event_fixture $sql$,'23514',NULL,'device names cannot be empty');
SELECT lives_ok($sql$ INSERT INTO public.vote(agenda_item_id,purpose) VALUES(gen_random_uuid(),'closing') $sql$,'legacy votes without agenda parents retain their live source');
SELECT lives_ok($sql$ INSERT INTO public.election(agenda_item_id,title) VALUES(gen_random_uuid(),'Legacy election') $sql$,'legacy elections without agenda parents retain their live source');
SELECT is((SELECT count(*)::integer FROM public.studio_live_source WHERE source_type IN ('vote','election') AND agenda_item_id IS NULL),2,'legacy sources omit nonexistent agenda links');
CREATE TEMP TABLE legacy_agenda_fixture AS SELECT gen_random_uuid() AS agenda_id;
INSERT INTO public.agenda_item(id,event_id,creator_id,title) SELECT agenda_id,gen_random_uuid(),(SELECT owner FROM studio_event_fixture),'Legacy agenda' FROM legacy_agenda_fixture;
SELECT lives_ok($sql$ INSERT INTO public.vote(agenda_item_id,purpose) SELECT agenda_id,'closing' FROM legacy_agenda_fixture $sql$,'legacy agenda items without events do not break vote sources');
SELECT ok(EXISTS(SELECT 1 FROM public.studio_live_source s JOIN legacy_agenda_fixture f ON s.agenda_item_id=f.agenda_id WHERE s.source_type='vote' AND s.event_id IS NULL),'legacy vote sources retain valid agenda links and omit nonexistent events');
DELETE FROM public.event WHERE id=(SELECT event_id FROM studio_event_fixture);
SELECT is((SELECT count(*)::integer FROM public.event_presentation p JOIN studio_event_fixture f ON p.event_id=f.event_id),0,'event deletion cascades presentation state');
SELECT is((SELECT count(*)::integer FROM public.studio_live_source s JOIN studio_event_fixture f ON s.event_id=f.event_id),0,'event deletion cascades its live sources');
SELECT * FROM finish();
ROLLBACK;

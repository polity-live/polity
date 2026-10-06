-- @covers schema 73_ai_traces.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);
SELECT ok(NOT has_schema_privilege('anon','ai_diagnostics','USAGE'),'Guests cannot access diagnostics schema');
SELECT ok(NOT has_schema_privilege('authenticated','ai_diagnostics','USAGE'),'Browser users cannot access diagnostics schema');
SELECT ok(has_schema_privilege('service_role','ai_diagnostics','USAGE'),'Server can access diagnostics schema');
SELECT ok(NOT has_table_privilege('authenticated','ai_diagnostics.ai_trace','SELECT'),'Browser users cannot read prompts');
SELECT ok(NOT has_table_privilege('anon','ai_diagnostics.ai_trace_operation','SELECT'),'Guests cannot read operations');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='ai_diagnostics.ai_trace'::regclass),'Traces enforce RLS');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='ai_diagnostics.ai_trace_operation'::regclass),'Operations enforce RLS');
INSERT INTO public."user" (id,handle) VALUES ('cc100000-0000-0000-0000-000000000001','diagnostics-actor');
INSERT INTO public.conversation (id,name) VALUES ('cc200000-0000-0000-0000-000000000001','Diagnostics test');
INSERT INTO public.message (id,conversation_id,sender_id,content) VALUES
('cc300000-0000-0000-0000-000000000001','cc200000-0000-0000-0000-000000000001','cc100000-0000-0000-0000-000000000001','Prompt'),
('cc300000-0000-0000-0000-000000000002','cc200000-0000-0000-0000-000000000001','cc100000-0000-0000-0000-000000000001','Response');
INSERT INTO ai_diagnostics.ai_trace (id,actor_id,origin_message_id,response_message_id,surface,invocation,prompt,created_at) VALUES
('cc400000-0000-0000-0000-000000000001','cc100000-0000-0000-0000-000000000001','cc300000-0000-0000-0000-000000000001','cc300000-0000-0000-0000-000000000002','chat','send','{}',0);
INSERT INTO ai_diagnostics.ai_trace_operation (id,trace_id,kind,name,status,created_at) VALUES
('cc500000-0000-0000-0000-000000000001','cc400000-0000-0000-0000-000000000001','model','Generate','running',0);
SELECT throws_ok($$UPDATE ai_diagnostics.ai_trace_operation SET status='unknown' WHERE id='cc500000-0000-0000-0000-000000000001'$$,'23514',NULL,'Operation status rejects unknown values');
INSERT INTO ai_diagnostics.ai_trace_operation (id,trace_id,parent_operation_id,kind,name,status,created_at) VALUES
('cc500000-0000-0000-0000-000000000002','cc400000-0000-0000-0000-000000000001','cc500000-0000-0000-0000-000000000001','tool','Read context','completed',1);
DELETE FROM ai_diagnostics.ai_trace_operation WHERE id='cc500000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::int FROM ai_diagnostics.ai_trace_operation WHERE trace_id='cc400000-0000-0000-0000-000000000001'),0,'Deleting a parent operation removes its children');
UPDATE public.message SET deleted_at=now() WHERE id='cc300000-0000-0000-0000-000000000002';
SELECT is((SELECT count(*)::int FROM ai_diagnostics.ai_trace WHERE id='cc400000-0000-0000-0000-000000000001'),0,'Soft-deleting a response purges the retained prompt');
INSERT INTO ai_diagnostics.ai_trace (id,actor_id,origin_message_id,surface,invocation,prompt,created_at) VALUES
('cc400000-0000-0000-0000-000000000002','cc100000-0000-0000-0000-000000000001','cc300000-0000-0000-0000-000000000001','chat','send','{}',0);
INSERT INTO ai_diagnostics.ai_trace_operation (id,trace_id,kind,name,status,created_at) VALUES
('cc500000-0000-0000-0000-000000000003','cc400000-0000-0000-0000-000000000002','model','Generate','queued',0);
UPDATE public.message SET deleted_at=now() WHERE id='cc300000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::int FROM ai_diagnostics.ai_trace WHERE id='cc400000-0000-0000-0000-000000000002'),0,'Soft-deleting an origin purges diagnostics');
SELECT is((SELECT count(*)::int FROM ai_diagnostics.ai_trace_operation WHERE id='cc500000-0000-0000-0000-000000000003'),0,'Trace deletion cascades to its operations');
INSERT INTO ai_diagnostics.ai_trace (id,actor_id,surface,invocation,prompt,created_at) VALUES
('cc400000-0000-0000-0000-000000000003','cc100000-0000-0000-0000-000000000001','editor','command','{}',0);
DELETE FROM public."user" WHERE id='cc100000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::int FROM ai_diagnostics.ai_trace WHERE id='cc400000-0000-0000-0000-000000000003'),0,'Deleting an actor purges diagnostics');
SELECT ok(NOT has_function_privilege('authenticated','public.delete_message_ai_trace()','EXECUTE'),'Cleanup trigger is inaccessible to browser users');
SELECT ok(NOT has_table_privilege('authenticated','ai_diagnostics.ai_trace_operation','INSERT'),'Browser users cannot forge operations');
SELECT * FROM finish();
ROLLBACK;

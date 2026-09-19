-- @covers schema 37_collaboration.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);
SELECT has_table('public','collaboration_control','Migration phase has a server-owned record');
SELECT has_table('public','collaboration_document','Canonical documents have shared storage');
SELECT has_table('public','collaboration_revision','Committed revisions have immutable storage');
SELECT has_table('public','collaboration_outbox','Delivery survives a process restart');
SELECT has_table('public','collaboration_proposal','Submitted proposal proofs are separate');
SELECT has_table('public','collaboration_ballot','Ballot contents have revision references');
SELECT has_table('public','collaboration_checkpoint','Migration checkpoints are retained');
SELECT ok(NOT has_table_privilege('anon','public.collaboration_document','SELECT'),'Anonymous cannot read private document state');
SELECT ok(NOT has_table_privilege('authenticated','public.collaboration_revision','SELECT'),'Revision reads require server authorization');
SELECT ok(NOT has_table_privilege('authenticated','public.collaboration_proposal','UPDATE'),'Clients cannot alter proposal decisions');
SELECT ok(NOT has_table_privilege('authenticated','public.collaboration_control','UPDATE'),'Clients cannot activate the migration');
SELECT ok(NOT has_table_privilege('authenticated','public.collaboration_outbox','INSERT'),'Clients cannot publish uncommitted changes');
INSERT INTO public.collaboration_document(id,kind,entity_id,checksum,state,projection,created_at,updated_at)
VALUES('c9400000-0000-4000-8000-000000000001','studio','c9400000-0000-4000-8000-000000000002','test',decode('0000','hex'),'[]',0,0);
INSERT INTO public.collaboration_revision(document_id,generation,revision,checksum,state,projection,operation_id,reason,created_at)
SELECT id,generation,revision,checksum,state,projection,'proof','test',0 FROM public.collaboration_document WHERE id='c9400000-0000-4000-8000-000000000001';
SELECT throws_ok($$UPDATE public.collaboration_revision SET reason='rewritten' WHERE document_id='c9400000-0000-4000-8000-000000000001'$$,'55000','collaboration_revision_immutable','Committed proofs cannot be rewritten');
SELECT throws_ok($$DELETE FROM public.collaboration_revision WHERE document_id='c9400000-0000-4000-8000-000000000001'$$,'55000','collaboration_revision_immutable','Committed proofs cannot be deleted');
SELECT * FROM finish();
ROLLBACK;


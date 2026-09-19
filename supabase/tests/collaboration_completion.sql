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
SELECT plan(20);
UPDATE collaboration_control SET phase='active' WHERE singleton;
INSERT INTO public."user"(id) VALUES('cf000000-0000-4000-8000-000000000001');
INSERT INTO document(id,content,editing_mode) VALUES('cf000000-0000-4000-8000-000000000002','[]','edit');
INSERT INTO amendment(id,document_id,created_by_id) VALUES('cf000000-0000-4000-8000-000000000003','cf000000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000001');
INSERT INTO blog(id,content) VALUES('cf000000-0000-4000-8000-000000000004','[]');
INSERT INTO amendment_city_design(id,amendment_id,created_by_id,design_state) VALUES('cf000000-0000-4000-8000-000000000005','cf000000-0000-4000-8000-000000000003','cf000000-0000-4000-8000-000000000001','{}');
SELECT lives_ok($$UPDATE document SET content='[{"text":"Saved"}]' WHERE id='cf000000-0000-4000-8000-000000000002'$$,'Legacy text saves while Studio is active');
SELECT lives_ok($$UPDATE blog SET content='[{"text":"Saved"}]' WHERE id='cf000000-0000-4000-8000-000000000004'$$,'Legacy blogs save');
SELECT lives_ok($$UPDATE amendment_city_design SET design_state='{"objects":[]}' WHERE id='cf000000-0000-4000-8000-000000000005'$$,'Legacy Streetdesign saves');
SELECT lives_ok($$UPDATE amendment SET discussions='[]' WHERE id='cf000000-0000-4000-8000-000000000003'$$,'Legacy discussions save');
SELECT lives_ok($$INSERT INTO document_version(document_id,author_id,version_number,content) VALUES('cf000000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000001',1,'[]')$$,'Legacy versions use their original write path');
SELECT lives_ok($$INSERT INTO vote(id,amendment_id,purpose,status) VALUES('cf000000-0000-4000-8000-000000000007','cf000000-0000-4000-8000-000000000003','closing','final')$$,'Legacy voting does not require a Yjs ballot');
INSERT INTO collaboration_ballot_context VALUES('cf000000-0000-4000-8000-000000000007','{}',0);
SELECT lives_ok($$UPDATE vote SET status='closed' WHERE id='cf000000-0000-4000-8000-000000000007'$$,'Archived migration evidence does not fence legacy decisions');
SELECT lives_ok($$DELETE FROM vote WHERE id='cf000000-0000-4000-8000-000000000007'$$,'Historical migration references do not block legacy deletion');
SELECT throws_ok($$INSERT INTO collaboration_document(kind,entity_id,checksum,state,projection,created_at,updated_at) VALUES('document','cf000000-0000-4000-8000-000000000002','test',decode('0000','hex'),'[]',0,0)$$,'23514',null,'Old clients cannot recreate retired Yjs rooms');
INSERT INTO studio_project(id,owner_id,title,kind,created_at,updated_at) VALUES('cf000000-0000-4000-8000-000000000008','cf000000-0000-4000-8000-000000000001','Preserved','single',0,0);
INSERT INTO studio_state(project_id,state,document,updated_at) VALUES('cf000000-0000-4000-8000-000000000008',decode('0000','hex'),'{}',0);
SELECT throws_ok($$UPDATE studio_state SET document='{"unsafe":true}' WHERE project_id='cf000000-0000-4000-8000-000000000008'$$,'55000','collaboration_legacy_write_rejected','Studio retains its authoritative write fence');
SELECT is(current_setting('polity.collaboration_needs_initialization',true),'on','New Studio records still initialize transactionally');
SELECT is((SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname LIKE 'collaboration_%' AND c.relname IN ('document','blog','amendment_city_design','vote','change_request','document_version')),0,'Migration triggers are absent from legacy editors and decisions');
SELECT ok(NOT has_table_privilege('authenticated','public.collaboration_comment','SELECT'),'Private comments still require server authorization');
SELECT ok(NOT has_table_privilege('authenticated','public.collaboration_command','UPDATE'),'Clients cannot rewrite command receipts');
SELECT ok(NOT has_table_privilege('anon','public.collaboration_migration_attempt','SELECT'),'Migration history remains private');
SELECT has_column('public','collaboration_document','integrity_error','Studio retains integrity diagnostics');
SELECT has_column('public','collaboration_document','integrity_checked_at','Studio retains integrity verification timestamps');
SELECT throws_ok($UPDATE collaboration_ballot_context SET context='{"changed":true}' WHERE vote_id='cf000000-0000-4000-8000-000000000007'$,'55000','collaboration_revision_immutable','Archived ballots remain immutable after their legacy vote is removed');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='collaboration_authority' AND c.relname='studio_state'),'Studio writes retain the transaction authority lock');
SELECT ok(NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname LIKE 'collaboration_%' AND c.relname IN ('app_tutorial_run','vote_choice','agenda_item_change_request','indicative_voter_participation','final_voter_participation')),'Tutorial cleanup and legacy ballots are independent of retired migration guards');
SELECT * FROM finish();
ROLLBACK;

-- @covers schema 36_communication_studio.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);
INSERT INTO public."user"(id,handle) VALUES
('c9100000-0000-0000-0000-000000000001','studio-owner'),
('c9100000-0000-0000-0000-000000000002','studio-member'),
('c9100000-0000-0000-0000-000000000003','studio-outsider');
INSERT INTO public."group"(id,name,owner_id) VALUES
('c9200000-0000-0000-0000-000000000001','Studio group','c9100000-0000-0000-0000-000000000001');
INSERT INTO public.group_membership(group_id,user_id,status) VALUES
('c9200000-0000-0000-0000-000000000001','c9100000-0000-0000-0000-000000000002','member');
INSERT INTO public.studio_project(id,owner_id,group_id,title,kind,created_at,updated_at) VALUES
('c9300000-0000-0000-0000-000000000001','c9100000-0000-0000-0000-000000000001',null,'Personal','single',0,0),
('c9300000-0000-0000-0000-000000000002','c9100000-0000-0000-0000-000000000001','c9200000-0000-0000-0000-000000000001','Group','campaign',0,0);
SELECT ok(public.studio_access('c9100000-0000-0000-0000-000000000001','c9300000-0000-0000-0000-000000000001',true),'Personal owner can edit');
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000001',false),'Group member cannot read personal projects');
SELECT ok(public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',false),'Member can read group project');
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',true),'Member requires editing right');
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000003','c9300000-0000-0000-0000-000000000002',false),'Public group does not expose studio');
UPDATE public.group_membership SET status='admin' WHERE group_id='c9200000-0000-0000-0000-000000000001';
SELECT ok(public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',true),'Group admin can edit');
UPDATE public.group_membership SET status='invited' WHERE group_id='c9200000-0000-0000-0000-000000000001';
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',false),'Inactive membership revokes access');
SELECT ok(NOT has_table_privilege('anon','public.studio_state','SELECT'),'Anonymous cannot read CRDT state');
SELECT ok(NOT has_table_privilege('authenticated','public.studio_revision','SELECT'),'Revisions require server authorization');
SELECT ok(NOT has_table_privilege('authenticated','public.studio_asset','SELECT'),'Assets require server authorization');
SELECT ok(NOT has_table_privilege('authenticated','public.studio_export','INSERT'),'Export requests require server authorization');
SELECT is((SELECT public FROM storage.buckets WHERE id='studio'),false,'Media bucket is private');
SELECT * FROM finish();
ROLLBACK;

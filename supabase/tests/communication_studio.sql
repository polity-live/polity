-- @covers schema 36_communication_studio.sql
-- @covers schema 63_studio_v4_themes_elements.sql
-- @covers schema 64_studio_document_v5.sql
-- @covers schema 65_studio_export_mime_types.sql
-- @covers schema 67_personal_studio_collaborators.sql
-- @covers schema 68_group_studio_project_rights.sql
-- @covers schema 69_retire_whiteboards.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);
SELECT has_table('public','studio_element_set','Studio elements remain available');
SELECT has_table('public','appearance_theme','Studio themes remain available');
SELECT has_column('public','studio_project','document_schema_version','Studio project keeps its document version');
INSERT INTO public."user"(id,handle) VALUES
('c9100000-0000-0000-0000-000000000001','studio-owner'),
('c9100000-0000-0000-0000-000000000002','studio-member'),
('c9100000-0000-0000-0000-000000000003','studio-outsider');
INSERT INTO public."group"(id,name,owner_id) VALUES
('c9200000-0000-0000-0000-000000000001','Studio group','c9100000-0000-0000-0000-000000000001');
INSERT INTO public.group_membership(group_id,user_id,status) VALUES
('c9200000-0000-0000-0000-000000000001','c9100000-0000-0000-0000-000000000002','member');
INSERT INTO public.role(id,name,scope,group_id) VALUES
('c9400000-0000-0000-0000-000000000001','Studio reader','group','c9200000-0000-0000-0000-000000000001');
INSERT INTO public.group_membership_role(group_membership_id,role_id)
SELECT id,'c9400000-0000-0000-0000-000000000001' FROM public.group_membership
WHERE group_id='c9200000-0000-0000-0000-000000000001';
INSERT INTO public.action_right(role_id,group_id,resource,action) VALUES
('c9400000-0000-0000-0000-000000000001','c9200000-0000-0000-0000-000000000001','projects','view');
INSERT INTO public.studio_project(id,owner_id,group_id,title,kind,created_at,updated_at) VALUES
('c9300000-0000-0000-0000-000000000001','c9100000-0000-0000-0000-000000000001',null,'Personal','single',0,0),
('c9300000-0000-0000-0000-000000000002','c9100000-0000-0000-0000-000000000001','c9200000-0000-0000-0000-000000000001','Group','campaign',0,0);
SELECT ok(public.studio_access('c9100000-0000-0000-0000-000000000001','c9300000-0000-0000-0000-000000000001',true),'Personal owner can edit');
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000001',false),'Group member cannot read personal projects');
SELECT ok(public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',false),'Member can read group project');
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',true),'Member requires editing right');
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000003','c9300000-0000-0000-0000-000000000002',false),'Public group does not expose studio');
UPDATE public.group_membership SET status='admin' WHERE group_id='c9200000-0000-0000-0000-000000000001';
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',true),'Admin status alone cannot edit');
INSERT INTO public.action_right(role_id,group_id,resource,action) VALUES
('c9400000-0000-0000-0000-000000000001','c9200000-0000-0000-0000-000000000001','projects','manage');
SELECT ok(public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',true),'Project manage right permits editing');
UPDATE public.group_membership SET status='invited' WHERE group_id='c9200000-0000-0000-0000-000000000001';
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000002',false),'Inactive membership revokes access');
INSERT INTO public.studio_project_collaborator(id,project_id,user_id,invited_by_id,status,created_at,updated_at) VALUES
('c9500000-0000-0000-0000-000000000001','c9300000-0000-0000-0000-000000000001','c9100000-0000-0000-0000-000000000002','c9100000-0000-0000-0000-000000000001','invited',0,0);
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000001',true),'Pending personal invitation cannot edit');
UPDATE public.studio_project_collaborator SET status='active' WHERE id='c9500000-0000-0000-0000-000000000001';
SELECT ok(public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000001',true),'Accepted personal invitation can edit');
UPDATE public.studio_project_collaborator SET status='declined' WHERE id='c9500000-0000-0000-0000-000000000001';
SELECT ok(NOT public.studio_access('c9100000-0000-0000-0000-000000000002','c9300000-0000-0000-0000-000000000001',true),'Revoked personal invitation cannot edit');
SELECT throws_ok($$INSERT INTO public.studio_project(id,owner_id,title,kind,created_at,updated_at) VALUES('c9300000-0000-0000-0000-000000000003','c9100000-0000-0000-0000-000000000001','Retired','whiteboard',0,0)$$,'23514',NULL,'Whiteboard projects cannot be created');
SELECT ok(NOT has_table_privilege('anon','public.studio_state','SELECT'),'Anonymous cannot read CRDT state');
SELECT ok(NOT has_table_privilege('authenticated','public.studio_revision','SELECT'),'Revisions require server authorization');
SELECT ok(NOT has_table_privilege('authenticated','public.studio_asset','SELECT'),'Assets require server authorization');
SELECT ok(NOT has_table_privilege('authenticated','public.studio_export','INSERT'),'Export requests require server authorization');
SELECT ok(EXISTS(SELECT 1 FROM storage.buckets WHERE id='studio'),'Media bucket exists');
SELECT is((SELECT public FROM storage.buckets WHERE id='studio'),false,'Media bucket is private');
SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id='studio'),104857600::bigint,'Media bucket accepts 100 MiB files');
SELECT is(
  (SELECT array_agg(mime ORDER BY mime) FROM storage.buckets,unnest(allowed_mime_types) mime WHERE id='studio'),
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','image/jpeg','image/png','image/webp','video/mp4']::text[],
  'Studio bucket allows media and export MIME types'
);
SELECT * FROM finish();
ROLLBACK;

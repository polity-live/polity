-- @covers schema 70_studio_visibility_discovery.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

INSERT INTO public."user" (id,handle) VALUES
 ('f9200000-0000-4000-a000-000000000001','studio-visible-owner'),
 ('f9200000-0000-4000-a000-000000000002','studio-visible-reader'),
 ('f9200000-0000-4000-a000-000000000003','studio-visible-outsider');

INSERT INTO public."group" (id,name,owner_id,visibility) VALUES
 ('f9210000-0000-4000-a000-000000000001','Private studio group',
  'f9200000-0000-4000-a000-000000000001','private');

INSERT INTO public.studio_project (id,owner_id,group_id,title,kind,created_at,updated_at) VALUES
 ('f9220000-0000-4000-a000-000000000001','f9200000-0000-4000-a000-000000000001',NULL,'Personal Studio','single',1000,1000),
 ('f9220000-0000-4000-a000-000000000002','f9200000-0000-4000-a000-000000000001','f9210000-0000-4000-a000-000000000001','Group Studio','single',1000,1000);

SELECT is((SELECT visibility FROM public.studio_project WHERE id='f9220000-0000-4000-a000-000000000001'),'private','Existing-style inserts default to private');
SELECT ok(public.studio_access('f9200000-0000-4000-a000-000000000001','f9220000-0000-4000-a000-000000000001',false),'Owner reads private project');
SELECT ok(NOT public.studio_access('f9200000-0000-4000-a000-000000000003','f9220000-0000-4000-a000-000000000001',false),'Outsider cannot read private project');
SELECT ok(NOT public.studio_access(NULL,'f9220000-0000-4000-a000-000000000001',false),'Guest cannot read private project');
SELECT ok(public.studio_access('f9200000-0000-4000-a000-000000000001','f9220000-0000-4000-a000-000000000002',false),'Owner reads private group project');
SELECT ok(NOT public.studio_access('f9200000-0000-4000-a000-000000000003','f9220000-0000-4000-a000-000000000002',false),'Outsider cannot read private group project');
SELECT ok(EXISTS(SELECT 1 FROM public.search_document WHERE id='studio:f9220000-0000-4000-a000-000000000001' AND visibility='private'),'Private studio has a search projection');
SELECT ok(EXISTS(SELECT 1 FROM public.search_document_acl WHERE document_id='studio:f9220000-0000-4000-a000-000000000001' AND user_id='f9200000-0000-4000-a000-000000000001'),'Owner has private search ACL');

INSERT INTO public.studio_project_collaborator(id,project_id,user_id,invited_by_id,status,created_at,updated_at)
VALUES ('f9230000-0000-4000-a000-000000000001','f9220000-0000-4000-a000-000000000001',
 'f9200000-0000-4000-a000-000000000002','f9200000-0000-4000-a000-000000000001','active',1000,1000);
SELECT ok(public.studio_access('f9200000-0000-4000-a000-000000000002','f9220000-0000-4000-a000-000000000001',false),'Active collaborator reads private project');
SELECT ok(EXISTS(SELECT 1 FROM public.search_document_acl WHERE document_id='studio:f9220000-0000-4000-a000-000000000001' AND user_id='f9200000-0000-4000-a000-000000000002'),'Active collaborator gains search ACL');

INSERT INTO public.group_membership(group_id,user_id,status)
VALUES ('f9210000-0000-4000-a000-000000000001','f9200000-0000-4000-a000-000000000002','member');
INSERT INTO public.role(id,name,scope,group_id)
VALUES ('f9240000-0000-4000-a000-000000000001','Studio viewer','group','f9210000-0000-4000-a000-000000000001');
INSERT INTO public.group_membership_role(group_membership_id,role_id)
SELECT id,'f9240000-0000-4000-a000-000000000001' FROM public.group_membership
WHERE group_id='f9210000-0000-4000-a000-000000000001';
SELECT ok(NOT public.studio_access('f9200000-0000-4000-a000-000000000002','f9220000-0000-4000-a000-000000000002',false),'Membership alone does not read private group project');
INSERT INTO public.action_right(role_id,group_id,resource,action)
VALUES ('f9240000-0000-4000-a000-000000000001','f9210000-0000-4000-a000-000000000001','projects','view');
SELECT ok(public.studio_access('f9200000-0000-4000-a000-000000000002','f9220000-0000-4000-a000-000000000002',false),'Project view right reads private group project');
SELECT ok(EXISTS(SELECT 1 FROM public.search_document_acl WHERE document_id='studio:f9220000-0000-4000-a000-000000000002' AND user_id='f9200000-0000-4000-a000-000000000002'),'Group view right adds private search ACL');
DELETE FROM public.action_right WHERE role_id='f9240000-0000-4000-a000-000000000001';
SELECT ok(NOT EXISTS(SELECT 1 FROM public.search_document_acl WHERE document_id='studio:f9220000-0000-4000-a000-000000000002' AND user_id='f9200000-0000-4000-a000-000000000002'),'Removing view right revokes private search ACL');

UPDATE public.studio_project SET visibility='authenticated' WHERE id='f9220000-0000-4000-a000-000000000001';
SELECT ok(public.studio_access('f9200000-0000-4000-a000-000000000003','f9220000-0000-4000-a000-000000000001',false),'Any signed-in user reads authenticated project');
SELECT ok(NOT public.studio_access(NULL,'f9220000-0000-4000-a000-000000000001',false),'Guest cannot read authenticated project');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.search_document_acl WHERE document_id='studio:f9220000-0000-4000-a000-000000000001'),'Authenticated project needs no private ACL');

UPDATE public.studio_project SET visibility='public' WHERE id='f9220000-0000-4000-a000-000000000002';
SELECT ok(public.studio_access(NULL,'f9220000-0000-4000-a000-000000000002',false),'Guest reads public project of private group');
SELECT ok(NOT public.studio_access('f9200000-0000-4000-a000-000000000003','f9220000-0000-4000-a000-000000000002',true),'Public reader cannot edit project');
SELECT ok(NOT public.studio_collaboration_access(NULL,'f9220000-0000-4000-a000-000000000002'),'Guest cannot join internal collaboration');
SELECT ok(NOT public.studio_collaboration_access('f9200000-0000-4000-a000-000000000003','f9220000-0000-4000-a000-000000000002'),'Public outsider cannot join internal collaboration');
SELECT ok(NOT public.canvas_capability('f9200000-0000-4000-a000-000000000003','f9220000-0000-4000-a000-000000000002','comment'),'Public outsider cannot comment in internal procedure');

SELECT * FROM finish();
ROLLBACK;

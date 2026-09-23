-- @covers schema 54_canvas_workflows.sql
-- @covers schema 55_canvas_capabilities.sql
-- @covers schema 56_canvas_authority_lock.sql
-- @covers schema 57_canvas_private_assets.sql
-- @covers schema 58_canvas_recipient_presence.sql
-- @covers schema 59_canvas_zero_workspaces.sql
-- @covers schema 60_canvas_conflict_resolution.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(25);
INSERT INTO public."user"(id) VALUES('ca100000-0000-4000-8000-000000000001'),('ca100000-0000-4000-8000-000000000002');
INSERT INTO public."group"(id,name,owner_id) VALUES('ca200000-0000-4000-8000-000000000001','Canvas SQL','ca100000-0000-4000-8000-000000000001');
INSERT INTO public.group_membership(id,group_id,user_id,status) VALUES('ca300000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000002','member');
INSERT INTO public.studio_project(id,owner_id,group_id,title,kind,created_at,updated_at) VALUES('ca400000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000001','Canvas SQL','whiteboard',0,0);
INSERT INTO public.studio_state(project_id,document,updated_at) VALUES('ca400000-0000-4000-8000-000000000001','{"title":"original"}',0);
SELECT is((SELECT count(*)::int FROM canvas_history WHERE project_id='ca400000-0000-4000-8000-000000000001'),1,'Initial content is recorded');
UPDATE canvas_control SET phase='vote_internal' WHERE project_id='ca400000-0000-4000-8000-000000000001';
SELECT throws_ok($$UPDATE studio_state SET document='{"title":"bypass"}',content_revision=1 WHERE project_id='ca400000-0000-4000-8000-000000000001'$$,'P0001','Canvas content is locked by its procedure','Direct content replacement cannot bypass voting');
UPDATE canvas_control SET phase='edit' WHERE project_id='ca400000-0000-4000-8000-000000000001';
SELECT ok(canvas_capability('ca100000-0000-4000-8000-000000000002','ca400000-0000-4000-8000-000000000001','suggest'),'Members may propose');
SELECT ok(NOT canvas_capability('ca100000-0000-4000-8000-000000000002','ca400000-0000-4000-8000-000000000001','edit'),'Proposal capability does not grant editing');
INSERT INTO canvas_proposal(id,project_id,owner_id,title,base_document,base_revision,base_generation,document,created_at,updated_at) SELECT 'ca500000-0000-4000-8000-000000000001',project_id,'ca100000-0000-4000-8000-000000000002','Private draft','{}',0,generation,'{}',0,0 FROM canvas_control WHERE project_id='ca400000-0000-4000-8000-000000000001';
SELECT ok(NOT canvas_proposal_access('ca100000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001'),'Group owner cannot read a private draft');
UPDATE canvas_proposal SET shared_ids=ARRAY['ca100000-0000-4000-8000-000000000001'::uuid] WHERE id='ca500000-0000-4000-8000-000000000001';
SELECT ok(canvas_proposal_access('ca100000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001'),'Explicit share grants draft access');
SELECT is((SELECT count(*)::int FROM canvas_workspace_reader WHERE workspace_id='ca500000-0000-4000-8000-000000000001'),1,'Zero receives normalized explicit readers');
UPDATE canvas_proposal SET shared_ids='{}',state='withdrawn' WHERE id='ca500000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::int FROM canvas_workspace_reader WHERE workspace_id='ca500000-0000-4000-8000-000000000001'),0,'Removing sharing removes Zero readers');
SELECT ok(NOT canvas_proposal_access('ca100000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001'),'Withdrawing a private draft does not publish it');
INSERT INTO role(id,name,group_id) VALUES('ca600000-0000-4000-8000-000000000001','Restricted','ca200000-0000-4000-8000-000000000001');
INSERT INTO group_membership_role(group_membership_id,role_id) VALUES('ca300000-0000-4000-8000-000000000001','ca600000-0000-4000-8000-000000000001');
INSERT INTO canvas_role_capability(role_id,capability,allowed) VALUES('ca600000-0000-4000-8000-000000000001','vote',false);
SELECT ok(NOT canvas_capability('ca100000-0000-4000-8000-000000000002','ca400000-0000-4000-8000-000000000001','vote'),'A role can revoke voting independently');
SELECT ok(canvas_capability('ca100000-0000-4000-8000-000000000002','ca400000-0000-4000-8000-000000000001','comment'),'Revoking voting preserves commenting');
SELECT ok(EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND objid=1886351981),'Authority writes acquire the common transaction lock');
INSERT INTO studio_asset(id,project_id,workspace_id,name,mime_type,byte_size,storage_path,ready,created_at) VALUES('ca700000-0000-4000-8000-000000000001','ca400000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001','Draft image','image/png',1,'test/private',false,0);
SELECT is((SELECT workspace_id FROM studio_asset WHERE id='ca700000-0000-4000-8000-000000000001'),'ca500000-0000-4000-8000-000000000001'::uuid,'Media retains its private workspace');
SELECT ok(NOT has_table_privilege('authenticated','canvas_proposal','SELECT'),'Drafts cannot bypass authorized queries');
SELECT ok(NOT has_table_privilege('authenticated','canvas_vote','UPDATE'),'Votes cannot bypass server commands');
SELECT ok(NOT has_table_privilege('authenticated','canvas_workspace_reader','INSERT'),'Clients cannot grant themselves draft access');
SELECT set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000002',true);
SELECT ok(canvas_presence_access('canvas-user:ca400000-0000-4000-8000-000000000001:main:ca100000-0000-4000-8000-000000000002'),'Members may receive their own presence stream');
SELECT ok(NOT canvas_presence_access('canvas-user:ca400000-0000-4000-8000-000000000001:main:ca100000-0000-4000-8000-000000000001'),'Members cannot subscribe to another recipient');
UPDATE group_membership SET status='requested' WHERE id='ca300000-0000-4000-8000-000000000001';
SELECT ok(NOT canvas_presence_access('canvas-user:ca400000-0000-4000-8000-000000000001:main:ca100000-0000-4000-8000-000000000002'),'Membership revocation denies channel access');
SELECT ok(NOT canvas_capability('ca100000-0000-4000-8000-000000000002','ca400000-0000-4000-8000-000000000001','comment'),'Membership revocation denies comments');
UPDATE canvas_proposal SET state='closed',decision='accepted',application='superseded' WHERE id='ca500000-0000-4000-8000-000000000001';
SELECT is((SELECT decision FROM canvas_proposal WHERE id='ca500000-0000-4000-8000-000000000001'),'accepted','Resolving application does not reinterpret a decision');
SELECT throws_ok($$UPDATE canvas_proposal SET application='changed_decision' WHERE id='ca500000-0000-4000-8000-000000000001'$$,'23514',NULL,'Unknown application state is refused');
SELECT ok(NOT has_table_privilege('authenticated','canvas_history','UPDATE'),'Clients cannot rewrite revision evidence');
SELECT set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000001',true);
SELECT ok(NOT canvas_presence_access('canvas-user:ca400000-0000-4000-8000-000000000001:ca500000-0000-4000-8000-000000000001:ca100000-0000-4000-8000-000000000001'),'Owning the group does not grant private draft presence');
SELECT ok(NOT has_function_privilege('authenticated','canvas_capability(uuid,uuid,text)','EXECUTE'),'Capability checks are server-only');
SELECT * FROM finish();
ROLLBACK;

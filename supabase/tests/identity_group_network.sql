-- @covers schema 01_user.sql
-- @covers schema 02_group.sql
-- @covers schema 05_1_network.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(62);

CREATE OR REPLACE FUNCTION pg_temp.capture_sqlstate(command TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE command;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

INSERT INTO public."user" (id, handle)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'network-user-1'),
  ('a1000000-0000-0000-0000-000000000002', 'network-user-2'),
  ('a1000000-0000-0000-0000-000000000003', 'network-user-3');

INSERT INTO public.file (id, path, url)
VALUES ('a1100000-0000-0000-0000-000000000001', 'network/file', 'https://test.invalid/file');

INSERT INTO public."group" (id, name, owner_id, group_type)
VALUES
  ('a2000000-0000-0000-0000-000000000001', 'Network A', 'a1000000-0000-0000-0000-000000000001', 'hierarchical'),
  ('a2000000-0000-0000-0000-000000000002', 'Network B', 'a1000000-0000-0000-0000-000000000001', 'base'),
  ('a2000000-0000-0000-0000-000000000003', 'Network C', 'a1000000-0000-0000-0000-000000000002', 'base'),
  ('a2000000-0000-0000-0000-000000000004', 'Network D', 'a1000000-0000-0000-0000-000000000003', 'base');

INSERT INTO public.role (id, name, group_id)
VALUES ('a3000000-0000-0000-0000-000000000001', 'Network role', 'a2000000-0000-0000-0000-000000000001');

INSERT INTO public.role_holder_history (id, role_id, user_id)
VALUES ('a3100000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

INSERT INTO public.group_membership (id, group_id, user_id, status)
VALUES
  ('a4000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'active'),
  ('a4000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'active');

INSERT INTO public.group_membership_origin (
  id, group_membership_id, origin_kind, source_group_id
)
VALUES (
  'a4100000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001',
  'direct',
  'a2000000-0000-0000-0000-000000000001'
);

INSERT INTO public.group_membership_role (id, group_membership_id, role_id)
VALUES ('a4200000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001');

INSERT INTO public.group_offline_member (id, group_id, first_name, last_name)
VALUES ('a4300000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Offline', 'Member');

INSERT INTO public.group_offline_membership (id, group_offline_member_id, group_id)
VALUES ('a4400000-0000-0000-0000-000000000001', 'a4300000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001');

INSERT INTO public.group_offline_membership_role (
  id, group_offline_membership_id, role_id
)
VALUES ('a4500000-0000-0000-0000-000000000001', 'a4400000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001');

INSERT INTO public.group_guest_access (id, group_id, user_id, status)
VALUES ('a4600000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'active');

INSERT INTO public.group_guest_role (id, group_guest_access_id, role_id)
VALUES ('a4700000-0000-0000-0000-000000000001', 'a4600000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001');

INSERT INTO public.action_right (id, resource, action, role_id, group_id)
VALUES ('a4800000-0000-0000-0000-000000000001', 'group', 'read', 'a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001');

INSERT INTO public.follow (id, follower_id, followee_id)
VALUES ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');

INSERT INTO public.group_connection (
  id, group_a_id, group_b_id, connection_type, connection_kind,
  parent_group_id, child_group_id, created_by_id
)
VALUES (
  'a5100000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'hierarchy',
  'hierarchy',
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000001'
);

INSERT INTO public.group_right_grant (
  id, connection_id, right_key, holder_group_id, scope_group_id
)
VALUES (
  'a5200000-0000-0000-0000-000000000001',
  'a5100000-0000-0000-0000-000000000001',
  'informationRight',
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002'
);

INSERT INTO public.group_membership_rule (
  id, connection_id, member_source_group_id, member_target_group_id, membership_mode
)
VALUES (
  'a5300000-0000-0000-0000-000000000001',
  'a5100000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'all_members'
);

INSERT INTO public.group_membership_rule_origin (
  id, membership_rule_id, eligible_origin_group_id
)
VALUES ('a5400000-0000-0000-0000-000000000001', 'a5300000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001');

INSERT INTO public.group_hierarchy_path (
  id, ancestor_group_id, descendant_group_id, direct_child_group_id,
  base_group_id, depth, path_group_ids, connection_id
)
VALUES (
  'a5500000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000001',
  1,
  ARRAY['a2000000-0000-0000-0000-000000000001'::UUID, 'a2000000-0000-0000-0000-000000000002'::UUID],
  'a5100000-0000-0000-0000-000000000001'
);

INSERT INTO public.group_effective_right (
  id, holder_group_id, scope_group_id, right_key, source_connection_id, source_grant_id
)
VALUES (
  'a5600000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'informationRight',
  'a5100000-0000-0000-0000-000000000001',
  'a5200000-0000-0000-0000-000000000001'
);

INSERT INTO public.group_membership_exclusivity_lock (
  id, user_id, hierarchy_group_id, source_group_id, group_membership_id
)
VALUES ('a5700000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001');

INSERT INTO public.group_sibling_source_lock (
  id, user_id, sibling_group_id, source_group_id, group_membership_id
)
VALUES ('a5800000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001');

INSERT INTO public.group_connection_request (
  id, proposed_connection_id, group_a_id, group_b_id,
  desired_connection_type, initiator_group_id
)
VALUES (
  'a5900000-0000-0000-0000-000000000001',
  'a5900000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000003',
  'a2000000-0000-0000-0000-000000000004',
  'peer',
  'a2000000-0000-0000-0000-000000000003'
);

INSERT INTO public.group_right_grant_request (
  id, connection_request_id, operation, right_key,
  holder_group_id, scope_group_id, initiator_group_id
)
VALUES (
  'a5a00000-0000-0000-0000-000000000001',
  'a5900000-0000-0000-0000-000000000001',
  'upsert',
  'informationRight',
  'a2000000-0000-0000-0000-000000000003',
  'a2000000-0000-0000-0000-000000000004',
  'a2000000-0000-0000-0000-000000000003'
);

INSERT INTO public.group_membership_rule_request (
  id, connection_request_id, operation, member_source_group_id,
  member_target_group_id, membership_mode
)
VALUES (
  'a5b00000-0000-0000-0000-000000000001',
  'a5900000-0000-0000-0000-000000000001',
  'upsert',
  'a2000000-0000-0000-0000-000000000003',
  'a2000000-0000-0000-0000-000000000004',
  'all_members'
);

INSERT INTO public.group_membership_rule_request_origin (
  id, membership_rule_request_id, eligible_origin_group_id
)
VALUES ('a5c00000-0000-0000-0000-000000000001', 'a5b00000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003');

INSERT INTO public.subscriber (id, subscriber_id, group_id)
VALUES ('a5d00000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001');

INSERT INTO public.group_workflow (
  id, group_id, start_group_id, name, is_default_entry, created_by_id
)
VALUES ('a5e00000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Default workflow', true, 'a1000000-0000-0000-0000-000000000001');

INSERT INTO public.group_workflow_approval (
  id, workflow_id, group_id, requested_by_group_id
)
VALUES ('a5f00000-0000-0000-0000-000000000001', 'a5e00000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001');

INSERT INTO public.group_workflow_step (id, workflow_id, group_id, order_index)
VALUES ('a6000000-0000-0000-0000-000000000001', 'a5e00000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 1);

SELECT ok(
  EXISTS (SELECT 1 FROM public.file WHERE id = 'a1100000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.role_holder_history WHERE id = 'a3100000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.group_offline_membership_role WHERE id = 'a4500000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.group_membership_rule_request_origin WHERE id = 'a5c00000-0000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.group_workflow_step WHERE id = 'a6000000-0000-0000-0000-000000000001'),
  'a complete identity, membership, network, request, and workflow graph is accepted'
);

SELECT is(
  pg_temp.capture_sqlstate(
    $sql$
      UPDATE public."group"
      SET
        group_type = 'institution',
        primary_sibling_membership_mode = 'selected_source_groups',
        sibling_membership_mode = 'parliament'
      WHERE id = 'a2000000-0000-0000-0000-000000000004'
    $sql$
  ),
  NULL,
  'group enum boundaries accept their final documented values'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public."user" SET gender = 'invalid' WHERE id = 'a1000000-0000-0000-0000-000000000001'$sql$), '23514', 'user gender is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public."group" SET group_type = 'invalid' WHERE id = 'a2000000-0000-0000-0000-000000000004'$sql$), '23514', 'group type is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public."group" SET primary_sibling_membership_mode = 'invalid' WHERE id = 'a2000000-0000-0000-0000-000000000004'$sql$), '23514', 'primary sibling membership mode is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public."group" SET sibling_membership_mode = 'invalid' WHERE id = 'a2000000-0000-0000-0000-000000000004'$sql$), '23514', 'sibling membership mode is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.role SET assignment_mode = 'invalid' WHERE id = 'a3000000-0000-0000-0000-000000000001'$sql$), '23514', 'role assignment mode is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.role SET visibility = 'invalid' WHERE id = 'a3000000-0000-0000-0000-000000000001'$sql$), '23514', 'role visibility is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.role SET assignee_kind = 'invalid' WHERE id = 'a3000000-0000-0000-0000-000000000001'$sql$), '23514', 'role assignee kind is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership SET origin_kind = 'invalid' WHERE id = 'a4000000-0000-0000-0000-000000000001'$sql$), '23514', 'membership origin kind is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_origin SET origin_kind = 'invalid' WHERE id = 'a4100000-0000-0000-0000-000000000001'$sql$), '23514', 'membership provenance kind is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_guest_access SET status = 'invalid' WHERE id = 'a4600000-0000-0000-0000-000000000001'$sql$), '23514', 'guest access status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_right_grant SET scope_group_id = holder_group_id WHERE id = 'a5200000-0000-0000-0000-000000000001'$sql$), '23514', 'right grants require different endpoints');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_rule SET member_target_group_id = member_source_group_id WHERE id = 'a5300000-0000-0000-0000-000000000001'$sql$), '23514', 'membership rules require different endpoints');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_rule SET membership_mode = 'invalid' WHERE id = 'a5300000-0000-0000-0000-000000000001'$sql$), '23514', 'membership rule mode is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_rule SET membership_mode = 'role_members', required_source_role_id = NULL WHERE id = 'a5300000-0000-0000-0000-000000000001'$sql$), '23514', 'role membership rules require a source role');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_hierarchy_path SET descendant_group_id = ancestor_group_id WHERE id = 'a5500000-0000-0000-0000-000000000001'$sql$), '23514', 'hierarchy paths require different endpoints');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_hierarchy_path SET status = 'invalid' WHERE id = 'a5500000-0000-0000-0000-000000000001'$sql$), '23514', 'hierarchy path status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_effective_right SET scope_group_id = holder_group_id WHERE id = 'a5600000-0000-0000-0000-000000000001'$sql$), '23514', 'effective rights require different endpoints');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_effective_right SET right_key = 'invalid' WHERE id = 'a5600000-0000-0000-0000-000000000001'$sql$), '23514', 'effective right key is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_effective_right SET status = 'invalid' WHERE id = 'a5600000-0000-0000-0000-000000000001'$sql$), '23514', 'effective right status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_exclusivity_lock SET status = 'invalid' WHERE id = 'a5700000-0000-0000-0000-000000000001'$sql$), '23514', 'exclusivity lock status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_sibling_source_lock SET status = 'invalid' WHERE id = 'a5800000-0000-0000-0000-000000000001'$sql$), '23514', 'sibling lock status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_connection_request SET group_a_id = group_b_id WHERE id = 'a5900000-0000-0000-0000-000000000001'$sql$), '23514', 'connection requests require a canonical pair');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_connection_request SET desired_connection_type = 'invalid' WHERE id = 'a5900000-0000-0000-0000-000000000001'$sql$), '23514', 'requested connection type is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_connection_request SET structure_status = 'invalid' WHERE id = 'a5900000-0000-0000-0000-000000000001'$sql$), '23514', 'connection request structure status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_connection_request SET status = 'invalid' WHERE id = 'a5900000-0000-0000-0000-000000000001'$sql$), '23514', 'connection request status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_connection_request SET desired_connection_type = 'hierarchy' WHERE id = 'a5900000-0000-0000-0000-000000000001'$sql$), '23514', 'hierarchy requests require parent and child endpoints');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_right_grant_request SET operation = 'invalid' WHERE id = 'a5a00000-0000-0000-0000-000000000001'$sql$), '23514', 'right grant request operation is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_right_grant_request SET scope_group_id = holder_group_id WHERE id = 'a5a00000-0000-0000-0000-000000000001'$sql$), '23514', 'right grant requests require different endpoints');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_right_grant_request SET status = 'invalid' WHERE id = 'a5a00000-0000-0000-0000-000000000001'$sql$), '23514', 'right grant request status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_rule_request SET operation = 'invalid' WHERE id = 'a5b00000-0000-0000-0000-000000000001'$sql$), '23514', 'membership rule request operation is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_rule_request SET membership_mode = 'role_members', required_source_role_id = NULL WHERE id = 'a5b00000-0000-0000-0000-000000000001'$sql$), '23514', 'membership rule request shape is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_membership_rule_request SET status = 'invalid' WHERE id = 'a5b00000-0000-0000-0000-000000000001'$sql$), '23514', 'membership rule request status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_connection SET connection_type = 'invalid' WHERE id = 'a5100000-0000-0000-0000-000000000001'$sql$), '23514', 'group connection type is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.group_connection SET connection_kind = 'invalid' WHERE id = 'a5100000-0000-0000-0000-000000000001'$sql$), '23514', 'group connection kind is constrained');

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_exclusivity_lock (user_id, hierarchy_group_id, source_group_id, group_membership_id) VALUES ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002')$sql$), '23505', 'only one active exclusivity lock is allowed');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_exclusivity_lock (user_id, hierarchy_group_id, source_group_id, group_membership_id, status) VALUES ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002', 'inactive')$sql$), NULL, 'inactive exclusivity locks may coexist');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_sibling_source_lock (user_id, sibling_group_id, source_group_id, group_membership_id) VALUES ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002')$sql$), '23505', 'only one active sibling source lock is allowed');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_sibling_source_lock (user_id, sibling_group_id, source_group_id, group_membership_id, status) VALUES ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', 'inactive')$sql$), NULL, 'inactive sibling source locks are outside active uniqueness');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_workflow (group_id, name, is_default_entry, created_by_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'Duplicate default', true, 'a1000000-0000-0000-0000-000000000001')$sql$), '23505', 'a group has only one default workflow');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_workflow (group_id, name, is_default_entry, created_by_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'Non-default workflow', false, 'a1000000-0000-0000-0000-000000000001')$sql$), NULL, 'non-default workflows are outside default-entry uniqueness');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_workflow_approval (workflow_id, group_id, requested_by_group_id) VALUES ('a5e00000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001')$sql$), '23505', 'workflow approval is unique per participating group');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public."user" (handle) VALUES ('network-user-1')$sql$), '23505', 'user handles are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_connection_request (proposed_connection_id, group_a_id, group_b_id, desired_connection_type, initiator_group_id) VALUES ('a5900000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000004', 'peer', 'a2000000-0000-0000-0000-000000000003')$sql$), '23505', 'group connection requests are unique per canonical pair');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_effective_right (holder_group_id, scope_group_id, right_key, source_connection_id, source_grant_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'informationRight', 'a5100000-0000-0000-0000-000000000001', 'a5200000-0000-0000-0000-000000000001')$sql$), '23505', 'effective rights are unique per derivation');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_guest_access (group_id, user_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002')$sql$), '23505', 'guest access is unique per group and user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_guest_role (group_guest_access_id, role_id) VALUES ('a4600000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001')$sql$), '23505', 'guest roles are unique per guest access');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_hierarchy_path (ancestor_group_id, descendant_group_id, direct_child_group_id, base_group_id, depth, path_group_ids) VALUES ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 1, ARRAY['a2000000-0000-0000-0000-000000000001'::UUID, 'a2000000-0000-0000-0000-000000000002'::UUID])$sql$), '23505', 'hierarchy paths are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership (group_id, user_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001')$sql$), '23505', 'group membership is unique per user and group');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_role (group_membership_id, role_id) VALUES ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001')$sql$), '23505', 'membership roles are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_rule (connection_id, member_source_group_id, member_target_group_id, membership_mode) VALUES ('a5100000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'all_members')$sql$), '23505', 'a connection has only one membership rule');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_rule_origin (membership_rule_id, eligible_origin_group_id) VALUES ('a5300000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001')$sql$), '23505', 'membership-rule origins are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_rule_request (connection_request_id, operation, member_source_group_id, member_target_group_id, membership_mode) VALUES ('a5900000-0000-0000-0000-000000000001', 'upsert', 'a2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000004', 'all_members')$sql$), '23505', 'a connection request has only one membership-rule request');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_rule_request_origin (membership_rule_request_id, eligible_origin_group_id) VALUES ('a5b00000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003')$sql$), '23505', 'membership-rule request origins are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_offline_membership (group_offline_member_id, group_id) VALUES ('a4300000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001')$sql$), '23505', 'offline memberships are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_offline_membership_role (group_offline_membership_id, role_id) VALUES ('a4400000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001')$sql$), '23505', 'offline membership roles are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_right_grant (connection_id, right_key, holder_group_id, scope_group_id) VALUES ('a5100000-0000-0000-0000-000000000001', 'informationRight', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002')$sql$), '23505', 'right grants are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_right_grant_request (connection_request_id, operation, right_key, holder_group_id, scope_group_id, initiator_group_id) VALUES ('a5900000-0000-0000-0000-000000000001', 'upsert', 'informationRight', 'a2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000003')$sql$), '23505', 'right-grant requests are unique');

INSERT INTO public.group_membership_origin (
  id, group_membership_id, origin_kind, source_group_id, connection_id,
  membership_rule_id, source_role_id
)
VALUES (
  'a4100000-0000-0000-0000-000000000002',
  'a4000000-0000-0000-0000-000000000002',
  'hierarchy',
  'a2000000-0000-0000-0000-000000000001',
  'a5100000-0000-0000-0000-000000000001',
  'a5300000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001'
);

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_membership_origin (group_membership_id, origin_kind, source_group_id, connection_id, membership_rule_id, source_role_id) VALUES ('a4000000-0000-0000-0000-000000000002', 'hierarchy', 'a2000000-0000-0000-0000-000000000001', 'a5100000-0000-0000-0000-000000000001', 'a5300000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001')$sql$), '23505', 'fully specified membership origins are unique');

INSERT INTO public.group_offline_member (
  id, group_id, first_name, last_name, connected_user_id
)
VALUES (
  'a4300000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000002',
  'Connected',
  'Member',
  'a1000000-0000-0000-0000-000000000002'
);

SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.group_offline_member (group_id, first_name, last_name, connected_user_id) VALUES ('a2000000-0000-0000-0000-000000000002', 'Duplicate', 'Connected', 'a1000000-0000-0000-0000-000000000002')$sql$), '23505', 'connected offline members are unique per group');

DELETE FROM public.group_connection
WHERE id = 'a5100000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT
      (SELECT count(*) FROM public.group_right_grant WHERE id = 'a5200000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.group_membership_rule WHERE id = 'a5300000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.group_hierarchy_path WHERE id = 'a5500000-0000-0000-0000-000000000001')
      + (SELECT count(*) FROM public.group_effective_right WHERE id = 'a5600000-0000-0000-0000-000000000001')
  )::INTEGER,
  0,
  'deleting a connection removes all materialized derivatives'
);

SELECT * FROM finish();

ROLLBACK;

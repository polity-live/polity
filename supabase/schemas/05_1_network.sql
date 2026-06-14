-- =============================================================================
-- 19_network.sql — Social graph: follows, group relationships, subscribers
-- Depends on: 01_user (user), 02_group (group)
-- =============================================================================

-- Follow table
CREATE TABLE IF NOT EXISTS public.follow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_follow_follower ON public.follow (follower_id);
CREATE INDEX idx_follow_followee ON public.follow (followee_id);

ALTER TABLE public.follow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.follow FOR ALL TO service_role USING (true);

-- Directionless container for exactly one connection per unordered group pair.
CREATE TABLE IF NOT EXISTS public.group_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_a_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  group_b_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('hierarchy', 'peer')),
  parent_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  child_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_connection_canonical_pair_check CHECK (group_a_id < group_b_id),
  CONSTRAINT group_connection_structure_check CHECK (
    (
      connection_type = 'peer'
      AND parent_group_id IS NULL
      AND child_group_id IS NULL
    ) OR (
      connection_type = 'hierarchy'
      AND parent_group_id IS NOT NULL
      AND child_group_id IS NOT NULL
      AND parent_group_id <> child_group_id
      AND (
        (parent_group_id = group_a_id AND child_group_id = group_b_id)
        OR (parent_group_id = group_b_id AND child_group_id = group_a_id)
      )
    )
  ),
  UNIQUE (group_a_id, group_b_id)
);

CREATE INDEX idx_group_connection_group_a ON public.group_connection (group_a_id);
CREATE INDEX idx_group_connection_group_b ON public.group_connection (group_b_id);
CREATE INDEX idx_group_connection_parent ON public.group_connection (parent_group_id);
CREATE INDEX idx_group_connection_child ON public.group_connection (child_group_id);
CREATE INDEX idx_group_connection_type ON public.group_connection (connection_type);

ALTER TABLE public.group_connection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_connection FOR ALL TO service_role USING (true);

-- One row is one unambiguous grant: holder has right_key in scope.
CREATE TABLE IF NOT EXISTS public.group_right_grant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.group_connection (id) ON DELETE CASCADE,
  right_key TEXT NOT NULL,
  holder_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  scope_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  initiator_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_right_grant_endpoints_check CHECK (holder_group_id <> scope_group_id),
  UNIQUE (connection_id, right_key, holder_group_id, scope_group_id)
);

CREATE INDEX idx_group_right_grant_connection ON public.group_right_grant (connection_id);
CREATE INDEX idx_group_right_grant_holder ON public.group_right_grant (holder_group_id);
CREATE INDEX idx_group_right_grant_scope ON public.group_right_grant (scope_group_id);
CREATE INDEX idx_group_right_grant_traversal
  ON public.group_right_grant (holder_group_id, right_key, status);
CREATE INDEX idx_group_right_grant_initiator ON public.group_right_grant (initiator_group_id);

ALTER TABLE public.group_right_grant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_right_grant FOR ALL TO service_role USING (true);

-- At most one directed membership flow per connection.
CREATE TABLE IF NOT EXISTS public.group_membership_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.group_connection (id) ON DELETE CASCADE,
  member_source_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  member_target_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  membership_mode TEXT NOT NULL,
  required_source_role_id UUID REFERENCES public.role (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_membership_rule_endpoints_check
    CHECK (member_source_group_id <> member_target_group_id),
  CONSTRAINT group_membership_rule_mode_check
    CHECK (membership_mode IN ('all_members', 'role_members', 'selected_source_groups')),
  CONSTRAINT group_membership_rule_mode_fields_check
    CHECK (
      (membership_mode IN ('all_members', 'selected_source_groups')
        AND required_source_role_id IS NULL)
      OR (
        membership_mode = 'role_members'
        AND required_source_role_id IS NOT NULL
      )
    ),
  UNIQUE (connection_id)
);

CREATE INDEX idx_group_membership_rule_connection
  ON public.group_membership_rule (connection_id);
CREATE INDEX idx_group_membership_rule_source
  ON public.group_membership_rule (member_source_group_id);
CREATE INDEX idx_group_membership_rule_target
  ON public.group_membership_rule (member_target_group_id);
CREATE INDEX idx_group_membership_rule_mode
  ON public.group_membership_rule (membership_mode);

ALTER TABLE public.group_membership_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership_rule FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.group_membership_rule_origin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_rule_id UUID NOT NULL REFERENCES public.group_membership_rule (id) ON DELETE CASCADE,
  eligible_origin_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membership_rule_id, eligible_origin_group_id)
);

CREATE INDEX idx_group_membership_rule_origin_rule
  ON public.group_membership_rule_origin (membership_rule_id);
CREATE INDEX idx_group_membership_rule_origin_group
  ON public.group_membership_rule_origin (eligible_origin_group_id);

ALTER TABLE public.group_membership_rule_origin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership_rule_origin
  FOR ALL TO service_role USING (true);

-- Normalized change request header. Structure must be accepted before child items.
CREATE TABLE IF NOT EXISTS public.group_connection_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_connection_id UUID REFERENCES public.group_connection (id) ON DELETE SET NULL,
  proposed_connection_id UUID NOT NULL,
  group_a_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  group_b_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  desired_connection_type TEXT NOT NULL CHECK (desired_connection_type IN ('hierarchy', 'peer')),
  desired_parent_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  desired_child_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  structure_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (structure_status IN ('pending', 'approved', 'rejected')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partially_approved', 'approved', 'rejected')),
  initiator_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_connection_request_canonical_pair_check CHECK (group_a_id < group_b_id),
  CONSTRAINT group_connection_request_structure_check CHECK (
    (
      desired_connection_type = 'peer'
      AND desired_parent_group_id IS NULL
      AND desired_child_group_id IS NULL
    ) OR (
      desired_connection_type = 'hierarchy'
      AND desired_parent_group_id IS NOT NULL
      AND desired_child_group_id IS NOT NULL
      AND desired_parent_group_id <> desired_child_group_id
      AND (
        (desired_parent_group_id = group_a_id AND desired_child_group_id = group_b_id)
        OR (desired_parent_group_id = group_b_id AND desired_child_group_id = group_a_id)
      )
    )
  ),
  UNIQUE (group_a_id, group_b_id)
);

CREATE INDEX idx_group_connection_request_active
  ON public.group_connection_request (active_connection_id);
CREATE INDEX idx_group_connection_request_group_a
  ON public.group_connection_request (group_a_id);
CREATE INDEX idx_group_connection_request_group_b
  ON public.group_connection_request (group_b_id);
CREATE INDEX idx_group_connection_request_status
  ON public.group_connection_request (status);

ALTER TABLE public.group_connection_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_connection_request
  FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.group_right_grant_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_request_id UUID NOT NULL
    REFERENCES public.group_connection_request (id) ON DELETE CASCADE,
  existing_grant_id UUID REFERENCES public.group_right_grant (id) ON DELETE SET NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'remove')),
  right_key TEXT NOT NULL,
  holder_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  scope_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  initiator_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_right_grant_request_endpoints_check
    CHECK (holder_group_id <> scope_group_id),
  UNIQUE (connection_request_id, right_key, holder_group_id, scope_group_id)
);

CREATE INDEX idx_group_right_grant_request_header
  ON public.group_right_grant_request (connection_request_id);
CREATE INDEX idx_group_right_grant_request_status
  ON public.group_right_grant_request (status);
CREATE INDEX idx_group_right_grant_request_holder
  ON public.group_right_grant_request (holder_group_id);

ALTER TABLE public.group_right_grant_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_right_grant_request
  FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.group_membership_rule_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_request_id UUID NOT NULL
    REFERENCES public.group_connection_request (id) ON DELETE CASCADE,
  existing_membership_rule_id UUID REFERENCES public.group_membership_rule (id) ON DELETE SET NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'remove')),
  member_source_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  member_target_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  membership_mode TEXT,
  required_source_role_id UUID REFERENCES public.role (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_membership_rule_request_shape_check CHECK (
    (
      operation = 'remove'
      AND member_source_group_id IS NULL
      AND member_target_group_id IS NULL
      AND membership_mode IS NULL
      AND required_source_role_id IS NULL
    ) OR (
      operation = 'upsert'
      AND member_source_group_id IS NOT NULL
      AND member_target_group_id IS NOT NULL
      AND member_source_group_id <> member_target_group_id
      AND membership_mode IN ('all_members', 'role_members', 'selected_source_groups')
      AND (
        (
          membership_mode IN ('all_members', 'selected_source_groups')
          AND required_source_role_id IS NULL
        ) OR (
          membership_mode = 'role_members'
          AND required_source_role_id IS NOT NULL
        )
      )
    )
  ),
  UNIQUE (connection_request_id)
);

CREATE INDEX idx_group_membership_rule_request_header
  ON public.group_membership_rule_request (connection_request_id);
CREATE INDEX idx_group_membership_rule_request_status
  ON public.group_membership_rule_request (status);

ALTER TABLE public.group_membership_rule_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership_rule_request
  FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.group_membership_rule_request_origin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_rule_request_id UUID NOT NULL
    REFERENCES public.group_membership_rule_request (id) ON DELETE CASCADE,
  eligible_origin_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membership_rule_request_id, eligible_origin_group_id)
);

CREATE INDEX idx_group_membership_rule_request_origin_request
  ON public.group_membership_rule_request_origin (membership_rule_request_id);
CREATE INDEX idx_group_membership_rule_request_origin_group
  ON public.group_membership_rule_request_origin (eligible_origin_group_id);

ALTER TABLE public.group_membership_rule_request_origin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership_rule_request_origin
  FOR ALL TO service_role USING (true);

-- Subscriber table
CREATE TABLE IF NOT EXISTS public.subscriber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  user_id UUID,
  group_id UUID,
  amendment_id UUID,
  event_id UUID,
  blog_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriber_subscriber ON public.subscriber (subscriber_id);
CREATE INDEX idx_subscriber_user ON public.subscriber (user_id);
CREATE INDEX idx_subscriber_group ON public.subscriber (group_id);

ALTER TABLE public.subscriber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.subscriber FOR ALL TO service_role USING (true);

-- Group workflow table (ordered workflow templates for circular/finite processes)
CREATE TABLE IF NOT EXISTS public.group_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  start_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  is_default_entry BOOLEAN NOT NULL DEFAULT false,
  status TEXT,
  created_by_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_workflow_group ON public.group_workflow (group_id);
CREATE INDEX idx_group_workflow_start_group ON public.group_workflow (start_group_id);
CREATE INDEX idx_group_workflow_created_by ON public.group_workflow (created_by_id);
CREATE UNIQUE INDEX idx_group_workflow_default_entry
  ON public.group_workflow (group_id)
  WHERE is_default_entry = true;

ALTER TABLE public.group_workflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_workflow FOR ALL TO service_role USING (true);

-- Group workflow approval table (one approval record per participating group)
CREATE TABLE IF NOT EXISTS public.group_workflow_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.group_workflow (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  requested_by_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_group_workflow_approval_unique
  ON public.group_workflow_approval (workflow_id, group_id);
CREATE INDEX idx_group_workflow_approval_workflow
  ON public.group_workflow_approval (workflow_id);
CREATE INDEX idx_group_workflow_approval_group
  ON public.group_workflow_approval (group_id);
CREATE INDEX idx_group_workflow_approval_requested_by
  ON public.group_workflow_approval (requested_by_group_id);
CREATE INDEX idx_group_workflow_approval_status
  ON public.group_workflow_approval (status);

ALTER TABLE public.group_workflow_approval ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_workflow_approval FOR ALL TO service_role USING (true);

-- Group workflow step table (ordered steps referencing groups)
CREATE TABLE IF NOT EXISTS public.group_workflow_step (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.group_workflow (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  step_kind TEXT NOT NULL DEFAULT 'group_vote',
  selection_mode TEXT NOT NULL DEFAULT 'default_target_workflow',
  merge_strategy TEXT,
  event_rule TEXT,
  auto_task_on_missing_event BOOLEAN NOT NULL DEFAULT false,
  target_workflow_id UUID REFERENCES public.group_workflow (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_workflow_step_workflow ON public.group_workflow_step (workflow_id);
CREATE INDEX idx_group_workflow_step_group ON public.group_workflow_step (group_id);
CREATE INDEX idx_group_workflow_step_target_workflow ON public.group_workflow_step (target_workflow_id);

ALTER TABLE public.group_workflow_step ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_workflow_step FOR ALL TO service_role USING (true);

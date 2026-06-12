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

-- Canonical network link table
CREATE TABLE IF NOT EXISTS public.network_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  target_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  structural_relation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_group_id, target_group_id, structural_relation)
);

CREATE INDEX idx_network_link_source_group ON public.network_link (source_group_id);
CREATE INDEX idx_network_link_target_group ON public.network_link (target_group_id);
CREATE INDEX idx_network_link_relation ON public.network_link (structural_relation);

ALTER TABLE public.network_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.network_link FOR ALL TO service_role USING (true);

-- Canonical network link rights
CREATE TABLE IF NOT EXISTS public.network_link_right (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_link_id UUID NOT NULL REFERENCES public.network_link (id) ON DELETE CASCADE,
  right_key TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'forward',
  status TEXT NOT NULL DEFAULT 'active',
  initiator_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (network_link_id, right_key)
);

CREATE INDEX idx_network_link_right_link ON public.network_link_right (network_link_id);
CREATE INDEX idx_network_link_right_status ON public.network_link_right (status);
CREATE INDEX idx_network_link_right_initiator ON public.network_link_right (initiator_group_id);

ALTER TABLE public.network_link_right ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.network_link_right FOR ALL TO service_role USING (true);

-- Membership propagation rule for canonical links
CREATE TABLE IF NOT EXISTS public.network_link_membership_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_link_id UUID NOT NULL REFERENCES public.network_link (id) ON DELETE CASCADE,
  membership_direction TEXT,
  membership_mode TEXT NOT NULL DEFAULT 'none',
  role_id UUID REFERENCES public.role (id) ON DELETE SET NULL,
  source_group_ids JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT network_link_membership_rule_direction_check
    CHECK (membership_direction IS NULL OR membership_direction IN ('forward', 'backward')),
  CONSTRAINT network_link_membership_rule_mode_fields_check
    CHECK (
      (
        membership_mode = 'none'
        AND membership_direction IS NULL
        AND role_id IS NULL
        AND source_group_ids IS NULL
      ) OR (
        membership_mode = 'all_members'
        AND membership_direction IS NOT NULL
        AND role_id IS NULL
        AND source_group_ids IS NULL
      ) OR (
        membership_mode = 'role_members'
        AND membership_direction IS NOT NULL
        AND role_id IS NOT NULL
        AND source_group_ids IS NULL
      ) OR (
        membership_mode = 'selected_source_groups'
        AND membership_direction IS NOT NULL
        AND role_id IS NULL
        AND source_group_ids IS NOT NULL
        AND jsonb_typeof(source_group_ids) = 'array'
        AND jsonb_array_length(source_group_ids) > 0
      )
    ),
  UNIQUE (network_link_id)
);

CREATE INDEX idx_network_link_membership_rule_link
  ON public.network_link_membership_rule (network_link_id);
CREATE INDEX idx_network_link_membership_rule_mode
  ON public.network_link_membership_rule (membership_mode);
CREATE INDEX idx_network_link_membership_rule_direction
  ON public.network_link_membership_rule (membership_direction);

ALTER TABLE public.network_link_membership_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.network_link_membership_rule FOR ALL TO service_role USING (true);

-- Pending change requests for canonical links
CREATE TABLE IF NOT EXISTS public.network_link_change_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_network_link_id UUID REFERENCES public.network_link (id) ON DELETE SET NULL,
  proposed_network_link_id UUID NOT NULL,
  source_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  target_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  structural_relation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  initiator_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  desired_rights JSONB NOT NULL,
  desired_membership_direction TEXT,
  desired_membership_mode TEXT NOT NULL DEFAULT 'none',
  desired_role_id UUID REFERENCES public.role (id) ON DELETE SET NULL,
  desired_source_group_ids JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT network_link_change_request_membership_direction_check
    CHECK (
      desired_membership_direction IS NULL
      OR desired_membership_direction IN ('forward', 'backward')
    ),
  CONSTRAINT network_link_change_request_membership_mode_fields_check
    CHECK (
      (
        desired_membership_mode = 'none'
        AND desired_membership_direction IS NULL
        AND desired_role_id IS NULL
        AND desired_source_group_ids IS NULL
      ) OR (
        desired_membership_mode = 'all_members'
        AND desired_membership_direction IS NOT NULL
        AND desired_role_id IS NULL
        AND desired_source_group_ids IS NULL
      ) OR (
        desired_membership_mode = 'role_members'
        AND desired_membership_direction IS NOT NULL
        AND desired_role_id IS NOT NULL
        AND desired_source_group_ids IS NULL
      ) OR (
        desired_membership_mode = 'selected_source_groups'
        AND desired_membership_direction IS NOT NULL
        AND desired_role_id IS NULL
        AND desired_source_group_ids IS NOT NULL
        AND jsonb_typeof(desired_source_group_ids) = 'array'
        AND jsonb_array_length(desired_source_group_ids) > 0
      )
    )
);

CREATE INDEX idx_network_link_change_request_membership_direction
  ON public.network_link_change_request (desired_membership_direction);


CREATE INDEX idx_network_link_change_request_active_link
  ON public.network_link_change_request (active_network_link_id);
CREATE INDEX idx_network_link_change_request_source_group
  ON public.network_link_change_request (source_group_id);
CREATE INDEX idx_network_link_change_request_target_group
  ON public.network_link_change_request (target_group_id);
CREATE INDEX idx_network_link_change_request_status
  ON public.network_link_change_request (status);

CREATE UNIQUE INDEX idx_network_link_change_request_active_link_unique
  ON public.network_link_change_request (active_network_link_id)
  WHERE active_network_link_id IS NOT NULL;
CREATE UNIQUE INDEX idx_network_link_change_request_pair_unique
  ON public.network_link_change_request (source_group_id, target_group_id, structural_relation)
  WHERE active_network_link_id IS NULL;

ALTER TABLE public.network_link_change_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.network_link_change_request FOR ALL TO service_role USING (true);

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

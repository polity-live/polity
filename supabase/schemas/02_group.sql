-- =============================================================================
-- 02_group.sql — Groups, memberships, roles, action rights, incumbents
-- Group relationships moved to 19_network.sql
-- Role incumbents and scoped offices live on `role` / `role_holder_history`
-- =============================================================================

-- Group table (quoted because "group" is a reserved word)
CREATE TABLE IF NOT EXISTS public."group" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  description JSONB,
  email TEXT,
  country TEXT,
  region TEXT,
  post_code TEXT,
  city TEXT,
  street TEXT,
  house_number TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_kind TEXT,
  location_place_id TEXT,
  location_boundary_source TEXT,
  location_geometry JSONB,
  location_bounds JSONB,
  image_url TEXT,
  video_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  member_count INTEGER NOT NULL DEFAULT 0,
  signed_up_member_count INTEGER NOT NULL DEFAULT 0,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  amendment_count INTEGER NOT NULL DEFAULT 0,
  document_count INTEGER NOT NULL DEFAULT 0,
  group_type TEXT NOT NULL DEFAULT 'base'
    CHECK (group_type IN ('base', 'hierarchical', 'sibling', 'parliament', 'committee', 'institution')),
  has_hierarchy_children BOOLEAN NOT NULL DEFAULT false,
  has_sibling_connections BOOLEAN NOT NULL DEFAULT false,
  connected_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  primary_sibling_membership_mode TEXT
    CHECK (
      primary_sibling_membership_mode IS NULL
      OR primary_sibling_membership_mode IN ('none', 'all_members', 'role_members', 'selected_source_groups')
    ),
  sibling_membership_mode TEXT
    CHECK (
      sibling_membership_mode IS NULL
      OR sibling_membership_mode IN ('open', 'elected', 'parliament')
    ),
  sibling_role_id UUID,
  x TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  whatsapp TEXT,
  instagram TEXT,
  twitter TEXT,
  facebook TEXT,
  snapchat TEXT,
  tiktok TEXT,
  owner_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_single_primary_media_check CHECK (image_url IS NULL OR video_url IS NULL)
);

CREATE INDEX idx_group_owner ON public."group" (owner_id);
CREATE INDEX idx_group_type ON public."group" (group_type);
CREATE INDEX idx_group_connected_group ON public."group" (connected_group_id);
CREATE INDEX idx_group_hierarchy_children ON public."group" (has_hierarchy_children);
CREATE INDEX idx_group_sibling_connections ON public."group" (has_sibling_connections);

ALTER TABLE public."group" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public."group" FOR ALL TO service_role USING (true);

-- Role table
CREATE TABLE IF NOT EXISTS public.role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  description TEXT,
  scope TEXT,
  group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  event_id UUID,
  amendment_id UUID,
  blog_id UUID,
  assignment_mode TEXT NOT NULL DEFAULT 'assigned' CHECK (assignment_mode IN ('assigned', 'elected')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'authenticated', 'private')),
  term_start_date TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern TEXT,
  recurrence_rule TEXT,
  recurrence_interval INTEGER,
  recurrence_days INTEGER[],
  recurrence_end_date TIMESTAMPTZ,
  scheduled_revote_date TIMESTAMPTZ,
  default_request_role BOOLEAN NOT NULL DEFAULT false,
  default_invite_role BOOLEAN NOT NULL DEFAULT false,
  assignee_kind TEXT NOT NULL DEFAULT 'member' CHECK (assignee_kind IN ('member', 'guest')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_role_group ON public.role (group_id);
CREATE INDEX idx_role_event ON public.role (event_id);
CREATE INDEX idx_role_scope ON public.role (scope);
CREATE INDEX idx_role_assignee_kind ON public.role (assignee_kind);
CREATE INDEX idx_zero_role_amendment_scope_id ON public.role (amendment_id, scope, id);
CREATE INDEX idx_zero_role_blog_scope_id ON public.role (blog_id, scope, id);
CREATE INDEX idx_zero_role_group_scope_order_id ON public.role (group_id, scope, sort_order, id);

ALTER TABLE public.role ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.role FOR ALL TO service_role USING (true);

-- Role holder history table
CREATE TABLE IF NOT EXISTS public.role_holder_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.role (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_role_holder_history_role ON public.role_holder_history (role_id);
CREATE INDEX idx_role_holder_history_user ON public.role_holder_history (user_id);
CREATE INDEX idx_zero_role_holder_history_role_end_id
  ON public.role_holder_history (role_id, end_date, id);

ALTER TABLE public.role_holder_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.role_holder_history FOR ALL TO service_role USING (true);

-- Group membership table
CREATE TABLE IF NOT EXISTS public.group_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  status TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  source TEXT NOT NULL DEFAULT 'direct',
  source_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  origin_kind TEXT NOT NULL DEFAULT 'direct'
    CHECK (
      origin_kind IN (
        'direct',
        'hierarchy',
        'sibling_all_members',
        'sibling_role_members',
        'sibling_selected_source_groups',
        'manual_projection'
      )
    ),
  connection_id UUID,
  membership_rule_id UUID,
  part_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  base_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  is_auto_managed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);

CREATE INDEX idx_group_membership_group ON public.group_membership (group_id);
CREATE INDEX idx_group_membership_user ON public.group_membership (user_id);
CREATE INDEX idx_group_membership_source_group ON public.group_membership (source_group_id);
CREATE INDEX idx_group_membership_group_status ON public.group_membership (group_id, status);
CREATE INDEX idx_group_membership_user_status ON public.group_membership (user_id, status);
CREATE INDEX idx_group_membership_origin_kind ON public.group_membership (origin_kind);
CREATE INDEX idx_group_membership_connection ON public.group_membership (connection_id);
CREATE INDEX idx_group_membership_membership_rule ON public.group_membership (membership_rule_id);
CREATE INDEX idx_group_membership_part_group ON public.group_membership (part_group_id);
CREATE INDEX idx_group_membership_base_group ON public.group_membership (base_group_id);
CREATE INDEX idx_zero_group_membership_user_created_id
  ON public.group_membership (user_id, created_at DESC, id DESC);
CREATE INDEX idx_zero_group_membership_group_created_id
  ON public.group_membership (group_id, created_at DESC, id DESC);

ALTER TABLE public.group_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership FOR ALL TO service_role USING (true);

-- Explicit provenance for projected memberships. One membership row stays the
-- read-compatible canonical membership; this table explains why it exists.
CREATE TABLE IF NOT EXISTS public.group_membership_origin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_membership_id UUID NOT NULL REFERENCES public.group_membership (id) ON DELETE CASCADE,
  origin_kind TEXT NOT NULL
    CHECK (
      origin_kind IN (
        'direct',
        'hierarchy',
        'sibling_all_members',
        'sibling_role_members',
        'sibling_selected_source_groups',
        'manual_projection'
      )
    ),
  source_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  source_membership_id UUID REFERENCES public.group_membership (id) ON DELETE SET NULL,
  connection_id UUID,
  membership_rule_id UUID,
  source_role_id UUID,
  part_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  base_group_id UUID REFERENCES public."group" (id) ON DELETE SET NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  path_group_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_membership_id, origin_kind, source_group_id, connection_id, membership_rule_id, source_role_id)
);

CREATE INDEX idx_group_membership_origin_membership
  ON public.group_membership_origin (group_membership_id);
CREATE INDEX idx_group_membership_origin_source_group
  ON public.group_membership_origin (source_group_id);
CREATE INDEX idx_group_membership_origin_source_membership
  ON public.group_membership_origin (source_membership_id);
CREATE INDEX idx_group_membership_origin_connection
  ON public.group_membership_origin (connection_id);
CREATE INDEX idx_group_membership_origin_rule
  ON public.group_membership_origin (membership_rule_id);
CREATE INDEX idx_group_membership_origin_part_group
  ON public.group_membership_origin (part_group_id);
CREATE INDEX idx_group_membership_origin_base_group
  ON public.group_membership_origin (base_group_id);

ALTER TABLE public.group_membership_origin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership_origin
  FOR ALL TO service_role USING (true);

-- Offline group members (real-world members without platform signup)
CREATE TABLE IF NOT EXISTS public.group_offline_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  reason_not_signed_up TEXT,
  connected_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_offline_member_group ON public.group_offline_member (group_id);
CREATE INDEX idx_group_offline_member_connected_user ON public.group_offline_member (connected_user_id);
CREATE UNIQUE INDEX idx_group_offline_member_unique_connected_user
  ON public.group_offline_member (group_id, connected_user_id)
  WHERE connected_user_id IS NOT NULL;

ALTER TABLE public.group_offline_member ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_offline_member FOR ALL TO service_role USING (true);

-- Offline group memberships
CREATE TABLE IF NOT EXISTS public.group_offline_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_offline_member_id UUID NOT NULL REFERENCES public.group_offline_member (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  status TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  source TEXT NOT NULL DEFAULT 'direct',
  source_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_offline_member_id, group_id)
);

CREATE INDEX idx_group_offline_membership_group ON public.group_offline_membership (group_id);
CREATE INDEX idx_group_offline_membership_member ON public.group_offline_membership (group_offline_member_id);
CREATE INDEX idx_group_offline_membership_source_group ON public.group_offline_membership (source_group_id);

ALTER TABLE public.group_offline_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_offline_membership FOR ALL TO service_role USING (true);

-- Offline group membership roles
CREATE TABLE IF NOT EXISTS public.group_offline_membership_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_offline_membership_id UUID NOT NULL REFERENCES public.group_offline_membership (id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_offline_membership_id, role_id)
);

CREATE INDEX idx_group_offline_membership_role_membership ON public.group_offline_membership_role (group_offline_membership_id);
CREATE INDEX idx_group_offline_membership_role_role ON public.group_offline_membership_role (role_id);
CREATE INDEX idx_group_offline_membership_role_assigned_by ON public.group_offline_membership_role (assigned_by_id);

ALTER TABLE public.group_offline_membership_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_offline_membership_role FOR ALL TO service_role USING (true);

-- Group membership roles table
CREATE TABLE IF NOT EXISTS public.group_membership_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_membership_id UUID NOT NULL REFERENCES public.group_membership (id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_membership_id, role_id)
);

CREATE INDEX idx_group_membership_role_membership ON public.group_membership_role (group_membership_id);
CREATE INDEX idx_group_membership_role_role ON public.group_membership_role (role_id);
CREATE INDEX idx_group_membership_role_assigned_by ON public.group_membership_role (assigned_by_id);

ALTER TABLE public.group_membership_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership_role FOR ALL TO service_role USING (true);

-- Group guest access table
CREATE TABLE IF NOT EXISTS public.group_guest_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('requested', 'invited', 'active', 'revoked')),
  invited_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_guest_access_group ON public.group_guest_access (group_id);
CREATE INDEX idx_group_guest_access_user ON public.group_guest_access (user_id);
CREATE INDEX idx_group_guest_access_status ON public.group_guest_access (status);

ALTER TABLE public.group_guest_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_guest_access FOR ALL TO service_role USING (true);

-- Group guest access roles table
CREATE TABLE IF NOT EXISTS public.group_guest_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_guest_access_id UUID NOT NULL REFERENCES public.group_guest_access (id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_guest_access_id, role_id)
);

CREATE INDEX idx_group_guest_role_access ON public.group_guest_role (group_guest_access_id);
CREATE INDEX idx_group_guest_role_role ON public.group_guest_role (role_id);
CREATE INDEX idx_group_guest_role_assigned_by ON public.group_guest_role (assigned_by_id);

ALTER TABLE public.group_guest_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_guest_role FOR ALL TO service_role USING (true);

-- Action right table
CREATE TABLE IF NOT EXISTS public.action_right (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT,
  action TEXT,
  role_id UUID NOT NULL REFERENCES public.role (id) ON DELETE CASCADE,
  group_id UUID,
  event_id UUID,
  amendment_id UUID,
  blog_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_right_role ON public.action_right (role_id);
CREATE INDEX idx_zero_action_right_role_resource_action
  ON public.action_right (role_id, resource, action);

ALTER TABLE public.action_right ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.action_right FOR ALL TO service_role USING (true);



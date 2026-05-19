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
  image_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  member_count INTEGER NOT NULL DEFAULT 0,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  amendment_count INTEGER NOT NULL DEFAULT 0,
  document_count INTEGER NOT NULL DEFAULT 0,
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
  group_type TEXT NOT NULL CHECK (group_type IN ('base', 'hierarchical')),
  owner_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_owner ON public."group" (owner_id);

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
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_role_group ON public.role (group_id);
CREATE INDEX idx_role_event ON public.role (event_id);
CREATE INDEX idx_role_scope ON public.role (scope);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);

CREATE INDEX idx_group_membership_group ON public.group_membership (group_id);
CREATE INDEX idx_group_membership_user ON public.group_membership (user_id);
CREATE INDEX idx_group_membership_source_group ON public.group_membership (source_group_id);

ALTER TABLE public.group_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_membership FOR ALL TO service_role USING (true);

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

ALTER TABLE public.action_right ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.action_right FOR ALL TO service_role USING (true);



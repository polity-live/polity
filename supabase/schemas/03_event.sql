-- =============================================================================
-- 03_event.sql — Events and participants
-- Delegates moved to 18_delegate.sql
-- Meetings are modeled as bookable events in this schema
-- Event-scoped offices live on `role`
-- Voting sessions moved to 20_vote.sql
-- Scheduled elections moved to 16_election.sql
-- =============================================================================

-- Event table
CREATE TABLE public.event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description JSONB,
  status TEXT,
  event_type TEXT,
  attendance_mode TEXT NOT NULL DEFAULT 'offline' CHECK (attendance_mode IN ('online', 'hybrid', 'offline')),
  location_type TEXT,
  location_name TEXT,
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
  location_url TEXT,
  location_coordinates TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  timezone TEXT,
  default_final_vote_duration_seconds INTEGER,
  change_request_vote_order TEXT NOT NULL DEFAULT 'text_position',
  gender_quota_enabled BOOLEAN NOT NULL DEFAULT false,
  accreditation_required BOOLEAN NOT NULL DEFAULT false,
  capacity INTEGER,
  participant_count INTEGER NOT NULL DEFAULT 0,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  election_count INTEGER NOT NULL DEFAULT 0,
  amendment_count INTEGER NOT NULL DEFAULT 0,
  open_change_request_count INTEGER NOT NULL DEFAULT 0,
  agenda_management TEXT,
  meeting_type TEXT,
  is_bookable BOOLEAN NOT NULL DEFAULT false,
  max_bookings INTEGER DEFAULT 1,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern TEXT,
  recurrence_rule TEXT,
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_days INTEGER[],
  recurrence_end_date TIMESTAMPTZ,
  original_event_id UUID,
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_id UUID,
  x TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  stream_url TEXT,
  image_url TEXT,
  video_url TEXT,
  has_delegates BOOLEAN NOT NULL DEFAULT false,
  delegate_count INTEGER NOT NULL DEFAULT 0,
  delegate_distribution_method TEXT,
  delegate_distribution_status TEXT,
  delegate_seat_allocation_type TEXT,
  total_delegate_seats INTEGER,
  delegate_quorum_percentage NUMERIC,
  delegate_vote_weight_type TEXT,
  delegate_vote_threshold_percentage NUMERIC,
  delegate_accepted_states JSONB,
  delegate_finalized_at TIMESTAMPTZ,
  delegate_approval_type TEXT,
  delegate_check_mode TEXT,
  main_group_delegate_allocation_mode TEXT,
  delegate_election_mode TEXT NOT NULL DEFAULT 'list',
  current_agenda_item_id UUID,
  amendment_deadline TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  candidacy_deadline TIMESTAMPTZ,
  delegates_nomination_deadline TIMESTAMPTZ,
  group_id UUID,
  creator_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_single_primary_media_check CHECK (image_url IS NULL OR video_url IS NULL)
);

CREATE INDEX idx_event_creator ON public.event (creator_id);
CREATE INDEX idx_event_group ON public.event (group_id);
CREATE INDEX idx_event_status ON public.event (status);
CREATE INDEX idx_event_start_date ON public.event (start_date);

CREATE TABLE public.event_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  subject_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'cancelled', 'participant_added', 'participant_updated',
    'participant_removed', 'offline_participant_added', 'offline_participant_updated',
    'offline_participant_removed', 'offline_participants_imported', 'role_created',
    'role_updated', 'role_deleted', 'role_assigned', 'role_unassigned',
    'delegates_finalized', 'delegates_reconciled', 'exception_created',
    'exception_updated', 'exception_deleted', 'agenda_created', 'agenda_updated',
    'agenda_deleted', 'agenda_reordered', 'booking_created', 'booking_cancelled',
    'result_recorded'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('normal', 'high')),
  changes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(changes) = 'array'),
  context JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_activity_created
  ON public.event_activity (event_id, created_at DESC, id DESC);
CREATE INDEX idx_event_activity_severity_created
  ON public.event_activity (event_id, severity, created_at DESC, id DESC);

ALTER TABLE public.event_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event_activity
  FOR ALL TO service_role USING (true);

ALTER TABLE public.event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event FOR ALL TO service_role USING (true);

-- Explicit participant scope for assemblies. Reconciliation reads this instead
-- of interpreting the full group graph on every event operation.
CREATE TABLE public.event_assembly_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  host_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  source_group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  scope_kind TEXT NOT NULL
    CHECK (scope_kind IN ('general_member_source', 'delegate_source', 'delegate_assignment_source')),
  participant_mode TEXT NOT NULL
    CHECK (participant_mode IN ('all_members', 'delegates', 'role_members', 'none')),
  required_role_id UUID REFERENCES public.role (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, source_group_id, scope_kind, participant_mode)
);

CREATE INDEX idx_event_assembly_scope_event
  ON public.event_assembly_scope (event_id, status);
CREATE INDEX idx_event_assembly_scope_host_group
  ON public.event_assembly_scope (host_group_id, status);
CREATE INDEX idx_event_assembly_scope_source_group
  ON public.event_assembly_scope (source_group_id, status);

ALTER TABLE public.event_assembly_scope ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event_assembly_scope
  FOR ALL TO service_role USING (true);

-- Event participant table
-- Also stores meeting bookings. For recurring meetings, instance_date identifies the booked occurrence.
CREATE TABLE public.event_participant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  group_id UUID,
  status TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  instance_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_participant_instance ON public.event_participant (event_id, instance_date);
CREATE INDEX idx_event_participant_event ON public.event_participant (event_id);
CREATE INDEX idx_event_participant_user ON public.event_participant (user_id);
CREATE INDEX idx_zero_event_participant_user_status_event
  ON public.event_participant (user_id, status, event_id);
CREATE INDEX idx_zero_event_participant_event_created_id
  ON public.event_participant (event_id, created_at DESC, id DESC);
CREATE INDEX idx_zero_event_participant_user_created_id
  ON public.event_participant (user_id, created_at DESC, id DESC);
CREATE INDEX idx_zero_event_participant_event_user_id
  ON public.event_participant (event_id, user_id, id);
CREATE UNIQUE INDEX idx_event_participant_unique_event_user
  ON public.event_participant (event_id, user_id)
  WHERE instance_date IS NULL;
CREATE UNIQUE INDEX idx_event_participant_unique_event_user_instance
  ON public.event_participant (event_id, user_id, instance_date)
  WHERE instance_date IS NOT NULL;

ALTER TABLE public.event_participant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event_participant FOR ALL TO service_role USING (true);

-- Offline / hybrid participants for real-world attendance tracking
CREATE TABLE public.event_offline_participant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  group_offline_member_id UUID REFERENCES public.group_offline_member (id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('group_member', 'event_extra')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  reason_not_signed_up TEXT,
  connected_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  attendance_status TEXT NOT NULL DEFAULT 'listed' CHECK (attendance_status IN ('listed', 'confirmed')),
  participation_channel TEXT NOT NULL DEFAULT 'offline' CHECK (participation_channel IN ('online', 'offline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_offline_participant_event ON public.event_offline_participant (event_id);
CREATE INDEX idx_event_offline_participant_group_offline_member ON public.event_offline_participant (group_offline_member_id);
CREATE INDEX idx_event_offline_participant_connected_user ON public.event_offline_participant (connected_user_id);
CREATE UNIQUE INDEX idx_event_offline_participant_unique_connected_user
  ON public.event_offline_participant (event_id, connected_user_id)
  WHERE connected_user_id IS NOT NULL;

ALTER TABLE public.event_offline_participant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event_offline_participant FOR ALL TO service_role USING (true);

-- Event participant roles table
CREATE TABLE public.event_participant_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_participant_id UUID NOT NULL REFERENCES public.event_participant (id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_participant_id, role_id)
);

CREATE INDEX idx_event_participant_role_participant ON public.event_participant_role (event_participant_id);
CREATE INDEX idx_event_participant_role_role ON public.event_participant_role (role_id);
CREATE INDEX idx_event_participant_role_assigned_by ON public.event_participant_role (assigned_by_id);

ALTER TABLE public.event_participant_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event_participant_role FOR ALL TO service_role USING (true);

-- Participant table (generic event participant with name/email)
CREATE TABLE public.participant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_participant_event ON public.participant (event_id);
CREATE INDEX idx_participant_user ON public.participant (user_id);

ALTER TABLE public.participant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.participant FOR ALL TO service_role USING (true);

-- Event exception table (for recurring event modifications/cancellations)
CREATE TABLE public.event_exception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  original_date TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  new_title TEXT,
  new_description TEXT,
  new_start_date TIMESTAMPTZ,
  new_end_date TIMESTAMPTZ,
  new_location_name TEXT,
  new_country TEXT,
  new_region TEXT,
  new_post_code TEXT,
  new_city TEXT,
  new_street TEXT,
  new_house_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_exception_parent_date UNIQUE (parent_event_id, original_date)
);

CREATE INDEX idx_event_exception_parent ON public.event_exception (parent_event_id);

ALTER TABLE public.event_exception ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event_exception FOR ALL TO service_role USING (true);

-- Calendar subscription table (subscribe to group/user calendars)
CREATE TABLE public.calendar_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_group_id UUID REFERENCES public."group" (id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public."user" (id) ON DELETE CASCADE,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_calendar_sub_target CHECK (
    (target_type = 'group' AND target_group_id IS NOT NULL AND target_user_id IS NULL) OR
    (target_type = 'user' AND target_user_id IS NOT NULL AND target_group_id IS NULL)
  )
);

CREATE UNIQUE INDEX idx_calendar_sub_user_group ON public.calendar_subscription (user_id, target_group_id)
  WHERE target_group_id IS NOT NULL;
CREATE UNIQUE INDEX idx_calendar_sub_user_user ON public.calendar_subscription (user_id, target_user_id)
  WHERE target_user_id IS NOT NULL;
CREATE INDEX idx_calendar_sub_user ON public.calendar_subscription (user_id);

ALTER TABLE public.calendar_subscription ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.calendar_subscription FOR ALL TO service_role USING (true);

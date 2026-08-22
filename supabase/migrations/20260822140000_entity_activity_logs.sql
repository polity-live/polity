CREATE TABLE public.amendment_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), amendment_id UUID NOT NULL REFERENCES public.amendment (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public."user" (id) ON DELETE SET NULL, actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  subject_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created','updated','collaborator_added','collaborator_updated','collaborator_removed','change_request_created','change_request_updated','change_request_resolved','process_started','process_updated','process_task_updated','process_replanned','group_decision_updated','support_confirmation_updated','implementation_updated')),
  severity TEXT NOT NULL CHECK (severity IN ('normal','high')),
  changes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(changes) = 'array'), context JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amendment_activity_created ON public.amendment_activity (amendment_id, created_at DESC, id DESC);
CREATE INDEX idx_amendment_activity_severity_created ON public.amendment_activity (amendment_id, severity, created_at DESC, id DESC);
ALTER TABLE public.amendment_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.amendment_activity FOR ALL TO service_role USING (true);

CREATE TABLE public.group_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), group_id UUID NOT NULL REFERENCES public."group" (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public."user" (id) ON DELETE SET NULL, actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  subject_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created','updated','membership_added','membership_updated','membership_removed','guest_added','guest_updated','guest_removed','offline_member_added','offline_member_updated','offline_member_removed','offline_members_imported','role_created','role_updated','role_deleted','role_assigned','role_unassigned','right_assigned','right_unassigned','term_updated','relationship_updated','reconciliation')),
  severity TEXT NOT NULL CHECK (severity IN ('normal','high')),
  changes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(changes) = 'array'), context JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_activity_created ON public.group_activity (group_id, created_at DESC, id DESC);
CREATE INDEX idx_group_activity_severity_created ON public.group_activity (group_id, severity, created_at DESC, id DESC);
ALTER TABLE public.group_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.group_activity FOR ALL TO service_role USING (true);

CREATE TABLE public.event_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public."user" (id) ON DELETE SET NULL, actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  subject_user_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created','updated','cancelled','participant_added','participant_updated','participant_removed','offline_participant_added','offline_participant_updated','offline_participant_removed','offline_participants_imported','role_created','role_updated','role_deleted','role_assigned','role_unassigned','delegates_finalized','delegates_reconciled','exception_created','exception_updated','exception_deleted','agenda_created','agenda_updated','agenda_deleted','agenda_reordered','booking_created','booking_cancelled','result_recorded')),
  severity TEXT NOT NULL CHECK (severity IN ('normal','high')),
  changes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(changes) = 'array'), context JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(context) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_activity_created ON public.event_activity (event_id, created_at DESC, id DESC);
CREATE INDEX idx_event_activity_severity_created ON public.event_activity (event_id, severity, created_at DESC, id DESC);
ALTER TABLE public.event_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.event_activity FOR ALL TO service_role USING (true);

INSERT INTO public.amendment_activity (id, amendment_id, actor_id, actor_type, action, severity, created_at)
SELECT id, id, created_by_id, 'user', 'created', 'high', created_at FROM public.amendment;
INSERT INTO public.group_activity (id, group_id, actor_id, actor_type, action, severity, created_at)
SELECT id, id, owner_id, CASE WHEN owner_id IS NULL THEN 'system' ELSE 'user' END, 'created', 'high', created_at FROM public."group";
INSERT INTO public.event_activity (id, event_id, actor_id, actor_type, action, severity, created_at)
SELECT id, id, creator_id, 'user', 'created', 'high', created_at FROM public.event;

GRANT ALL PRIVILEGES ON TABLE public.amendment_activity, public.group_activity, public.event_activity TO service_role;

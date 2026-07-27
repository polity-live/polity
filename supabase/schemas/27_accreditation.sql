-- =============================================================================
-- 27_accreditation.sql — Event accreditation (attendance confirmation)
-- Depends on: 01_user, 03_event, 06_agenda
-- =============================================================================

CREATE TABLE public.accreditation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  agenda_item_id UUID NOT NULL REFERENCES public.agenda_item (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  decision_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_accreditation_event ON public.accreditation (event_id);
CREATE INDEX idx_accreditation_agenda_item ON public.accreditation (agenda_item_id);
CREATE INDEX idx_accreditation_user ON public.accreditation (user_id);

ALTER TABLE public.accreditation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.accreditation FOR ALL TO service_role USING (true);

CREATE TABLE public.accreditation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accreditation_id UUID NOT NULL REFERENCES public.accreditation (id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.event (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('pending', 'approved', 'rejected', 'revoked')),
  actor_id UUID REFERENCES public."user" (id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accreditation_audit_accreditation ON public.accreditation_audit (accreditation_id);
CREATE INDEX idx_accreditation_audit_event ON public.accreditation_audit (event_id);
ALTER TABLE public.accreditation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.accreditation_audit FOR ALL TO service_role USING (true);

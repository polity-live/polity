-- 27_accreditation.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.accreditation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    agenda_item_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decided_by uuid,
    decision_reason text,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accreditation_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revoked'::text]))),
    CONSTRAINT accreditation_event_id_user_id_key UNIQUE (event_id, user_id),
    CONSTRAINT accreditation_pkey PRIMARY KEY (id)
);

CREATE TABLE public.accreditation_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    accreditation_id uuid NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    from_status text,
    to_status text NOT NULL,
    actor_id uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accreditation_audit_to_status_check CHECK ((to_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revoked'::text]))),
    CONSTRAINT accreditation_audit_pkey PRIMARY KEY (id)
);

ALTER TABLE public.accreditation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accreditation_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_accreditation_agenda_item ON public.accreditation USING btree (agenda_item_id);

CREATE INDEX idx_accreditation_audit_accreditation ON public.accreditation_audit USING btree (accreditation_id);

CREATE INDEX idx_accreditation_audit_event ON public.accreditation_audit USING btree (event_id);

CREATE INDEX idx_accreditation_event ON public.accreditation USING btree (event_id);

CREATE INDEX idx_accreditation_user ON public.accreditation USING btree (user_id);

CREATE POLICY service_role_all ON public.accreditation TO service_role USING (true);

CREATE POLICY service_role_all ON public.accreditation_audit TO service_role USING (true);

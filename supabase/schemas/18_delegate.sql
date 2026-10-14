-- 18_delegate.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.delegate_election_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_event_id uuid NOT NULL,
    source_group_id uuid NOT NULL,
    allocation_id uuid,
    required_seats integer DEFAULT 0 NOT NULL,
    confirmed_seats integer DEFAULT 0 NOT NULL,
    linked_event_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delegate_election_assignment_status_check CHECK ((status = ANY (ARRAY['open'::text, 'scheduled'::text, 'complete'::text, 'cancelled'::text]))),
    CONSTRAINT delegate_election_assignment_pkey PRIMARY KEY (id),
    CONSTRAINT delegate_election_assignment_target_event_id_source_group_i_key UNIQUE (target_event_id, source_group_id)
);

CREATE TABLE public.event_delegate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    group_id uuid,
    status text,
    seat_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_delegate_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_delegate_allocation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    group_id uuid,
    allocated_seats integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_delegate_allocation_pkey PRIMARY KEY (id)
);

ALTER TABLE public.delegate_election_assignment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_delegate ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_delegate_allocation ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_delegate_election_assignment_linked_event ON public.delegate_election_assignment USING btree (linked_event_id);

CREATE INDEX idx_delegate_election_assignment_source_group ON public.delegate_election_assignment USING btree (source_group_id, status);

CREATE INDEX idx_delegate_election_assignment_target_event ON public.delegate_election_assignment USING btree (target_event_id, status);

CREATE INDEX idx_event_delegate_event ON public.event_delegate USING btree (event_id);

CREATE INDEX idx_event_delegate_user ON public.event_delegate USING btree (user_id);

CREATE INDEX idx_group_delegate_allocation_event ON public.group_delegate_allocation USING btree (event_id);

CREATE POLICY service_role_all ON public.delegate_election_assignment TO service_role USING (true);

CREATE POLICY service_role_all ON public.event_delegate TO service_role USING (true);

CREATE POLICY service_role_all ON public.group_delegate_allocation TO service_role USING (true);

-- 06_agenda.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.agenda_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid,
    amendment_id uuid,
    creator_id uuid NOT NULL,
    title text,
    description text,
    type text,
    status text,
    forwarding_status text,
    order_index integer,
    duration integer,
    scheduled_time text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    activated_at timestamp with time zone,
    completed_at timestamp with time zone,
    majority_type text,
    time_limit integer,
    voting_phase text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agenda_item_voting_phase_check CHECK ((voting_phase = ANY (ARRAY['internal'::text, 'indicative'::text, 'final'::text, 'closed'::text]))),
    CONSTRAINT agenda_item_pkey PRIMARY KEY (id)
);

CREATE TABLE public.speaker_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agenda_item_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text,
    order_index integer,
    "time" integer,
    completed boolean DEFAULT false NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT speaker_list_pkey PRIMARY KEY (id)
);

ALTER TABLE public.agenda_item ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.speaker_list ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_agenda_item_creator ON public.agenda_item USING btree (creator_id);

CREATE INDEX idx_agenda_item_event ON public.agenda_item USING btree (event_id);

CREATE INDEX idx_speaker_list_agenda_item ON public.speaker_list USING btree (agenda_item_id);

CREATE INDEX idx_zero_agenda_item_event_order_id ON public.agenda_item USING btree (event_id, order_index, id);

CREATE POLICY service_role_all ON public.agenda_item TO service_role USING (true);

CREATE POLICY service_role_all ON public.speaker_list TO service_role USING (true);

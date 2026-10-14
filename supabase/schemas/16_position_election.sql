-- 16_position_election.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.election (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agenda_item_id uuid,
    role_id uuid,
    title text,
    description text,
    status text,
    majority_type text,
    closing_type text,
    closing_duration_seconds integer,
    closing_end_time timestamp with time zone,
    visibility character varying DEFAULT 'public'::character varying NOT NULL,
    ballot_visibility text DEFAULT 'secret'::text NOT NULL,
    election_mode text DEFAULT 'single'::text NOT NULL,
    seat_count integer DEFAULT 1 NOT NULL,
    max_votes integer DEFAULT 1 NOT NULL,
    electorate_snapshotted_at timestamp with time zone,
    offline_electorate_size integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT election_ballot_visibility_check CHECK ((ballot_visibility = ANY (ARRAY['named'::text, 'secret'::text]))),
    CONSTRAINT election_offline_electorate_size_check CHECK ((offline_electorate_size >= 0)),
    CONSTRAINT election_pkey PRIMARY KEY (id)
);

CREATE TABLE public.election_candidate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text,
    description text,
    image_url text,
    status text DEFAULT 'nominated'::text NOT NULL,
    order_index integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT election_candidate_pkey PRIMARY KEY (id)
);

CREATE TABLE public.election_offline_tally (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    phase text NOT NULL,
    candidate_id uuid NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    updated_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT election_offline_tally_count_check CHECK ((count >= 0)),
    CONSTRAINT election_offline_tally_phase_check CHECK ((phase = ANY (ARRAY['indicative'::text, 'final'::text]))),
    CONSTRAINT election_offline_tally_election_id_phase_candidate_id_key UNIQUE (election_id, phase, candidate_id),
    CONSTRAINT election_offline_tally_pkey PRIMARY KEY (id)
);

CREATE TABLE public.elector (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    user_id uuid NOT NULL,
    participation_channel text DEFAULT 'online'::text NOT NULL,
    snapshotted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT elector_participation_channel_check CHECK ((participation_channel = ANY (ARRAY['online'::text, 'offline'::text]))),
    CONSTRAINT elector_election_id_user_id_key UNIQUE (election_id, user_id),
    CONSTRAINT elector_pkey PRIMARY KEY (id)
);

CREATE TABLE public.final_candidate_selection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    elector_participation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT final_candidate_selection_pkey PRIMARY KEY (id)
);

CREATE TABLE public.final_elector_participation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    elector_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT final_elector_participation_election_id_elector_id_key UNIQUE (election_id, elector_id),
    CONSTRAINT final_elector_participation_pkey PRIMARY KEY (id)
);

CREATE TABLE public.indicative_candidate_selection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    elector_participation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indicative_candidate_selection_pkey PRIMARY KEY (id)
);

CREATE TABLE public.indicative_elector_participation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    user_id uuid NOT NULL,
    elector_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indicative_elector_participation_election_id_user_id_key UNIQUE (election_id, user_id),
    CONSTRAINT indicative_elector_participation_pkey PRIMARY KEY (id)
);

ALTER TABLE public.election ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.election_candidate ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.election_offline_tally ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.elector ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.final_candidate_selection ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.final_elector_participation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.indicative_candidate_selection ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.indicative_elector_participation ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_election_agenda_item ON public.election USING btree (agenda_item_id);

CREATE INDEX idx_election_candidate_election ON public.election_candidate USING btree (election_id);

CREATE INDEX idx_election_candidate_user ON public.election_candidate USING btree (user_id);

CREATE INDEX idx_election_offline_tally_candidate ON public.election_offline_tally USING btree (candidate_id);

CREATE INDEX idx_election_offline_tally_election ON public.election_offline_tally USING btree (election_id);

CREATE INDEX idx_election_role_id ON public.election USING btree (role_id);

CREATE INDEX idx_elector_election ON public.elector USING btree (election_id);

CREATE INDEX idx_elector_user ON public.elector USING btree (user_id);

CREATE INDEX idx_final_candidate_selection_candidate ON public.final_candidate_selection USING btree (candidate_id);

CREATE INDEX idx_final_candidate_selection_election ON public.final_candidate_selection USING btree (election_id);

CREATE INDEX idx_final_candidate_selection_participation ON public.final_candidate_selection USING btree (elector_participation_id);

CREATE INDEX idx_final_elector_participation_election ON public.final_elector_participation USING btree (election_id);

CREATE INDEX idx_final_elector_participation_elector ON public.final_elector_participation USING btree (elector_id);

CREATE INDEX idx_indicative_candidate_selection_candidate ON public.indicative_candidate_selection USING btree (candidate_id);

CREATE INDEX idx_indicative_candidate_selection_election ON public.indicative_candidate_selection USING btree (election_id);

CREATE INDEX idx_indicative_candidate_selection_participation ON public.indicative_candidate_selection USING btree (elector_participation_id);

CREATE INDEX idx_indicative_elector_participation_election ON public.indicative_elector_participation USING btree (election_id);

CREATE INDEX idx_indicative_elector_participation_elector ON public.indicative_elector_participation USING btree (elector_id);

CREATE INDEX idx_indicative_elector_participation_user ON public.indicative_elector_participation USING btree (user_id);

CREATE INDEX idx_zero_election_candidate_election_order_id ON public.election_candidate USING btree (election_id, order_index, id);

CREATE INDEX idx_zero_election_created_id ON public.election USING btree (created_at DESC, id DESC);

CREATE POLICY service_role_all ON public.election TO service_role USING (true);

CREATE POLICY service_role_all ON public.election_candidate TO service_role USING (true);

CREATE POLICY service_role_all ON public.election_offline_tally TO service_role USING (true);

CREATE POLICY service_role_all ON public.elector TO service_role USING (true);

CREATE POLICY service_role_all ON public.final_candidate_selection TO service_role USING (true);

CREATE POLICY service_role_all ON public.final_elector_participation TO service_role USING (true);

CREATE POLICY service_role_all ON public.indicative_candidate_selection TO service_role USING (true);

CREATE POLICY service_role_all ON public.indicative_elector_participation TO service_role USING (true);

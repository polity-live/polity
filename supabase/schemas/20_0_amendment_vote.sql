-- 20_0_amendment_vote.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.final_choice_decision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vote_id uuid NOT NULL,
    choice_id uuid NOT NULL,
    voter_participation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT final_choice_decision_pkey PRIMARY KEY (id)
);

CREATE TABLE public.final_voter_participation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vote_id uuid NOT NULL,
    voter_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT final_voter_participation_pkey PRIMARY KEY (id),
    CONSTRAINT final_voter_participation_vote_id_voter_id_key UNIQUE (vote_id, voter_id)
);

CREATE TABLE public.indicative_choice_decision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vote_id uuid NOT NULL,
    choice_id uuid NOT NULL,
    voter_participation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indicative_choice_decision_pkey PRIMARY KEY (id)
);

CREATE TABLE public.indicative_voter_participation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vote_id uuid NOT NULL,
    user_id uuid NOT NULL,
    voter_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indicative_voter_participation_pkey PRIMARY KEY (id),
    CONSTRAINT indicative_voter_participation_vote_id_user_id_key UNIQUE (vote_id, user_id)
);

CREATE TABLE public.vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agenda_item_id uuid,
    amendment_id uuid,
    title text,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    purpose text NOT NULL,
    majority_type text DEFAULT 'relative'::text NOT NULL,
    closing_type text DEFAULT 'moderator'::text NOT NULL,
    closing_duration_seconds integer,
    closing_end_time timestamp with time zone,
    closed_reason text,
    closed_at timestamp with time zone,
    closed_by_id uuid,
    visibility character varying DEFAULT 'public'::character varying NOT NULL,
    ballot_visibility text DEFAULT 'named'::text NOT NULL,
    electorate_snapshotted_at timestamp with time zone,
    offline_electorate_size integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vote_ballot_visibility_check CHECK ((ballot_visibility = ANY (ARRAY['named'::text, 'secret'::text]))),
    CONSTRAINT vote_offline_electorate_size_check CHECK ((offline_electorate_size >= 0)),
    CONSTRAINT vote_purpose_check CHECK ((purpose = ANY (ARRAY['change_request'::text, 'closing'::text, 'merge_variant'::text]))),
    CONSTRAINT vote_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'internal'::text, 'indicative'::text, 'final'::text, 'closed'::text]))),
    CONSTRAINT vote_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vote_choice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vote_id uuid NOT NULL,
    label text NOT NULL,
    semantic_key text,
    process_branch_id uuid,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vote_choice_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vote_offline_tally (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vote_id uuid NOT NULL,
    phase text NOT NULL,
    choice_id uuid NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    updated_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vote_offline_tally_count_check CHECK ((count >= 0)),
    CONSTRAINT vote_offline_tally_phase_check CHECK ((phase = ANY (ARRAY['indicative'::text, 'final'::text]))),
    CONSTRAINT vote_offline_tally_pkey PRIMARY KEY (id),
    CONSTRAINT vote_offline_tally_vote_id_phase_choice_id_key UNIQUE (vote_id, phase, choice_id)
);

CREATE TABLE public.voter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vote_id uuid NOT NULL,
    user_id uuid NOT NULL,
    participation_channel text DEFAULT 'online'::text NOT NULL,
    snapshotted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT voter_participation_channel_check CHECK ((participation_channel = ANY (ARRAY['online'::text, 'offline'::text]))),
    CONSTRAINT voter_pkey PRIMARY KEY (id),
    CONSTRAINT voter_vote_id_user_id_key UNIQUE (vote_id, user_id)
);

ALTER TABLE public.final_choice_decision ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.final_voter_participation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.indicative_choice_decision ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.indicative_voter_participation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vote ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vote_choice ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vote_offline_tally ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.voter ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_final_choice_decision_choice ON public.final_choice_decision USING btree (choice_id);

CREATE INDEX idx_final_choice_decision_participation ON public.final_choice_decision USING btree (voter_participation_id);

CREATE INDEX idx_final_choice_decision_vote ON public.final_choice_decision USING btree (vote_id);

CREATE INDEX idx_final_voter_participation_vote ON public.final_voter_participation USING btree (vote_id);

CREATE INDEX idx_final_voter_participation_voter ON public.final_voter_participation USING btree (voter_id);

CREATE INDEX idx_indicative_choice_decision_choice ON public.indicative_choice_decision USING btree (choice_id);

CREATE INDEX idx_indicative_choice_decision_participation ON public.indicative_choice_decision USING btree (voter_participation_id);

CREATE INDEX idx_indicative_choice_decision_vote ON public.indicative_choice_decision USING btree (vote_id);

CREATE INDEX idx_indicative_voter_participation_user ON public.indicative_voter_participation USING btree (user_id);

CREATE INDEX idx_indicative_voter_participation_vote ON public.indicative_voter_participation USING btree (vote_id);

CREATE INDEX idx_indicative_voter_participation_voter ON public.indicative_voter_participation USING btree (voter_id);

CREATE INDEX idx_vote_agenda_item ON public.vote USING btree (agenda_item_id);

CREATE INDEX idx_vote_agenda_item_purpose ON public.vote USING btree (agenda_item_id, purpose);

CREATE INDEX idx_vote_amendment ON public.vote USING btree (amendment_id);

CREATE INDEX idx_vote_choice_process_branch ON public.vote_choice USING btree (process_branch_id);

CREATE INDEX idx_vote_choice_vote ON public.vote_choice USING btree (vote_id);

CREATE INDEX idx_vote_offline_tally_choice ON public.vote_offline_tally USING btree (choice_id);

CREATE INDEX idx_vote_offline_tally_vote ON public.vote_offline_tally USING btree (vote_id);

CREATE INDEX idx_voter_user ON public.voter USING btree (user_id);

CREATE INDEX idx_voter_vote ON public.voter USING btree (vote_id);

CREATE INDEX idx_zero_vote_choice_vote_order_id ON public.vote_choice USING btree (vote_id, order_index, id);

CREATE INDEX idx_zero_vote_created_id ON public.vote USING btree (created_at DESC, id DESC);

CREATE POLICY service_role_all ON public.final_choice_decision TO service_role USING (true);

CREATE POLICY service_role_all ON public.final_voter_participation TO service_role USING (true);

CREATE POLICY service_role_all ON public.indicative_choice_decision TO service_role USING (true);

CREATE POLICY service_role_all ON public.indicative_voter_participation TO service_role USING (true);

CREATE POLICY service_role_all ON public.vote TO service_role USING (true);

CREATE POLICY service_role_all ON public.vote_choice TO service_role USING (true);

CREATE POLICY service_role_all ON public.vote_offline_tally TO service_role USING (true);

CREATE POLICY service_role_all ON public.voter TO service_role USING (true);

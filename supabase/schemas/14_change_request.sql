-- 14_change_request.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.change_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amendment_id uuid NOT NULL,
    process_branch_id uuid,
    suggestion_id text,
    user_id uuid NOT NULL,
    title text,
    description text,
    status text,
    reason text,
    source_type text,
    source_id uuid,
    source_title text,
    change_type text,
    original_text text,
    new_text text,
    original_properties jsonb,
    new_properties jsonb,
    changed_character_count integer DEFAULT 0 NOT NULL,
    votes_for integer DEFAULT 0 NOT NULL,
    votes_against integer DEFAULT 0 NOT NULL,
    votes_abstain integer DEFAULT 0 NOT NULL,
    voting_status text DEFAULT 'open'::text NOT NULL,
    voting_deadline timestamp with time zone,
    voting_majority_type text,
    quorum_required integer,
    branch_sequence_number integer,
    created_in_mode text,
    resolved_in_mode text,
    resolution_method text,
    visibility_scope text DEFAULT 'public'::text NOT NULL,
    obsolete_reason text,
    obsolete_at timestamp with time zone,
    obsolete_by_vote_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT change_request_pkey PRIMARY KEY (id)
);

ALTER TABLE public.change_request ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_change_request_amendment ON public.change_request USING btree (amendment_id);

CREATE UNIQUE INDEX idx_change_request_branch_sequence ON public.change_request USING btree (amendment_id, process_branch_id, branch_sequence_number) WHERE ((branch_sequence_number IS NOT NULL) AND (process_branch_id IS NOT NULL));

CREATE INDEX idx_change_request_changed_character_count ON public.change_request USING btree (changed_character_count);

CREATE UNIQUE INDEX idx_change_request_main_sequence ON public.change_request USING btree (amendment_id, branch_sequence_number) WHERE ((branch_sequence_number IS NOT NULL) AND (process_branch_id IS NULL));

CREATE INDEX idx_change_request_process_branch ON public.change_request USING btree (process_branch_id);

CREATE INDEX idx_change_request_suggestion_id ON public.change_request USING btree (suggestion_id) WHERE (suggestion_id IS NOT NULL);

CREATE INDEX idx_change_request_user ON public.change_request USING btree (user_id);

CREATE POLICY service_role_all ON public.change_request TO service_role USING (true);

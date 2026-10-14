-- 20_1_amendment_choices_vote.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.change_request_vote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    change_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vote text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT change_request_vote_pkey PRIMARY KEY (id)
);

ALTER TABLE public.change_request_vote ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_change_request_vote_cr ON public.change_request_vote USING btree (change_request_id);

CREATE INDEX idx_change_request_vote_user ON public.change_request_vote USING btree (user_id);

CREATE POLICY service_role_all ON public.change_request_vote TO service_role USING (true);
